import type {
  NotificationItem,
  NotificationPreferences,
  PaginatedResponse,
  PushDevicePlatform,
} from "@/types/api";

import { API_BASE_URL, apiFetch } from "./client";
import type { AuthenticatedOptions } from "./patient";
import { readStoredSession } from "@/lib/auth/session-coordinator";
import { sameVersion } from "@/lib/auth/session-core";

export type NotificationListParams = {
  limit?: number;
  page?: number;
  unreadOnly?: boolean;
};

export type RegisterDevicePayload = {
  platform: "WEB";
  token: string;
  refreshToken: string;
  installationId: string;
  receiptSecret: string;
};

export type PushReceipt = { bindingId: string; deliveryId: string };
export type ResolvedPush = {
  title: string;
  body: string;
  url: "/notifications";
  notificationId: string;
};

export type PatchNotificationPreferencesPayload = {
  channels?: Partial<NotificationPreferences["channels"]>;
  events?: Partial<NotificationPreferences["events"]>;
};

export function getNotifications(
  params: NotificationListParams | undefined,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<PaginatedResponse<NotificationItem>>("/notifications", {
    accessToken,
    loginId,
    params,
  });
}

export function getUnreadNotificationCount({
  accessToken,
  loginId,
}: AuthenticatedOptions) {
  return apiFetch<{ count: number }>("/notifications/unread-count", {
    accessToken,
    loginId,
  });
}

export function markNotificationRead(
  notificationId: string,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<NotificationItem>(`/notifications/${notificationId}/read`, {
    accessToken,
    loginId,
    method: "PATCH",
  });
}

export function markAllNotificationsRead({
  accessToken,
  loginId,
}: AuthenticatedOptions) {
  return apiFetch<{ updatedCount: number }>("/notifications/read-all", {
    accessToken,
    loginId,
    method: "PATCH",
  });
}

export function getNotificationPreferences({
  accessToken,
  loginId,
}: AuthenticatedOptions) {
  return apiFetch<NotificationPreferences>("/notifications/preferences", {
    accessToken,
    loginId,
  });
}

export function updateNotificationPreferences(
  payload: PatchNotificationPreferencesPayload,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<NotificationPreferences>("/notifications/preferences", {
    accessToken,
    loginId,
    json: payload,
    method: "PATCH",
  });
}

export function registerPushDevice(
  payload: RegisterDevicePayload,
  auth: AuthenticatedOptions,
) {
  return pushDeviceRequest<{
    id: string;
    platform: PushDevicePlatform;
    lastRegisteredAt: string;
  }>("POST", payload, auth);
}

export function removePushDevice(
  payload: { token: string; refreshToken: string },
  auth: AuthenticatedOptions,
) {
  return pushDeviceRequest<{ removed: boolean }>("DELETE", payload, auth);
}

// These run inside the auth lock. Automatic refresh/retry would re-enter that lock
// and could pair a rotated bearer with an obsolete refreshToken in the body.
async function pushDeviceRequest<T>(
  method: "POST" | "DELETE",
  payload: RegisterDevicePayload | { token: string; refreshToken: string },
  { accessToken, loginId }: AuthenticatedOptions,
): Promise<T> {
  const session = readStoredSession();
  if (
    !loginId ||
    !session ||
    session.loginId !== loginId ||
    session.accessToken !== accessToken ||
    session.refreshToken !== payload.refreshToken
  )
    throw new Error("Push session changed.");
  const response = await fetch(`${API_BASE_URL}/notifications/devices`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
  });
  const result = await response.json();
  if (!sameVersion(readStoredSession(), session))
    throw new Error("Push session changed.");
  if (!response.ok || result?.success !== true) {
    throw new Error("Push device request failed.");
  }
  return result.data as T;
}
