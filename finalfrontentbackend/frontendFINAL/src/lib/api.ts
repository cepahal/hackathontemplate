import { API_BASE_URL, API_TIMEOUT_MS, API_V1_PREFIX } from "@/lib/constants";
import { createClient } from "@/lib/supabase/browser";
import type { ApiError, HealthResponse } from "@/types";
import type {
  Profile,
  Project,
  ProjectInsert,
  ProjectStatus,
  ProjectUpdate,
  Task,
  TaskInsert,
  TaskUpdate,
} from "@/types/database";
import type {
  EmailResult,
  GeocodeResult,
  GitHubRepository,
  GitHubSearchParams,
  GitHubSearchResult,
  IntegrationStatus,
  NotificationInput,
  TestEmailInput,
} from "@/types/integrations";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions extends Omit<RequestInit, "method" | "body" | "signal"> {
  /**
   * Sent as `Authorization: Bearer <token>`. In the browser it defaults to the signed-in user's
   * Supabase access token. On the server pass it explicitly (`getAccessToken()` from
   * `@/lib/auth`). `null` sends no token. Never store tokens in module state.
   */
  token?: string | null;
  /** Set to false for public endpoints so no token is looked up or sent. Defaults to true. */
  auth?: boolean;
  query?: QueryParams;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export class ApiRequestError extends Error implements ApiError {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor({ status, message, code, details }: ApiError) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

export function buildUrl(path: string, query?: QueryParams): string {
  if (/^[a-z][a-z\d+\-.]*:/i.test(path) || path.startsWith("//")) {
    throw new ApiRequestError({
      status: 0,
      code: "INVALID_PATH",
      message: `api only accepts paths relative to NEXT_PUBLIC_API_URL, got "${path}".`,
    });
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${API_BASE_URL}${normalizedPath}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

function isRawBody(body: unknown): body is BodyInit {
  return (
    typeof body === "string" ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof Blob ||
    body instanceof ArrayBuffer
  );
}

export async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) {
    return undefined;
  }

  const text = await response.text();
  if (text.length === 0) {
    return undefined;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return text;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiRequestError({
      status: response.status,
      code: "INVALID_JSON",
      message: `Server returned malformed JSON (status ${response.status}).`,
      details: text.slice(0, 500),
    });
  }
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Status info shared by fetch's Response and XMLHttpRequest. */
interface ResponseStatus {
  status: number;
  statusText?: string;
}

function extractErrorMessage(data: unknown, response: ResponseStatus): string {
  if (typeof data === "string" && data.trim().length > 0) {
    return data.trim().slice(0, 300);
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const nested = readErrorObject(record);
    const nestedMessage = nested && readString(nested, "message");
    if (nestedMessage) {
      return nestedMessage;
    }

    const detail = record.detail;

    if (typeof detail === "string" && detail.length > 0) {
      return detail;
    }

    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) =>
          item && typeof item === "object"
            ? readString(item as Record<string, unknown>, "msg")
            : undefined,
        )
        .filter((msg): msg is string => Boolean(msg));
      if (messages.length > 0) {
        return messages.join("; ");
      }
    }

    const message = readString(record, "message") ?? readString(record, "error");
    if (message) {
      return message;
    }
  }

  return `Request failed with status ${response.status}${
    response.statusText ? ` (${response.statusText})` : ""
  }.`;
}

/** The backend's error envelope: `{ "error": { "code": "...", "message": "..." } }`. */
function readErrorObject(record: Record<string, unknown>): Record<string, unknown> | undefined {
  const error = record.error;
  return error && typeof error === "object" && !Array.isArray(error)
    ? (error as Record<string, unknown>)
    : undefined;
}

function extractErrorCode(data: unknown): string | undefined {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const nested = readErrorObject(record);
    return (nested && readString(nested, "code")) ?? readString(record, "code");
  }
  return undefined;
}

export async function resolveToken(
  token: string | null | undefined,
  auth: boolean,
): Promise<string | null> {
  if (token !== undefined) {
    return token;
  }
  if (!auth || typeof window === "undefined") {
    return null;
  }
  const { data, error } = await createClient().auth.getSession();
  if (error) {
    throw new ApiRequestError({
      status: 401,
      code: "SESSION_ERROR",
      message: `Could not read your session: ${error.message}`,
    });
  }
  return data.session?.access_token ?? null;
}

/** Builds the ApiRequestError for a non-2xx response from its parsed body. */
export function apiErrorFromResponse(data: unknown, response: ResponseStatus): ApiRequestError {
  return new ApiRequestError({
    status: response.status,
    message: extractErrorMessage(data, response),
    code: extractErrorCode(data),
    details: data,
  });
}

async function request<TResponse>(
  method: HttpMethod,
  path: string,
  body: unknown,
  options: RequestOptions = {},
): Promise<TResponse> {
  const {
    token,
    auth = true,
    query,
    timeoutMs = API_TIMEOUT_MS,
    signal,
    headers,
    ...init
  } = options;
  const url = buildUrl(path, query);
  const bearerToken = await resolveToken(token, auth);

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const forwardAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", forwardAbort, { once: true });
    }
  }

  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has("Accept")) {
    requestHeaders.set("Accept", "application/json");
  }
  if (bearerToken) {
    requestHeaders.set("Authorization", `Bearer ${bearerToken}`);
  }

  let requestBody: BodyInit | undefined;
  if (body !== undefined) {
    if (isRawBody(body)) {
      requestBody = body;
    } else {
      requestBody = JSON.stringify(body);
      if (!requestHeaders.has("Content-Type")) {
        requestHeaders.set("Content-Type", "application/json");
      }
    }
  }

  try {
    const response = await fetch(url, {
      ...init,
      method,
      headers: requestHeaders,
      body: requestBody,
      signal: controller.signal,
    });

    const data = await parseResponseBody(response);

    if (!response.ok) {
      throw apiErrorFromResponse(data, response);
    }

    // Responses are trusted to match TResponse; add runtime validation for untrusted APIs.
    return data as TResponse;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw error;
    }
    if (timedOut) {
      throw new ApiRequestError({
        status: 408,
        code: "TIMEOUT",
        message: `${method} ${path} timed out after ${timeoutMs}ms.`,
      });
    }
    if (signal?.aborted) {
      throw new ApiRequestError({
        status: 0,
        code: "ABORTED",
        message: `${method} ${path} was cancelled.`,
      });
    }
    throw new ApiRequestError({
      status: 0,
      code: "NETWORK_ERROR",
      message: `Could not reach the API at ${API_BASE_URL}. Check that the backend is running and allows requests from this origin (CORS).`,
      details: error instanceof Error ? error.message : error,
    });
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", forwardAbort);
  }
}

export const api = {
  get<TResponse>(path: string, options?: RequestOptions): Promise<TResponse> {
    return request<TResponse>("GET", path, undefined, options);
  },
  post<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: RequestOptions,
  ): Promise<TResponse> {
    return request<TResponse>("POST", path, body, options);
  },
  put<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: RequestOptions,
  ): Promise<TResponse> {
    return request<TResponse>("PUT", path, body, options);
  },
  patch<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    options?: RequestOptions,
  ): Promise<TResponse> {
    return request<TResponse>("PATCH", path, body, options);
  },
  delete<TResponse = void>(path: string, options?: RequestOptions): Promise<TResponse> {
    return request<TResponse>("DELETE", path, undefined, options);
  },
};

/** Task bodies for the backend: project_id comes from the URL and cannot be sent or changed. */
export type TaskCreateInput = Omit<TaskInsert, "project_id">;
export type TaskUpdateInput = Omit<TaskUpdate, "project_id">;

export interface ListProjectsParams {
  status?: ProjectStatus;
  limit?: number;
  offset?: number;
}

export interface ListTasksParams {
  completed?: boolean;
  limit?: number;
  offset?: number;
}

const id = (value: string) => encodeURIComponent(value);

/**
 * Typed client for the FastAPI backend (`/api/v1`). Every call except `health` sends the user's
 * bearer token; the backend derives identity from it and only returns the caller's own data.
 */
export const backendApi = {
  health: (options?: RequestOptions) =>
    api.get<HealthResponse>(`${API_V1_PREFIX}/health`, { ...options, auth: false }),

  me: (options?: RequestOptions) => api.get<Profile>(`${API_V1_PREFIX}/me`, options),

  projects: {
    list: (params: ListProjectsParams = {}, options?: RequestOptions) =>
      api.get<Project[]>(`${API_V1_PREFIX}/projects`, {
        ...options,
        query: { ...params },
      }),
    get: (projectId: string, options?: RequestOptions) =>
      api.get<Project>(`${API_V1_PREFIX}/projects/${id(projectId)}`, options),
    create: (body: ProjectInsert, options?: RequestOptions) =>
      api.post<Project, ProjectInsert>(`${API_V1_PREFIX}/projects`, body, options),
    update: (projectId: string, body: ProjectUpdate, options?: RequestOptions) =>
      api.patch<Project, ProjectUpdate>(`${API_V1_PREFIX}/projects/${id(projectId)}`, body, options),
    remove: (projectId: string, options?: RequestOptions) =>
      api.delete(`${API_V1_PREFIX}/projects/${id(projectId)}`, options),
  },

  tasks: {
    list: (projectId: string, params: ListTasksParams = {}, options?: RequestOptions) =>
      api.get<Task[]>(`${API_V1_PREFIX}/projects/${id(projectId)}/tasks`, {
        ...options,
        query: { ...params },
      }),
    create: (projectId: string, body: TaskCreateInput, options?: RequestOptions) =>
      api.post<Task, TaskCreateInput>(
        `${API_V1_PREFIX}/projects/${id(projectId)}/tasks`,
        body,
        options,
      ),
    update: (taskId: string, body: TaskUpdateInput, options?: RequestOptions) =>
      api.patch<Task, TaskUpdateInput>(`${API_V1_PREFIX}/tasks/${id(taskId)}`, body, options),
    remove: (taskId: string, options?: RequestOptions) =>
      api.delete(`${API_V1_PREFIX}/tasks/${id(taskId)}`, options),
  },

  /** Provider keys stay on the backend; these routes only expose fixed, validated operations. */
  integrations: {
    status: (options?: RequestOptions) =>
      api.get<IntegrationStatus>(`${API_V1_PREFIX}/integrations/status`, options),
    githubRepository: (owner: string, repo: string, options?: RequestOptions) =>
      api.get<GitHubRepository>(
        `${API_V1_PREFIX}/integrations/github/repos/${id(owner)}/${id(repo)}`,
        options,
      ),
    githubSearch: (params: GitHubSearchParams, options?: RequestOptions) =>
      api.get<GitHubSearchResult>(`${API_V1_PREFIX}/integrations/github/search`, {
        ...options,
        query: { ...params },
      }),
    geocode: (q: string, limit?: number, options?: RequestOptions) =>
      api.get<GeocodeResult[]>(`${API_V1_PREFIX}/integrations/maps/geocode`, {
        ...options,
        query: { q, limit },
      }),
    sendTestEmail: (body: TestEmailInput, options?: RequestOptions) =>
      api.post<EmailResult, TestEmailInput>(`${API_V1_PREFIX}/integrations/email/test`, body, options),
    notify: (body: NotificationInput, options?: RequestOptions) =>
      api.post<void, NotificationInput>(`${API_V1_PREFIX}/integrations/notifications`, body, options),
  },
};
