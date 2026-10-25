import { useAuthStore } from "@/lib/auth/session-store";
import {
  readStoredSession,
  refreshSession,
  syncSessionFromStorage,
  type StoredSession,
} from "@/lib/auth/session-coordinator";
import { sameLogin } from "@/lib/auth/session-core";
import {
  AUTH_API_BASE_URL,
  AuthTransportError,
} from "@/lib/auth/session-transport";

export type ApiErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiEnvelope<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: ApiErrorPayload;
    };

export class ApiError extends Error {
  retryAfterMs?: number;
  code: string;
  status: number;
  details?: unknown;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message);
    this.name = "ApiError";
    this.status = status;
    this.code = payload.code;
    this.details = payload.details;
  }
}

type QueryValue = string | number | boolean | null | undefined;

export type ApiRequestOptions = Omit<RequestInit, "headers"> & {
  accessToken?: string;
  headers?: HeadersInit;
  json?: unknown;
  params?: Record<string, QueryValue>;
};

export const API_BASE_URL = AUTH_API_BASE_URL;

function buildUrl(path: string, params?: Record<string, QueryValue>) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${API_BASE_URL}${normalizedPath}`);

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url;
}

export async function apiFetch<T>(
  path: string,
  { accessToken, headers, json, params, body, ...init }: ApiRequestOptions = {},
) {
  // Bind the entire request, including retries and response delivery, to one login.
  const requestSession = accessToken
    ? captureRequestSession(accessToken)
    : null;
  const requestHeaders = new Headers(headers);
  const requestBody = json === undefined ? body : JSON.stringify(json);

  if (
    !(requestBody instanceof FormData) &&
    !requestHeaders.has("Content-Type")
  ) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (accessToken) {
    requestHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  let response = await timedFetch(buildUrl(path, params), {
    ...init,
    body: requestBody,
    headers: requestHeaders,
  });
  assertRequestSession(requestSession);

  if (response.status === 401 && accessToken && path !== "/auth/refresh") {
    const nextToken = requestSession
      ? await refreshAccessToken(requestSession)
      : null;
    assertRequestSession(requestSession);
    if (nextToken) {
      requestHeaders.set("Authorization", `Bearer ${nextToken}`);
      response = await timedFetch(buildUrl(path, params), {
        ...init,
        body: requestBody,
        headers: requestHeaders,
      });
    }
  }

  const payload = await readEnvelope<T>(response);
  assertRequestSession(requestSession);

  if (!response.ok || !payload.success) {
    const error = payload.success
      ? {
          code: "HTTP_ERROR",
          message: response.statusText,
        }
      : payload.error;

    const apiError = new ApiError(response.status, error);
    apiError.retryAfterMs = retryAfterMs(response);
    throw apiError;
  }

  return payload.data;
}

function sessionChanged() {
  syncSessionFromStorage();
  return new ApiError(401, {
    code: "SESSION_CHANGED",
    message: "Phiên đăng nhập đã thay đổi. Vui lòng thử lại.",
  });
}

function captureRequestSession(accessToken: string): StoredSession {
  const memory = useAuthStore.getState();
  const stored = readStoredSession();
  if (
    !memory.loginId ||
    memory.accessToken !== accessToken ||
    !memory.refreshToken ||
    !memory.user
  ) {
    throw sessionChanged();
  }
  const expected: StoredSession = {
    accessToken,
    refreshToken: memory.refreshToken,
    user: memory.user,
    loginId: memory.loginId,
    version: memory.version,
  };
  if (!sameLogin(stored, expected)) throw sessionChanged();
  return expected;
}

function assertRequestSession(expected: StoredSession | null) {
  if (expected && !sameLogin(readStoredSession(), expected))
    throw sessionChanged();
}

export async function refreshAccessToken(expected?: StoredSession) {
  const token = useAuthStore.getState().accessToken;
  if (!expected && !token) return null;
  const session = expected ?? captureRequestSession(token!);
  try {
    return await refreshSession(session);
  } catch (error) {
    throw new ApiError(error instanceof AuthTransportError ? error.status : 0, {
      code: "REFRESH_FAILED",
      message: "Không thể làm mới phiên đăng nhập. Vui lòng thử lại.",
    });
  }
}

function retryAfterMs(response: Response) {
  const value = response.headers.get("Retry-After");
  if (!value) return undefined;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(value) - Date.now();
  return Number.isFinite(delay) ? Math.max(0, delay) : undefined;
}

async function timedFetch(url: URL, init: RequestInit) {
  const timeout = AbortSignal.timeout(45_000);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;
  try {
    return await fetch(url, { ...init, signal });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new ApiError(0, {
      code: timeout.aborted ? "REQUEST_TIMEOUT" : "NETWORK_ERROR",
      message: timeout.aborted
        ? "Yêu cầu quá thời gian chờ."
        : "Không kết nối được máy chủ.",
    });
  }
}

async function readEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    /* Proxy responses may not be JSON. */
  }
  if (
    payload &&
    typeof payload === "object" &&
    "success" in payload &&
    ((payload.success === true && "data" in payload) ||
      (payload.success === false &&
        "error" in payload &&
        payload.error &&
        typeof payload.error === "object" &&
        "message" in payload.error &&
        "code" in payload.error))
  ) {
    return payload as ApiEnvelope<T>;
  }
  const error = new ApiError(response.ok ? 502 : response.status, {
    code: "INVALID_SERVER_RESPONSE",
    message: "Máy chủ tạm thời không phản hồi hợp lệ.",
  });
  error.retryAfterMs = retryAfterMs(response);
  throw error;
}

export function shouldRetryQuery(failureCount: number, error: Error) {
  if (failureCount >= 2) return false;
  if (!(error instanceof ApiError)) return false;
  if (error.status === 429)
    return error.retryAfterMs !== undefined && error.retryAfterMs <= 30_000;
  return [0, 502, 503, 504].includes(error.status);
}

export function queryRetryDelay(attempt: number, error: Error) {
  const delay = Math.min(1000 * 2 ** attempt, 10_000) + Math.random() * 300;
  return error instanceof ApiError
    ? Math.max(error.retryAfterMs ?? 0, delay)
    : delay;
}
