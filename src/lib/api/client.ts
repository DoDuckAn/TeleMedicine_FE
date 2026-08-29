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
  params?: Record<string, QueryValue>;
};

const API_BASE_URL =
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
  { accessToken, headers, params, body, ...init }: ApiRequestOptions = {},
) {
  const requestHeaders = new Headers(headers);

  if (!(body instanceof FormData) && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (accessToken) {
    requestHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(buildUrl(path, params), {
    ...init,
    body,
    headers: requestHeaders,
  });

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

