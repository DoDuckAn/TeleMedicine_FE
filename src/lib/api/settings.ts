import type {
  AdminSystemSettings,
  IntegrationSecretKey,
  SystemScheduleSettings,
} from "@/types/api";

import { apiFetch } from "./client";
import type { AuthenticatedOptions } from "./patient";

export function getScheduleSettings() {
  return apiFetch<SystemScheduleSettings>("/settings/schedule");
}

export function getAdminSystemSettings({ accessToken }: AuthenticatedOptions) {
  return apiFetch<AdminSystemSettings>("/admin/settings", { accessToken });
}

export function saveAdminSystemSettings(
  payload: {
    credentials?: Partial<Record<IntegrationSecretKey, string | null>>;
    currentPassword: string;
    schedule?: {
      workdayEndTime: string;
      workdayStartTime: string;
    };
    version: number;
  },
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<AdminSystemSettings>("/admin/settings", {
    accessToken,
    json: payload,
    method: "PUT",
  });
}
