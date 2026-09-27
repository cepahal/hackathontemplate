export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

export type HealthResponse = {
  status: "ok";
  service: "hackathon-api";
  environment: string;
  version: string;
};

export type HealthResult = {
  data: HealthResponse;
  latency: number;
  checkedAt: Date;
};

function isHealthResponse(value: unknown): value is HealthResponse {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return (
    data.status === "ok" &&
    data.service === "hackathon-api" &&
    typeof data.environment === "string" &&
    typeof data.version === "string"
  );
}

export async function checkHealth(signal?: AbortSignal): Promise<HealthResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), 8_000);
  const cancel = () => controller.abort("cancelled");
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();

  const started = performance.now();
  try {
    const response = await fetch(`${API_URL}/health`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok)
      throw new Error(
        `The API returned HTTP ${response.status}. Check the backend terminal for details.`,
      );
    const data: unknown = await response.json();
    if (!isHealthResponse(data))
      throw new Error(
        "The API replied, but its health response did not match the expected format.",
      );
    return {
      data,
      latency: Math.round(performance.now() - started),
      checkedAt: new Date(),
    };
  } catch (error) {
    if (controller.signal.aborted && controller.signal.reason === "timeout") {
      throw new Error(
        "The API did not respond within 8 seconds. Confirm the backend is running, then try again.",
      );
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Could not reach the API. Start the backend and check its URL and allowed frontend origins.",
      );
    }
    if (error instanceof SyntaxError) {
      throw new Error(
        "The API returned a response that was not valid JSON. Confirm this is the backend health endpoint.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}
