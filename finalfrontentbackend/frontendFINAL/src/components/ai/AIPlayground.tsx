"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AIHistory } from "@/components/ai/AIHistory";
import { AIInput } from "@/components/ai/AIInput";
import { AIResponse, type AIResponseMeta } from "@/components/ai/AIResponse";
import { FileUpload } from "@/components/ai/FileUpload";
import { StreamingResponse } from "@/components/ai/StreamingResponse";
import { useAIStream } from "@/components/ai/useAIStream";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { isApiRequestError } from "@/lib/api";
import { aiApi, uploadForAnalysis } from "@/lib/ai";
import { cn } from "@/lib/utils";
import type { AIFileKind, AIProviderInfo, GeneratedPlan } from "@/types/ai";
import type { AIProvider } from "@/types/integrations";

type Mode = "stream" | "plan" | "file";

const MODES: { id: Mode; label: string; description: string }[] = [
  { id: "stream", label: "Chat (streaming)", description: "Answers stream in as they're generated." },
  { id: "plan", label: "Structured plan", description: "Validated JSON: title, summary, steps, priority, estimate." },
  { id: "file", label: "Analyze a file", description: "Images, PDFs or text files with an instruction." },
];

const PRIORITY_VARIANT = { low: "default", medium: "info", high: "warning", critical: "error" } as const;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function PlanView({ plan }: { plan: GeneratedPlan }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold">{plan.title}</h3>
        <Badge variant={PRIORITY_VARIANT[plan.priority]}>{plan.priority}</Badge>
        <span className="text-xs text-muted-foreground">≈ {plan.estimated_time}</span>
      </div>
      <p className="text-sm text-muted-foreground">{plan.summary}</p>
      <ol className="space-y-2">
        {plan.items.map((item, index) => (
          <li key={`${index}-${item.title}`} className="rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium">
                {index + 1}. {item.title}
              </p>
              <span className="shrink-0 text-xs text-muted-foreground">{item.estimated_time}</span>
            </div>
            {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

interface Result {
  text?: string;
  plan?: GeneratedPlan;
  meta: AIResponseMeta;
}

export function AIPlayground() {
  const [mode, setMode] = useState<Mode>("stream");
  const [providers, setProviders] = useState<AIProviderInfo[] | null>(null);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [provider, setProvider] = useState<AIProvider | "">("");
  const [historyKey, setHistoryKey] = useState(0);

  const stream = useAIStream();
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);

  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileKind, setFileKind] = useState<AIFileKind | null>(null);
  const [progress, setProgress] = useState<number | undefined>();
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    aiApi
      .providers({ signal: controller.signal })
      .then(setProviders)
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setProvidersError(errorMessage(err));
      });
    return () => controller.abort();
  }, []);

  useEffect(() => () => requestRef.current?.abort(), []);

  const streamStatus = stream.state.status;

  const configured = providers?.filter((p) => p.configured) ?? [];
  const selected = provider || null;
  const { start: startStream } = stream;

  const runStream = useCallback(
    (prompt: string) => {
      void startStream({ prompt, provider: selected }).then(() => setHistoryKey((key) => key + 1));
    },
    [startStream, selected],
  );

  const run = useCallback(
    async (prompt: string) => {
      setLastPrompt(prompt);
      if (mode === "stream") {
        runStream(prompt);
        return;
      }
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        if (mode === "plan") {
          const response = await aiApi.generateStructured(
            { prompt, provider: selected, output_schema: "generated_plan" },
            { signal: controller.signal },
          );
          setResult({ plan: response.data, meta: { provider: response.provider, model: response.model } });
        } else {
          if (!file) {
            setError("Choose a file to analyze first.");
            return;
          }
          setProgress(0);
          const target = fileKind === "image" ? "image" : "file";
          const response = await uploadForAnalysis(target, file, prompt, {
            provider: selected,
            signal: controller.signal,
            onProgress: ({ percent }) => setProgress(percent),
          });
          setResult({
            text: response.text,
            meta: {
              provider: response.provider,
              model: response.model,
              usage: response.usage,
              finishReason: response.finish_reason,
            },
          });
        }
      } catch (err) {
        if (isApiRequestError(err) && err.code === "ABORTED") return;
        setError(errorMessage(err));
      } finally {
        if (requestRef.current === controller) {
          requestRef.current = null;
          setLoading(false);
          setProgress(undefined);
          setHistoryKey((key) => key + 1);
        }
      }
    },
    [mode, selected, runStream, file, fileKind],
  );

  const cancel = () => {
    if (mode === "stream") stream.cancel();
    else requestRef.current?.abort();
  };

  const busy = mode === "stream" ? streamStatus === "streaming" : loading;
  const noProviders = providers !== null && configured.length === 0;
  const current = MODES.find((m) => m.id === mode) ?? MODES[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="space-y-6">
        <Card title="AI workspace" description={current.description}>
          <div className="space-y-4">
            <div role="tablist" aria-label="AI mode" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={mode === m.id}
                  disabled={busy}
                  onClick={() => {
                    setMode(m.id);
                    setError(null);
                    setResult(null);
                  }}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
                    mode === m.id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {providersError && <Alert variant="error">Could not load AI providers: {providersError}</Alert>}
            {noProviders && (
              <Alert variant="info" title="No AI provider configured">
                Set OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY or GROK_API_KEY in the backend&apos;s .env.
              </Alert>
            )}

            {mode === "file" && (
              <FileUpload
                file={file}
                kinds={["image", "pdf", "text"]}
                progress={progress}
                disabled={busy}
                onFileChange={(next, kind) => {
                  setFile(next);
                  setFileKind(kind);
                }}
              />
            )}

            <AIInput
              key={mode}
              onSubmit={(prompt) => void run(prompt)}
              onCancel={cancel}
              loading={busy}
              disabled={noProviders || (mode === "file" && !file)}
              keepValue={mode === "file"}
              label={mode === "file" ? "Instruction" : "Prompt"}
              placeholder={
                mode === "plan"
                  ? "e.g. Launch a hackathon demo in 48 hours with a team of 3"
                  : mode === "file"
                    ? "e.g. Extract the text / Summarise this document / What's in this image?"
                    : "Ask anything…"
              }
              submitLabel={mode === "plan" ? "Generate plan" : mode === "file" ? "Analyze" : "Send"}
              toolbar={
                configured.length > 0 && (
                  <select
                    aria-label="AI provider"
                    value={provider}
                    disabled={busy}
                    onChange={(event) => setProvider(event.target.value as AIProvider | "")}
                    className="h-10 rounded-lg border border-input bg-card px-2 text-sm"
                  >
                    <option value="">Default provider</option>
                    {configured.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name} ({p.model})
                      </option>
                    ))}
                  </select>
                )
              }
            />
          </div>
        </Card>

        {mode === "stream" ? (
          <StreamingResponse
            state={stream.state}
            onRetry={lastPrompt ? () => runStream(lastPrompt) : undefined}
          />
        ) : (
          <AIResponse
            loading={loading}
            error={error}
            onRetry={lastPrompt ? () => void run(lastPrompt) : undefined}
            text={result?.text}
            meta={result?.meta}
            emptyTitle={mode === "plan" ? "No plan yet" : "No analysis yet"}
            emptyDescription={
              mode === "plan"
                ? "Describe a goal and get a validated, step-by-step plan."
                : "Attach a file, write an instruction and press Analyze."
            }
          >
            {result?.plan ? <PlanView plan={result.plan} /> : undefined}
          </AIResponse>
        )}
      </div>

      <AIHistory refreshKey={historyKey} />
    </div>
  );
}
