import { appointmentStatusMeta } from "@/lib/appointment-status";
import type {
  AppointmentStatus,
  DoctorScheduleCalendarSlot,
  Weekday,
  WeeklySchedule,
  WeeklyScheduleRange,
} from "@/types/api";

export const VI_TIMEZONE_OFFSET = "+07:00";

export const weekdays: Weekday[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export const weekdayLabels: Record<Weekday, string> = {
  FRIDAY: "Thứ sáu",
  MONDAY: "Thứ hai",
  SATURDAY: "Thứ bảy",
  SUNDAY: "Chủ nhật",
  THURSDAY: "Thứ năm",
  TUESDAY: "Thứ ba",
  WEDNESDAY: "Thứ tư",
};

export const emptyWeeklySchedule: WeeklySchedule = {
  FRIDAY: [],
  MONDAY: [],
  SATURDAY: [],
  SUNDAY: [],
  THURSDAY: [],
  TUESDAY: [],
  WEDNESDAY: [],
};

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function cloneWeeklySchedule(schedule?: WeeklySchedule): WeeklySchedule {
  return weekdays.reduce<WeeklySchedule>(
    (next, weekday) => {
      next[weekday] = [...(schedule?.[weekday] ?? [])].map((range) => ({
        endTime: range.endTime,
        startTime: range.startTime,
      }));

      return next;
    },
    { ...emptyWeeklySchedule },
  );
}

export function normalizeWeeklySchedule(
  schedule: WeeklySchedule,
): WeeklySchedule {
  return weekdays.reduce<WeeklySchedule>(
    (next, weekday) => {
      next[weekday] = schedule[weekday]
        .map((range) => ({
          endTime: range.endTime.trim(),
          startTime: range.startTime.trim(),
        }))
        .filter((range) => range.startTime && range.endTime)
        .sort(
          (left, right) =>
            toMinutes(left.startTime) - toMinutes(right.startTime),
        );

      return next;
    },
    { ...emptyWeeklySchedule },
  );
}

export function validateWeeklySchedule(
  schedule: WeeklySchedule,
  slotDurationMinutes: number,
  workday?: { endTime: string; startTime: string },
) {
  for (const weekday of weekdays) {
    const ranges = schedule[weekday];

    for (let index = 0; index < ranges.length; index += 1) {
      const range = ranges[index]!;

      if (
        !timePattern.test(range.startTime) ||
        !timePattern.test(range.endTime)
      ) {
        return `${weekdayLabels[weekday]} có khung giờ chưa hợp lệ.`;
      }

      const start = toMinutes(range.startTime);
      const end = toMinutes(range.endTime);

      if (end <= start) {
        return `${weekdayLabels[weekday]} có giờ kết thúc không lớn hơn giờ bắt đầu.`;
      }

      if (
        workday &&
        (start < toMinutes(workday.startTime) ||
          end > toMinutes(workday.endTime))
      ) {
        return `${weekdayLabels[weekday]} phải nằm trong giờ làm việc ${workday.startTime} - ${workday.endTime}.`;
      }

      if (
        start % slotDurationMinutes !== 0 ||
        end % slotDurationMinutes !== 0
      ) {
        return `${weekdayLabels[weekday]} phải chia theo slot ${slotDurationMinutes} phút.`;
      }

      const previous = ranges[index - 1];
      if (previous && start < toMinutes(previous.endTime)) {
        return `${weekdayLabels[weekday]} có khung giờ bị chồng nhau.`;
      }
    }
  }

  return null;
}

export function toMinutes(time: string) {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

export function getCurrentVietnamWeekStart() {
  return getWeekStartFromDateOnly(todayInVietnamDateOnly());
}

export function todayInVietnamDateOnly() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

export function getWeekStartFromDateOnly(dateOnly: string) {
  const weekday = getIsoWeekday(dateOnly);

  return addDaysToDateOnly(dateOnly, -(weekday - 1));
}

export function addDaysToDateOnly(dateOnly: string, days: number) {
  const date = dateOnlyToUtcDate(dateOnly);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

export function toVietnamOffsetIso(datetimeLocal: string) {
  if (!datetimeLocal) {
    return "";
  }

  const value =
    datetimeLocal.length === 16 ? `${datetimeLocal}:00` : datetimeLocal;

  return `${value}${VI_TIMEZONE_OFFSET}`;
}

export function dateOnlyStartIso(dateOnly: string) {
  return `${dateOnly}T00:00:00${VI_TIMEZONE_OFFSET}`;
}

export function dateOnlyEndIso(dateOnly: string) {
  return `${addDaysToDateOnly(dateOnly, 1)}T00:00:00${VI_TIMEZONE_OFFSET}`;
}

export function nextDefaultRange(
  ranges: WeeklyScheduleRange[],
  workday = { endTime: "17:00", startTime: "08:00" },
) {
  const latest = ranges.at(-1)?.endTime ?? workday.startTime;
  const latestStart = Math.max(toMinutes(latest), toMinutes(workday.startTime));
  const endLimit = toMinutes(workday.endTime);
  const startMinutes = Math.min(latestStart, endLimit - 30);
  const endMinutes = Math.min(startMinutes + 60, endLimit);

  return {
    endTime: minutesToTime(endMinutes),
    startTime: minutesToTime(startMinutes),
  };
}

export function calendarSlotMeta(slot: DoctorScheduleCalendarSlot) {
  if (slot.status === "AVAILABLE") {
    return {
      className: "border-green-200 bg-green-50 text-green-700",
      label: slot.isBookable ? "Trống" : "Đã qua",
    };
  }

  if (slot.status === "UNAVAILABLE") {
    return {
      className: "border-slate-200 bg-slate-100 text-slate-500",
      label: "Nghỉ",
    };
  }

  const meta = appointmentStatusMeta[slot.status as AppointmentStatus];

  return {
    className: "border-blue-200 bg-blue-50 text-primary",
    label: meta?.label ?? slot.status,
  };
}

function minutesToTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");

  return `${hours}:${minutes}`;
}

function getIsoWeekday(dateOnly: string) {
  const weekday = dateOnlyToUtcDate(dateOnly).getUTCDay();

  return weekday === 0 ? 7 : weekday;
}

function dateOnlyToUtcDate(dateOnly: string) {
  const [year = 1970, month = 1, day = 1] = dateOnly.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}
