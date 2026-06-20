/** Shared API contract types mirroring the FastAPI backend envelopes. */

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/** Consistent error envelope returned by the backend exception middleware. */
export interface ApiErrorResponse {
  error: ApiError;
}

export interface HealthResponse {
  status: "ok";
  service: string;
  version: string;
  timestamp: string;
}

export interface SystemInfo {
  service: string;
  version: string;
  environment: string;
  phase: number;
}

export interface SystemStatus {
  uptimeSeconds: number;
  online: boolean;
  connections: number;
}
