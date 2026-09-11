import type { SystemScheduleSettings } from "@/types/api";

import { apiFetch } from "./client";
import type { AuthenticatedOptions } from "./patient";

export function getScheduleSettings() {
  return apiFetch<SystemScheduleSettings>("/settings/schedule");
}

export function updateScheduleSettings(
  payload: Pick<
    SystemScheduleSettings,
    "version" | "workdayEndTime" | "workdayStartTime"
  >,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<SystemScheduleSettings>("/admin/settings/schedule", {
    accessToken,
    json: payload,
    method: "PUT",
  });
}
