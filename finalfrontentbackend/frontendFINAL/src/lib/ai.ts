/**
 * Client for the FastAPI AI endpoints (`/api/v1/ai`). Provider keys never reach the browser:
 * every call goes to our backend with the user's Supabase token.
 *
 * - JSON calls (generate, structured, history, providers) reuse `api` from `@/lib/api`.
 * - `streamText` reads the SSE stream with fetch + ReadableStream (EventSource can't POST or send
 *   an Authorization header) and handles cancel, idle timeout, malformed events and early EOF.
 * - `uploadForAnalysis` uses XMLHttpRequest because fetch has no upload-progress events.
 * - `validateFile` mirrors the backend checks for fast feedback; the backend stays authoritative.
 */
import {
  api,
  ApiRequestError,
  apiErrorFromResponse,
  buildUrl,
  parseResponseBody,
  resolveToken,
  type RequestOptions,
} from "@/lib/api";
import { API_V1_PREFIX } from "@/lib/constants";
import type {
  AIFileKind,
  AIProviderInfo,
  AIStreamEvent,
  GenerateInput,
  GenerationRecord,
  HistoryParams,
  StructuredGeneration,
  StructuredInput,
  TextGeneration,
} from "@/types/ai";
import type { AIProvider } from "@/types/integrations";

const AI_PREFIX = `${API_V1_PREFIX}/ai`;

/** Defaults of the backend's AI_MAX_PROMPT_CHARS / AI_MAX_FILE_BYTES; the server enforces its own. */
export const AI_MAX_PROMPT_CHARS = 20_000;
export const AI_MAX_FILE_BYTES = 5 * 1024 * 1024;
/** LLM calls are slower than CRUD; matches the backend's provider timeout plus one retry. */
export const AI_REQUEST_TIMEOUT_MS = 120_000;
/** Fail a stream that sends nothing for this long (the backend's overall limit is 120 s). */
export const AI_STREAM_IDLE_TIMEOUT_MS = 60_000;

export const aiApi = {
  providers: (options?: RequestOptions) => api.get<AIProviderInfo[]>(`${AI_PREFIX}/providers`, options),

  generate: (body: GenerateInput, options?: RequestOptions) =>
    api.post<TextGeneration, GenerateInput>(`${AI_PREFIX}/generate`, body, {
      timeoutMs: AI_REQUEST_TIMEOUT_MS,
      ...options,
    }),

  generateStructured: (body: StructuredInput, options?: RequestOptions) =>
    api.post<StructuredGeneration, StructuredInput>(`${AI_PREFIX}/structured`, body, {
      timeoutMs: AI_REQUEST_TIMEOUT_MS,
      ...options,
    }),

  history: (params: HistoryParams = {}, options?: RequestOptions) =>
    api.get<GenerationRecord[]>(`${AI_PREFIX}/history`, { ...options, query: { ...params } }),
};

// --- streaming ------------------------------------------------------------------------------

export interface StreamOptions {
  signal?: AbortSignal;
  idleTimeoutMs?: number;
}

const STREAM_EVENTS = new Set(["start", "delta", "done", "error"]);

function streamError(code: string, message: string, status = 0): ApiRequestError {
  return new ApiRequestError({ status, code, message });
}

function parseEvent(block: string): AIStreamEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line === "" || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
  }
  if (data.length === 0) return null;
  if (!STREAM_EVENTS.has(event)) {
    throw streamError("MALFORMED_STREAM", `Unexpected stream event "${event.slice(0, 40)}".`);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(data.join("\n"));
  } catch {
    throw streamError("MALFORMED_STREAM", "The AI stream sent malformed data.");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw streamError("MALFORMED_STREAM", "The AI stream sent malformed data.");
  }
  const record = payload as Record<string, unknown>;
  if (event === "delta" && typeof record.text !== "string") {
    throw streamError("MALFORMED_STREAM", "The AI stream sent malformed data.");
  }
  return { event, data: record } as AIStreamEvent;
}

/**
 * POST /ai/stream and yield events as they arrive. Ends after `done`; throws `ApiRequestError`
 * for HTTP errors, an `error` event (code from the backend), cancellation (`ABORTED`), idle
 * timeout (`TIMEOUT`), malformed events (`MALFORMED_STREAM`) or a connection that closes
 * without `done` (`STREAM_INTERRUPTED`).
 */
export async function* streamText(
  input: GenerateInput,
  { signal, idleTimeoutMs = AI_STREAM_IDLE_TIMEOUT_MS }: StreamOptions = {},
): AsyncGenerator<AIStreamEvent, void, undefined> {
  const token = await resolveToken(undefined, true);
  const controller = new AbortController();
  let timedOut = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const armIdleTimer = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, idleTimeoutMs);
  };
  const forwardAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", forwardAbort, { once: true });

  const headers = new Headers({ Accept: "text/event-stream", "Content-Type": "application/json" });
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let reader: ReadableStreamDefaultReader<string> | undefined;
  try {
    armIdleTimer();
    const response = await fetch(buildUrl(`${AI_PREFIX}/stream`), {
      method: "POST",
      headers,
      body: JSON.stringify(input),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      throw apiErrorFromResponse(await parseResponseBody(response), response);
    }
    if (!response.body || !(response.headers.get("content-type") ?? "").includes("text/event-stream")) {
      throw streamError("MALFORMED_STREAM", "The server did not return an event stream.", response.status);
    }

    reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      armIdleTimer();
      buffer += value.replace(/\r\n?/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const event = parseEvent(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
        if (!event) continue;
        if (event.event === "error") {
          throw streamError(event.data.code, event.data.message);
        }
        yield event;
        if (event.event === "done") return;
      }
    }
    throw streamError("STREAM_INTERRUPTED", "The connection closed before the response finished.");
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    if (timedOut) throw streamError("TIMEOUT", "The AI stopped responding. Please try again.", 408);
    if (signal?.aborted) throw streamError("ABORTED", "Generation cancelled.");
    throw streamError(
      "NETWORK_ERROR",
      "Lost connection to the API while streaming. Check that the backend is running.",
    );
  } finally {
    clearTimeout(idleTimer);
    signal?.removeEventListener("abort", forwardAbort);
    // Closing the reader cancels the HTTP response; the backend records the stream as cancelled.
    reader?.cancel().catch(() => undefined);
    controller.abort();
  }
}

// --- uploads ----------------------------------------------------------------------------------

export interface UploadProgress {
  loaded: number;
  total: number;
  /** 0–100 */
  percent: number;
}

export interface UploadOptions {
  provider?: AIProvider | null;
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
  timeoutMs?: number;
}

/** POST a file + instruction as multipart/form-data to /ai/analyze-image or /ai/analyze-file. */
export async function uploadForAnalysis(
  target: "image" | "file",
  file: File,
  prompt: string,
  { provider, signal, onProgress, timeoutMs = AI_REQUEST_TIMEOUT_MS }: UploadOptions = {},
): Promise<TextGeneration> {
  const token = await resolveToken(undefined, true);
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("prompt", prompt);
  if (provider) form.append("provider", provider);

  return new Promise<TextGeneration>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", buildUrl(`${AI_PREFIX}/analyze-${target}`));
    xhr.timeout = timeoutMs;
    xhr.setRequestHeader("Accept", "application/json");
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    const onAbort = () => xhr.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const settle = (fn: () => void) => {
      signal?.removeEventListener("abort", onAbort);
      fn();
    };

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percent: Math.round((event.loaded / event.total) * 100),
        });
      }
    };
    xhr.onload = () => {
      let data: unknown = xhr.responseText;
      try {
        data = xhr.responseText ? (JSON.parse(xhr.responseText) as unknown) : undefined;
      } catch {
        // Non-JSON bodies (e.g. a proxy error page) are reported as text below.
      }
      if (xhr.status >= 200 && xhr.status < 300 && data && typeof data === "object") {
        settle(() => resolve(data as TextGeneration));
      } else {
        settle(() => reject(apiErrorFromResponse(data, xhr)));
      }
    };
    xhr.onerror = () =>
      settle(() => reject(streamError("NETWORK_ERROR", "Upload failed: could not reach the API.")));
    xhr.ontimeout = () =>
      settle(() => reject(streamError("TIMEOUT", "The upload timed out. Please try again.", 408)));
    xhr.onabort = () => settle(() => reject(streamError("ABORTED", "Upload cancelled.")));

    if (signal?.aborted) {
      settle(() => reject(streamError("ABORTED", "Upload cancelled.")));
      return;
    }
    xhr.send(form);
  });
}

// --- client-side file validation ---------------------------------------------------------------

const EXTENSIONS: Record<string, { kind: AIFileKind; mediaType: string }> = {
  txt: { kind: "text", mediaType: "text/plain" },
  md: { kind: "text", mediaType: "text/markdown" },
  png: { kind: "image", mediaType: "image/png" },
  jpg: { kind: "image", mediaType: "image/jpeg" },
  jpeg: { kind: "image", mediaType: "image/jpeg" },
  webp: { kind: "image", mediaType: "image/webp" },
  gif: { kind: "image", mediaType: "image/gif" },
  pdf: { kind: "pdf", mediaType: "application/pdf" },
};

export function acceptAttribute(kinds: readonly AIFileKind[]): string {
  return Object.entries(EXTENSIONS)
    .filter(([, info]) => kinds.includes(info.kind))
    .map(([ext]) => `.${ext}`)
    .join(",");
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function sniff(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  return null;
}

export type FileValidation =
  | { ok: true; kind: AIFileKind; mediaType: string }
  | { ok: false; error: string };

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Extension allowlist + size + magic bytes (never the extension or browser MIME type alone). */
export async function validateFile(
  file: File,
  allowedKinds: readonly AIFileKind[],
  maxBytes = AI_MAX_FILE_BYTES,
): Promise<FileValidation> {
  const extension = file.name.includes(".") ? (file.name.split(".").pop() ?? "").toLowerCase() : "";
  const declared = EXTENSIONS[extension];
  if (!declared || !allowedKinds.includes(declared.kind)) {
    return { ok: false, error: `Unsupported file type. Allowed: ${acceptAttribute(allowedKinds)}` };
  }
  if (file.size === 0) return { ok: false, error: "The file is empty." };
  if (file.size > maxBytes) {
    return { ok: false, error: `File is ${formatBytes(file.size)}; the limit is ${formatBytes(maxBytes)}.` };
  }

  const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  const sniffed = sniff(head);
  if (declared.kind === "text") {
    if (sniffed !== null || head.includes(0)) {
      return { ok: false, error: "This doesn't look like a text file." };
    }
  } else if (sniffed !== declared.mediaType) {
    return { ok: false, error: "The file content doesn't match its extension." };
  }
  return { ok: true, kind: declared.kind, mediaType: declared.mediaType };
}
