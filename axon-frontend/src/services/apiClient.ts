import { env } from "@/utils/env";
import type { ApiErrorResponse } from "@/types/api";
import { getAccessToken } from "./supabaseClient";

/** Error thrown by the API client; carries a normalized code + message. */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skip attaching the auth bearer token (for public endpoints). */
  skipAuth?: boolean;
}

async function request<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const { body, skipAuth, headers, ...rest } = options;

  const finalHeaders = new Headers(headers);
  finalHeaders.set("Content-Type", "application/json");

  if (!skipAuth) {
    const token = await getAccessToken();
    if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  const init: RequestInit = { ...rest, headers: finalHeaders };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, init);
  } catch (cause) {
    // Network failure (offline, DNS, CORS, server down)
    throw new ApiClientError(0, "network_error", "Network request failed", cause);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    const err = (data as ApiErrorResponse | null)?.error;
    throw new ApiClientError(
      response.status,
      err?.code ?? "http_error",
      err?.message ?? response.statusText,
      err?.details,
    );
  }

  return data as TResponse;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
};
