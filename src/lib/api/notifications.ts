import type {
  NotificationItem,
  NotificationPreferences,
  PaginatedResponse,
  PushDevicePlatform,
} from "@/types/api";

import { apiFetch } from "./client";
import type { AuthenticatedOptions } from "./patient";

export type NotificationListParams = {
  limit?: number;
  page?: number;
  unreadOnly?: boolean;
};

export type RegisterDevicePayload = {
  platform: PushDevicePlatform;
  token: string;
};

export type PatchNotificationPreferencesPayload = {
  channels?: Partial<NotificationPreferences["channels"]>;
  events?: Partial<NotificationPreferences["events"]>;
};

export function getNotifications(
  params: NotificationListParams | undefined,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<PaginatedResponse<NotificationItem>>("/notifications", {
    accessToken,
    params,
  });
}

export function getUnreadNotificationCount({
  accessToken,
}: AuthenticatedOptions) {
  return apiFetch<{ count: number }>("/notifications/unread-count", {
    accessToken,
  });
}

export function markNotificationRead(
  notificationId: string,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<NotificationItem>(`/notifications/${notificationId}/read`, {
    accessToken,
    method: "PATCH",
  });
}

export function markAllNotificationsRead({
  accessToken,
}: AuthenticatedOptions) {
  return apiFetch<{ updatedCount: number }>("/notifications/read-all", {
    accessToken,
    method: "PATCH",
  });
}

export function getNotificationPreferences({
  accessToken,
}: AuthenticatedOptions) {
  return apiFetch<NotificationPreferences>("/notifications/preferences", {
    accessToken,
  });
}

export function updateNotificationPreferences(
  payload: PatchNotificationPreferencesPayload,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<NotificationPreferences>("/notifications/preferences", {
    accessToken,
    json: payload,
    method: "PATCH",
  });
}

export function registerPushDevice(
  payload: RegisterDevicePayload,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<{ id: string; platform: PushDevicePlatform; time?: string }>(
    "/notifications/devices",
    {
      accessToken,
      json: payload,
      method: "POST",
    },
  );
}

export function removePushDevice(
  token: string,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<{ removed: boolean }>("/notifications/devices", {
    accessToken,
    json: { token },
    method: "DELETE",
  });
}
