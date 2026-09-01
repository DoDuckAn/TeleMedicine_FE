import {
  cloneWeeklySchedule,
  emptyWeeklySchedule,
} from "@/lib/doctor-schedule";
import { formatDate } from "@/lib/format";
import type { UserStatus, WeeklySchedule } from "@/types/api";

export function createEmptyWeeklySchedule(): WeeklySchedule {
  return cloneWeeklySchedule(emptyWeeklySchedule);
}

export function parseMultiline(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function nullableText(value?: string | null) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

export function nextUserStatus(status?: UserStatus): UserStatus {
  return status === "ACTIVE" ? "DISABLED" : "ACTIVE";
}

export function statusActionLabel(status?: UserStatus) {
  return status === "ACTIVE" ? "Khóa tài khoản" : "Mở tài khoản";
}

export function formatStatisticPeriod(
  period: string,
  groupBy: "day" | "month" | "week",
) {
  if (groupBy === "month" && /^\d{4}-\d{2}/.test(period)) {
    return `${period.slice(5, 7)}/${period.slice(0, 4)}`;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(period)) {
    return formatDate(`${period.slice(0, 10)}T00:00:00+07:00`);
  }

  return period;
}
