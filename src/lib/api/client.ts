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

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

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

  let response = await fetch(buildUrl(path, params), {
    ...init,
    body: requestBody,
    headers: requestHeaders,
  });

  if (response.status === 401 && accessToken && path !== "/auth/refresh") {
    const session = useAuthStore.getState();
    if (session.accessToken) {
      const nextToken =
        session.accessToken !== accessToken
          ? session.accessToken
          : await refreshAccessToken();
      if (nextToken) {
        requestHeaders.set("Authorization", `Bearer ${nextToken}`);
        response = await fetch(buildUrl(path, params), {
          ...init,
          body: requestBody,
          headers: requestHeaders,
        });
      }
    }
  }

  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !payload.success) {
    const error = payload.success
      ? {
          code: "HTTP_ERROR",
          message: response.statusText,
        }
      : payload.error;

    throw new ApiError(response.status, error);
  }

  return payload.data;
}

let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  const session = useAuthStore.getState();
  if (!session.refreshToken || !session.user) {
    session.clearSession();
    return null;
  }
  refreshPromise = (async () => {
    const response = await fetch(buildUrl("/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    const payload = (await response.json()) as ApiEnvelope<{
      accessToken: string;
      refreshToken: string;
    }>;
    // Ignore refresh responses belonging to a session that has since logged out or changed.
    if (useAuthStore.getState().refreshToken !== session.refreshToken)
      return null;
    if (!response.ok || !payload.success) {
      if (response.status === 401 || response.status === 403)
        session.clearSession();
      throw new ApiError(
        response.status,
        payload.success
          ? { code: "REFRESH_FAILED", message: response.statusText }
          : payload.error,
      );
    }
    useAuthStore
      .getState()
      .setSession({ ...payload.data, user: session.user! });
    return payload.data.accessToken;
  })();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}
import { useAuthStore } from "@/lib/auth/session-store";
