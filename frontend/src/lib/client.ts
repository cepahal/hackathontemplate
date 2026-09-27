import { API_URL } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function authorizedFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const client = getSupabase();
  if (!client)
    throw new ApiError(
      "Setup required: configure Supabase authentication first.",
      503,
    );
  const { data, error } = await client.auth.getSession();
  if (error || !data.session)
    throw new ApiError("Your session has expired. Sign in again.", 401);
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${data.session.access_token}`);
  if (options.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      cache: "no-store",
      signal: options.signal ?? AbortSignal.timeout(90_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(
      "Could not reach the API. Check the backend connection and try again.",
      0,
    );
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const detail =
      body && typeof body === "object" && "detail" in body
        ? body.detail
        : body && typeof body === "object" && "error" in body
          ? body.error
          : null;
    const message =
      typeof detail === "string"
        ? detail
        : detail && typeof detail === "object" && "message" in detail
          ? String(detail.message)
          : `Request failed (${response.status}).`;
    throw new ApiError(
      response.status === 503 ? `Setup required: ${message}` : message,
      response.status,
    );
  }
  return response;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await authorizedFetch(path, options);
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}

export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The request could not be completed.";
}

export type Project = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};
export type Identity = { id: string; email: string | null; role: string };
export type Provider = "openai" | "anthropic" | "gemini";
export type ChatMessage = { role: "user" | "assistant"; content: string };
export type Usage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  estimated_cost_usd?: number | null;
};

export { readEventStream } from "./stream";
