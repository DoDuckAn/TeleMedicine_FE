"use client";

import { getErrorMessage } from "@/lib/api/error-message";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionMutation } from "@/lib/auth/use-session-mutation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { DoctorShell } from "@/components/doctor/doctor-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import {
  createDoctorScheduleOverride,
  deleteDoctorScheduleOverride,
  getDoctorScheduleCalendar,
  getDoctorScheduleOverrides,
  getDoctorWeeklySchedule,
  restoreDoctorScheduleOverrides,
  updateDoctorWeeklySchedule,
} from "@/lib/api/doctor";
import { getScheduleSettings } from "@/lib/api/settings";
import {
  addDaysToDateOnly,
  calendarSlotMeta,
  cloneWeeklySchedule,
  dateOnlyEndIso,
  dateOnlyStartIso,
  emptyWeeklySchedule,
  getCurrentVietnamWeekStart,
  getWeekStartFromDateOnly,
  nextDefaultRange,
  normalizeWeeklySchedule,
  toMinutes,
  toVietnamOffsetIso,
  validateWeeklySchedule,
  weekdayLabels,
  weekdays,
} from "@/lib/doctor-schedule";
import { useAuthStore } from "@/lib/auth/session-store";
import { formatDate, formatDateTime, formatTimeRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  DoctorScheduleCalendar,
  DoctorScheduleOverride,
  DoctorScheduleOverrideType,
  Weekday,
  WeeklySchedule,
  WeeklyScheduleRange,
} from "@/types/api";

type OverrideForm = {
  endAt: string;
  reason: string;
  startAt: string;
  type: DoctorScheduleOverrideType;
};

const initialOverrideForm: OverrideForm = {
  endAt: "",
  reason: "",
  startAt: "",
  type: "UNAVAILABLE",
};

export function DoctorSchedulePage() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const loginId = useAuthStore((state) => state.loginId);
  const auth = { accessToken: accessToken ?? "", loginId };
  const enabled = Boolean(accessToken);
  const [weekStart, setWeekStart] = useState(getCurrentVietnamWeekStart);
  const [scheduleDraft, setScheduleDraft] = useState<WeeklySchedule | null>(
    null,
  );
  const [overrideForm, setOverrideForm] =
    useState<OverrideForm>(initialOverrideForm);
  const [restoreForm, setRestoreForm] = useState({ endAt: "", startAt: "" });

  const weeklyQuery = useQuery({
    enabled,
    queryFn: () => getDoctorWeeklySchedule(auth),
    queryKey: ["doctor", "schedule", "weekly"],
  });
  const settingsQuery = useQuery({
    queryFn: getScheduleSettings,
    queryKey: ["system", "schedule-settings"],
  });

  const calendarQuery = useQuery({
    enabled,
    queryFn: () => getDoctorScheduleCalendar(weekStart, auth),
    queryKey: ["doctor", "schedule", "calendar", weekStart],
  });

  const overridesQuery = useQuery({
    enabled,
    queryFn: () =>
      getDoctorScheduleOverrides(
        {
          from: dateOnlyStartIso(weekStart),
          to: dateOnlyEndIso(addDaysToDateOnly(weekStart, 6)),
        },
        auth,
      ),
    queryKey: ["doctor", "schedule", "overrides", weekStart],
  });

  const slotDuration = weeklyQuery.data?.slotDurationMinutes ?? 30;
  const workday = {
    endTime: settingsQuery.data?.workdayEndTime ?? "17:00",
    startTime: settingsQuery.data?.workdayStartTime ?? "08:00",
  };
  const serverSchedule = useMemo(
    () =>
      cloneWeeklySchedule(
        weeklyQuery.data?.weeklySchedule ?? emptyWeeklySchedule,
      ),
    [weeklyQuery.data?.weeklySchedule],
  );
  const schedule = scheduleDraft ?? serverSchedule;

  const saveWeeklyMutation = useSessionMutation({
    mutationFn: (nextSchedule: WeeklySchedule) =>
      updateDoctorWeeklySchedule(nextSchedule, auth),
    onError: (error) => {
      console.error(error);
      toast.error(getErrorMessage(error, "Không lưu được lịch tuần."));
    },
    onSuccess: (data) => {
      toast.success("Đã lưu lịch làm việc hằng tuần.");
      setScheduleDraft(cloneWeeklySchedule(data.weeklySchedule));
      invalidateSchedule(queryClient);
    },
  });

  const createOverrideMutation = useSessionMutation({
    mutationFn: (values: OverrideForm) =>
      createDoctorScheduleOverride(
        {
          ranges: [
            {
              endAt: toVietnamOffsetIso(values.endAt),
              startAt: toVietnamOffsetIso(values.startAt),
            },
          ],
          reason: values.reason.trim() || undefined,
          type: values.type,
        },
        auth,
      ),
    onError: (error) => {
      console.error(error);
      toast.error(getErrorMessage(error, "Không tạo được thay đổi lịch."));
    },
    onSuccess: (data) => {
      const suffix = data.cancelledAppointmentCount
        ? ` Đã hủy ${data.cancelledAppointmentCount} lịch bị trùng.`
        : "";
      toast.success(`Đã tạo thay đổi lịch.${suffix}`);
      setOverrideForm(initialOverrideForm);
      invalidateSchedule(queryClient);
    },
  });

  const restoreMutation = useSessionMutation({
    mutationFn: (values: { endAt: string; startAt: string }) =>
      restoreDoctorScheduleOverrides(
        {
          ranges: [
            {
              endAt: toVietnamOffsetIso(values.endAt),
              startAt: toVietnamOffsetIso(values.startAt),
            },
          ],
        },
        auth,
      ),
    onError: (error) => {
      console.error(error);
      toast.error(getErrorMessage(error, "Không khôi phục được lịch gốc."));
    },
    onSuccess: () => {
      toast.success("Đã khôi phục lịch gốc cho khoảng đã chọn.");
      setRestoreForm({ endAt: "", startAt: "" });
      invalidateSchedule(queryClient);
    },
  });

  const deleteOverrideMutation = useSessionMutation({
    mutationFn: (overrideId: string) =>
      deleteDoctorScheduleOverride(overrideId, auth),
    onError: (error) => {
      console.error(error);
      toast.error(getErrorMessage(error, "Không xóa được thay đổi lịch."));
    },
    onSuccess: () => {
      toast.success("Đã xóa thay đổi lịch.");
      invalidateSchedule(queryClient);
    },
  });

  function saveWeeklySchedule() {
    const normalized = normalizeWeeklySchedule(schedule);
    const error = validateWeeklySchedule(normalized, slotDuration, workday);

    if (error) {
      toast.error(error);
      return;
    }

    saveWeeklyMutation.mutate(normalized);
  }

  function createOverride() {
    if (!overrideForm.startAt || !overrideForm.endAt) {
      toast.error("Chọn thời gian bắt đầu và kết thúc.");
      return;
    }

    if (overrideForm.type === "UNAVAILABLE" && !overrideForm.reason.trim()) {
      toast.error("Nhập lý do nghỉ đột xuất.");
      return;
    }

    if (overrideForm.type === "AVAILABLE") {
      const sameDay =
        overrideForm.startAt.slice(0, 10) === overrideForm.endAt.slice(0, 10);
      const start = toMinutes(overrideForm.startAt.slice(11, 16));
      const end = toMinutes(overrideForm.endAt.slice(11, 16));
      if (
        !sameDay ||
        start < toMinutes(workday.startTime) ||
        end > toMinutes(workday.endTime)
      ) {
        toast.error(
          `Lịch bù phải nằm trong giờ làm việc ${workday.startTime} - ${workday.endTime}.`,
        );
        return;
      }
    }

    createOverrideMutation.mutate(overrideForm);
  }

  function restoreOverrideRange() {
    if (!restoreForm.startAt || !restoreForm.endAt) {
      toast.error("Chọn khoảng thời gian cần khôi phục.");
      return;
    }

    restoreMutation.mutate(restoreForm);
  }

  function updateRange(
    weekday: Weekday,
    index: number,
    field: keyof WeeklyScheduleRange,
    value: string,
  ) {
    setScheduleDraft((current) => {
      const base = cloneWeeklySchedule(current ?? schedule);

      return {
        ...base,
        [weekday]: base[weekday].map((range, rangeIndex) =>
          rangeIndex === index ? { ...range, [field]: value } : range,
        ),
      };
    });
  }

  function addRange(weekday: Weekday) {
    setScheduleDraft((current) => {
      const base = cloneWeeklySchedule(current ?? schedule);

      return {
        ...base,
        [weekday]: [...base[weekday], nextDefaultRange(base[weekday], workday)],
      };
    });
  }

  function removeRange(weekday: Weekday, index: number) {
    setScheduleDraft((current) => {
      const base = cloneWeeklySchedule(current ?? schedule);

      return {
        ...base,
        [weekday]: base[weekday].filter(
          (_, rangeIndex) => rangeIndex !== index,
        ),
      };
    });
  }

  function selectWeek(dateOnly: string) {
    if (!dateOnly) return;
    setWeekStart(getWeekStartFromDateOnly(dateOnly));
  }

  return (
    <DoctorShell title="Lịch làm việc">
      <section className="grid gap-6">
        <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <div>
              <p className="text-sm font-semibold uppercase text-primary">
                Quản lý khả dụng
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Lịch làm việc và thay đổi đột xuất
              </h1>
            </div>

            <div
              aria-label="Chọn tuần làm việc"
              className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:w-auto sm:grid-cols-[auto_10rem_auto] xl:shrink-0"
              role="group"
            >
              <Button
                aria-label="Tuần trước"
                className="h-11 w-11 shrink-0 p-0 sm:w-auto sm:px-4"
                onClick={() => setWeekStart(addDaysToDateOnly(weekStart, -7))}
                title="Tuần trước"
                variant="outline"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">Tuần trước</span>
              </Button>
              <Input
                aria-label="Chọn tuần"
                onDateChange={(dateValue) => selectWeek(dateValue)}
                required
                type="date"
                value={weekStart}
              />
              <Button
                aria-label="Tuần sau"
                className="h-11 w-11 shrink-0 p-0 sm:w-auto sm:px-4"
                onClick={() => setWeekStart(addDaysToDateOnly(weekStart, 7))}
                title="Tuần sau"
                variant="outline"
              >
                <span className="hidden sm:inline">Tuần sau</span>
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_420px]">
          <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Lịch tuần mặc định
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Mỗi khung giờ: {slotDuration} phút.
                </p>
              </div>
              <Button
                disabled={saveWeeklyMutation.isPending}
                onClick={saveWeeklySchedule}
                variant="success"
              >
                {saveWeeklyMutation.isPending ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Save aria-hidden="true" className="size-4" />
                )}
                Lưu lịch tuần
              </Button>
            </div>

            <div className="mt-5">
              {weeklyQuery.isLoading ? (
                <LoadingBlock label="Đang tải lịch tuần..." />
              ) : weeklyQuery.isError ? (
                <ErrorState message="Chưa tải được lịch làm việc hằng tuần." />
              ) : (
                <div className="grid gap-3">
                  {weekdays.map((weekday) => (
                    <WeeklyDayEditor
                      key={weekday}
                      onAdd={() => addRange(weekday)}
                      onRemove={(index) => removeRange(weekday, index)}
                      onUpdate={(index, field, value) =>
                        updateRange(weekday, index, field, value)
                      }
                      ranges={schedule[weekday]}
                      weekday={weekday}
                      workday={workday}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <CalendarPlus
                  aria-hidden="true"
                  className="size-5 text-primary"
                />
                Thay đổi lịch
              </h2>
              <div className="mt-5 grid gap-4">
                <Field label="Loại thay đổi">
                  <Select
                    onChange={(event) =>
                      setOverrideForm((current) => ({
                        ...current,
                        type: event.target.value as DoctorScheduleOverrideType,
                      }))
                    }
                    value={overrideForm.type}
                  >
                    <option value="UNAVAILABLE">Nghỉ đột xuất</option>
                    <option value="AVAILABLE">
                      Bù lịch / mở thêm khung giờ
                    </option>
                  </Select>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Bắt đầu">
                    <Input
                      max={
                        overrideForm.type === "AVAILABLE" &&
                        overrideForm.startAt
                          ? `${overrideForm.startAt.slice(0, 10)}T${workday.endTime}`
                          : undefined
                      }
                      min={
                        overrideForm.type === "AVAILABLE" &&
                        overrideForm.startAt
                          ? `${overrideForm.startAt.slice(0, 10)}T${workday.startTime}`
                          : undefined
                      }
                      onDateChange={(dateValue) =>
                        setOverrideForm((current) => ({
                          ...current,
                          startAt: dateValue,
                        }))
                      }
                      type="datetime-local"
                      value={overrideForm.startAt}
                    />
                  </Field>
                  <Field label="Kết thúc">
                    <Input
                      max={
                        overrideForm.type === "AVAILABLE" && overrideForm.endAt
                          ? `${overrideForm.endAt.slice(0, 10)}T${workday.endTime}`
                          : undefined
                      }
                      min={
                        overrideForm.type === "AVAILABLE" && overrideForm.endAt
                          ? `${overrideForm.endAt.slice(0, 10)}T${workday.startTime}`
                          : undefined
                      }
                      onDateChange={(dateValue) =>
                        setOverrideForm((current) => ({
                          ...current,
                          endAt: dateValue,
                        }))
                      }
                      type="datetime-local"
                      value={overrideForm.endAt}
                    />
                  </Field>
                </div>
                <Field
                  hint={
                    overrideForm.type === "UNAVAILABLE"
                      ? "Bắt buộc khi bác sĩ nghỉ đột xuất."
                      : "Có thể để trống nếu chỉ mở thêm lịch."
                  }
                  label="Lý do"
                >
                  <Textarea
                    onChange={(event) =>
                      setOverrideForm((current) => ({
                        ...current,
                        reason: event.target.value,
                      }))
                    }
                    placeholder="Ví dụ: Nghỉ họp chuyên môn..."
                    value={overrideForm.reason}
                  />
                </Field>
                <Button
                  disabled={createOverrideMutation.isPending}
                  onClick={createOverride}
                  variant="success"
                >
                  {createOverrideMutation.isPending ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : (
                    <CalendarPlus aria-hidden="true" className="size-4" />
                  )}
                  Tạo thay đổi lịch
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <RotateCcw aria-hidden="true" className="size-5 text-primary" />
                Khôi phục lịch gốc
              </h2>
              <div className="mt-5 grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Bắt đầu">
                    <Input
                      onDateChange={(dateValue) =>
                        setRestoreForm((current) => ({
                          ...current,
                          startAt: dateValue,
                        }))
                      }
                      type="datetime-local"
                      value={restoreForm.startAt}
                    />
                  </Field>
                  <Field label="Kết thúc">
                    <Input
                      onDateChange={(dateValue) =>
                        setRestoreForm((current) => ({
                          ...current,
                          endAt: dateValue,
                        }))
                      }
                      type="datetime-local"
                      value={restoreForm.endAt}
                    />
                  </Field>
                </div>
                <Button
                  disabled={restoreMutation.isPending}
                  onClick={restoreOverrideRange}
                  variant="outline"
                >
                  {restoreMutation.isPending ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : (
                    <RotateCcw aria-hidden="true" className="size-4" />
                  )}
                  Khôi phục khoảng này
                </Button>
              </div>
            </div>
          </section>
        </div>

        <CalendarPanel
          calendar={calendarQuery.data}
          isError={calendarQuery.isError}
          isLoading={calendarQuery.isLoading}
          weekStart={weekStart}
        />

        <OverridesPanel
          deletingId={deleteOverrideMutation.variables}
          isDeleting={deleteOverrideMutation.isPending}
          isError={overridesQuery.isError}
          isLoading={overridesQuery.isLoading}
          onDelete={(overrideId) => deleteOverrideMutation.mutate(overrideId)}
          overrides={overridesQuery.data?.items ?? []}
        />
      </section>
    </DoctorShell>
  );
}

function WeeklyDayEditor({
  onAdd,
  onRemove,
  onUpdate,
  ranges,
  weekday,
  workday,
}: {
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (
    index: number,
    field: keyof WeeklyScheduleRange,
    value: string,
  ) => void;
  ranges: WeeklyScheduleRange[];
  weekday: Weekday;
  workday: { endTime: string; startTime: string };
}) {
  return (
    <div className="rounded-lg border border-blue-100 bg-slate-50 p-4">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h3 className="font-bold text-slate-900">{weekdayLabels[weekday]}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {ranges.length ? `${ranges.length} khoảng làm việc` : "Nghỉ"}
          </p>
        </div>
        <Button onClick={onAdd} size="sm" variant="outline">
          <Plus aria-hidden="true" className="size-4" />
          Thêm giờ
        </Button>
      </div>

      {ranges.length ? (
        <div className="mt-4 grid gap-3">
          {ranges.map((range, index) => (
            <div
              className="grid gap-3 rounded-lg border border-blue-100 bg-white p-3 sm:grid-cols-[1fr_1fr_auto]"
              key={`${weekday}-${index}`}
            >
              <Field label="Bắt đầu">
                <Input
                  max={workday.endTime}
                  min={workday.startTime}
                  onChange={(event) =>
                    onUpdate(index, "startTime", event.target.value)
                  }
                  type="time"
                  value={range.startTime}
                />
              </Field>
              <Field label="Kết thúc">
                <Input
                  max={workday.endTime}
                  min={workday.startTime}
                  onChange={(event) =>
                    onUpdate(index, "endTime", event.target.value)
                  }
                  type="time"
                  value={range.endTime}
                />
              </Field>
              <Button
                className="self-end"
                onClick={() => onRemove(index)}
                size="sm"
                variant="outline"
              >
                <Trash2 aria-hidden="true" className="size-4" />
                Xóa
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CalendarPanel({
  calendar,
  isError,
  isLoading,
  weekStart,
}: {
  calendar?: DoctorScheduleCalendar;
  isError: boolean;
  isLoading: boolean;
  weekStart: string;
}) {
  return (
    <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <CalendarClock aria-hidden="true" className="size-6 text-primary" />
            Ma trận tuần
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tuần bắt đầu {formatDate(`${weekStart}T00:00:00+07:00`)}
          </p>
        </div>
        <Link
          className={buttonVariants({ size: "sm", variant: "outline" })}
          href="/doctor/appointments"
        >
          Xem lịch tư vấn
        </Link>
      </div>

      <div className="mt-5">
        {isLoading ? (
          <LoadingBlock label="Đang tải lịch tuần..." />
        ) : isError ? (
          <ErrorState message="Chưa tải được ma trận lịch tuần." />
        ) : calendar?.days.length ? (
          <div className="grid gap-3 lg:grid-cols-7">
            {calendar.days.map((day) => (
              <div
                className="min-w-0 rounded-lg border border-blue-100 bg-slate-50 p-3"
                key={day.date}
              >
                <p className="font-bold text-slate-900">
                  {weekdayLabels[day.weekday]}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(`${day.date}T00:00:00+07:00`)}
                </p>

                <div className="mt-3 grid gap-2">
                  {day.slots.length ? (
                    day.slots.map((slot) => {
                      const meta = calendarSlotMeta(slot);
                      const patientName =
                        slot.appointment?.patient?.fullName ?? "Bệnh nhân";

                      return (
                        <div
                          className={cn(
                            "rounded-md border px-2.5 py-2 text-xs font-semibold",
                            meta.className,
                          )}
                          key={`${slot.startAt}-${slot.endAt}`}
                        >
                          <p>{formatTimeRange(slot.startAt, slot.endAt)}</p>
                          <p className="mt-1">{meta.label}</p>
                          {slot.appointment ? (
                            <Link
                              className="mt-1 block truncate underline underline-offset-2"
                              href={
                                slot.appointment.status ===
                                "PENDING_CONFIRMATION"
                                  ? "/doctor/requests"
                                  : `/doctor/appointments/${slot.appointment.id}`
                              }
                            >
                              {patientName}
                            </Link>
                          ) : null}
                          {slot.override?.reason ? (
                            <p className="mt-1 line-clamp-2 font-medium">
                              {slot.override.reason}
                            </p>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <p className="rounded-md border border-dashed border-border bg-white px-3 py-4 text-center text-xs font-semibold text-muted-foreground">
                      Không có khung giờ
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            description="Chưa có lịch làm việc trong tuần này."
            title="Chưa có lịch làm việc"
          />
        )}
      </div>
    </section>
  );
}

function OverridesPanel({
  deletingId,
  isDeleting,
  isError,
  isLoading,
  onDelete,
  overrides,
}: {
  deletingId?: string;
  isDeleting: boolean;
  isError: boolean;
  isLoading: boolean;
  onDelete: (overrideId: string) => void;
  overrides: DoctorScheduleOverride[];
}) {
  return (
    <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-bold text-slate-900">
        Thay đổi lịch trong tuần
      </h2>

      <div className="mt-5">
        {isLoading ? (
          <LoadingBlock label="Đang tải thay đổi lịch..." />
        ) : isError ? (
          <ErrorState message="Chưa tải được danh sách thay đổi lịch." />
        ) : overrides.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {overrides.map((override) => (
              <article
                className="rounded-lg border border-blue-100 bg-slate-50 p-4"
                key={override.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-bold",
                      override.type === "AVAILABLE"
                        ? "bg-green-50 text-green-700"
                        : "bg-slate-200 text-slate-700",
                    )}
                  >
                    {override.type === "AVAILABLE" ? "Bù lịch" : "Nghỉ"}
                  </span>
                  <Button
                    disabled={isDeleting}
                    onClick={() => onDelete(override.id)}
                    size="sm"
                    variant="outline"
                  >
                    {isDeleting && deletingId === override.id ? (
                      <Loader2
                        aria-hidden="true"
                        className="size-4 animate-spin"
                      />
                    ) : (
                      <Trash2 aria-hidden="true" className="size-4" />
                    )}
                    Xóa
                  </Button>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  {formatDateTime(override.startAt)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  đến {formatDateTime(override.endAt)}
                </p>
                {override.reason ? (
                  <p className="mt-3 text-sm leading-6 text-slate-700">
                    {override.reason}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            description="Các khoảng nghỉ hoặc bù lịch trong tuần đã chọn sẽ nằm ở đây."
            title="Chưa có thay đổi lịch"
          />
        )}
      </div>
    </section>
  );
}

function invalidateSchedule(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["doctor", "schedule"] });
  queryClient.invalidateQueries({ queryKey: ["doctor", "appointments"] });
  queryClient.invalidateQueries({ queryKey: ["public", "doctor"] });
}
