const DEFAULT_MODEL = "gemini-3.8-flash";
const MAX_INPUT_CHARS = 4_000;
const MAX_REPLY_CHARS = 2_000;
const MAX_TURNS = 6;
const MAX_CONVERSATIONS = 100;
const HISTORY_TTL_MS = 30 * 60_000;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RESPONSE_BYTES = 256_000;

export const TRANSPORT_REPLY = "Photon transport check passed. Gemini is not configured; this is a fixed reply.";
const UNAVAILABLE_REPLY = "I couldn't get a Gemini response. Please try again shortly.";

type Turn = { role: "user" | "model"; parts: { text: string }[] };
type Conversation = { turns: Turn[]; updatedAt: number };

type AgentOptions = {
  apiKey?: string;
  model?: string;
  fetch?: typeof globalThis.fetch;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseText(value: unknown): string | undefined {
  if (!record(value) || !Array.isArray(value.candidates)) return;
  const candidate: unknown = value.candidates[0];
  if (!record(candidate) || !["STOP", "MAX_TOKENS"].includes(String(candidate.finishReason))) return;
  if (!record(candidate.content) || !Array.isArray(candidate.content.parts)) return;
  return candidate.content.parts
    .filter((part: unknown): part is Record<string, unknown> => record(part))
    .filter((part) => typeof part.text === "string" && part.thought !== true)
    .map((part) => part.text as string)
    .join("")
    .trim()
    .slice(0, MAX_REPLY_CHARS) || undefined;
}

async function readResponse(response: Response): Promise<unknown> {
  if (!response.body) throw new Error("Empty response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw new Error("Response too large");
      chunks.push(value);
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    throw new Error("Could not read response");
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

/** In-memory text only. No tools, account access, or application side effects. */
export function createTextAgent(options: AgentOptions = {}) {
  const apiKey = options.apiKey?.trim();
  const model = options.model?.trim() || DEFAULT_MODEL;
  if (!/^gemini-[a-zA-Z0-9._-]+$/.test(model)) {
    throw new Error("GEMINI_MODEL must be a Gemini model ID, not a URL or path.");
  }
  const request = options.fetch ?? globalThis.fetch;
  const conversations = new Map<string, Conversation>();

  return {
    mode: apiKey ? "gemini" as const : "transport" as const,
    async reply(conversationId: string, input: string): Promise<string> {
      const text = input.trim();
      if (!text) return "Please send a text message.";
      if (text.length > MAX_INPUT_CHARS) return `Please keep your message to ${MAX_INPUT_CHARS} characters or fewer.`;
      if (!apiKey) return TRANSPORT_REPLY;

      const now = Date.now();
      for (const [id, conversation] of conversations) {
        if (now - conversation.updatedAt >= HISTORY_TTL_MS) conversations.delete(id);
      }
      const history = conversations.get(conversationId)?.turns ?? [];
      const userTurn: Turn = { role: "user", parts: [{ text }] };
      try {
        const response = await request(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          redirect: "error",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: "You are a helpful text assistant. Reply concisely in plain text. You have no tools and cannot access accounts or perform transactions. Do not claim to have performed actions." }] },
            contents: [...history, userTurn],
            generationConfig: { maxOutputTokens: 1_024 },
          }),
        });
        if (!response.ok) {
          await response.body?.cancel().catch(() => undefined);
          return UNAVAILABLE_REPLY;
        }
        const reply = responseText(await readResponse(response));
        if (!reply) return UNAVAILABLE_REPLY;
        const modelTurn: Turn = { role: "model", parts: [{ text: reply }] };
        conversations.delete(conversationId);
        conversations.set(conversationId, {
          turns: [...history, userTurn, modelTurn].slice(-MAX_TURNS * 2),
          updatedAt: Date.now(),
        });
        if (conversations.size > MAX_CONVERSATIONS) {
          const oldest = conversations.keys().next().value;
          if (oldest !== undefined) conversations.delete(oldest);
        }
        return reply;
      } catch {
        // Provider errors may contain keys or message content. Never expose or log them.
        return UNAVAILABLE_REPLY;
      }
    },
  };
}
