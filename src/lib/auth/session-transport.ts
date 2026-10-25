export const AUTH_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

export class AuthTransportError extends Error {
  constructor(public status: number) {
    super("Authentication request failed");
  }
}

async function post(path: string, refreshToken: string, timeout: number) {
  return fetch(`${AUTH_API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    signal: AbortSignal.timeout(timeout),
    cache: "no-store",
  });
}

export async function revokeRefreshToken(refreshToken: string) {
  const response = await post("/auth/logout", refreshToken, 8_000);
  // Invalid/expired tokens cannot identify a live chain. 5xx/network failures retry.
  if (!response.ok && ![400, 401, 403].includes(response.status)) {
    throw new AuthTransportError(response.status);
  }
}

export async function rotateRefreshToken(refreshToken: string) {
  const response = await post("/auth/refresh", refreshToken, 45_000);
  if (!response.ok) throw new AuthTransportError(response.status);
  const payload = await response.json();
  if (payload?.success !== true || !payload.data) {
    throw new AuthTransportError(502);
  }
  return {
    accessToken: payload.data.accessToken as string,
    refreshToken: payload.data.refreshToken as string,
  };
}
