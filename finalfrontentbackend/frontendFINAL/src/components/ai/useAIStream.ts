"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isApiRequestError } from "@/lib/api";
import { streamText } from "@/lib/ai";
import type { GenerateInput, TokenUsage } from "@/types/ai";

export type StreamStatus = "idle" | "streaming" | "completed" | "cancelled" | "error";

export interface AIStreamState {
  status: StreamStatus;
  text: string;
  id: string | null;
  provider: string | null;
  model: string | null;
  usage: TokenUsage | null;
  finishReason: string | null;
  error: string | null;
}

const INITIAL: AIStreamState = {
  status: "idle",
  text: "",
  id: null,
  provider: null,
  model: null,
  usage: null,
  finishReason: null,
  error: null,
};

/** Drives one streamed generation at a time; starting a new one or unmounting cancels the last. */
export function useAIStream() {
  const [state, setState] = useState<AIStreamState>(INITIAL);
  const controllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => controllerRef.current?.abort(), []);

  const start = useCallback(async (input: GenerateInput) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ ...INITIAL, status: "streaming" });

    try {
      for await (const event of streamText(input, { signal: controller.signal })) {
        if (event.event === "start") {
          const { id, provider, model } = event.data;
          setState((s) => ({ ...s, id, provider, model }));
        } else if (event.event === "delta") {
          const { text } = event.data;
          setState((s) => ({ ...s, text: s.text + text }));
        } else if (event.event === "done") {
          const { usage, finish_reason } = event.data;
          setState((s) => ({ ...s, status: "completed", usage, finishReason: finish_reason }));
        }
      }
    } catch (error) {
      if (controllerRef.current !== controller) return; // superseded by a newer request
      const cancelled = isApiRequestError(error) && error.code === "ABORTED";
      const message = error instanceof Error ? error.message : "The stream failed.";
      setState((s) => ({ ...s, status: cancelled ? "cancelled" : "error", error: cancelled ? null : message }));
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setState(INITIAL);
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { state, start, cancel, reset };
}
