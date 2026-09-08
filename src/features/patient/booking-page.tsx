"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Loader2,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import DatePicker from "react-datepicker";
import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";
import { z } from "zod";

import { PatientShell } from "@/components/patient/patient-shell";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { DoctorAvatar } from "@/features/doctors/doctor-avatar";
import { getDoctor, getDoctorSchedule } from "@/lib/api/public";
import { createAppointment } from "@/lib/api/patient";
import { useAuthStore } from "@/lib/auth/session-store";
import { formatDate, formatTime, formatTimeRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DoctorAvailabilitySlot } from "@/types/api";

const bookingSchema = z.object({
  visitReason: z
    .string()
    .min(10, "Lý do khám tối thiểu 10 ký tự")
    .max(500, "Lý do khám tối đa 500 ký tự"),
});

type BookingForm = z.infer<typeof bookingSchema>;

export function BookingPage({ doctorId }: { doctorId: string }) {
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const auth = { accessToken: accessToken ?? "" };
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] =
    useState<DoctorAvailabilitySlot | null>(null);

  const doctorQuery = useQuery({
    enabled: Boolean(doctorId),
    queryFn: () => getDoctor(doctorId),
    queryKey: ["public", "doctor", doctorId],
  });

  const scheduleQuery = useQuery({
    enabled: Boolean(doctorId),
    queryFn: () => getDoctorSchedule(doctorId),
    queryKey: ["public", "doctor", doctorId, "schedule"],
  });

  const form = useForm<BookingForm>({
    defaultValues: {
      visitReason: "",
    },
    resolver: zodResolver(bookingSchema),
  });

  const days = useMemo(
    () => scheduleQuery.data?.days ?? [],
    [scheduleQuery.data?.days],
  );
  const activeDay = useMemo(() => {
    if (!days.length) {
      return undefined;
    }

    return (
      days.find((day) => day.date === selectedDate) ??
      days.find((day) => day.slots.length > 0) ??
      days[0]
    );
  }, [days, selectedDate]);

  const availableSlots = activeDay?.slots ?? [];
  const currentSlot = availableSlots.find(
    (slot) => slot.startAt === selectedSlot?.startAt,
  );
  const slotGroups = [
    {
      label: "Buổi sáng",
      slots: availableSlots.filter(
        (slot) => Number(formatTime(slot.startAt).slice(0, 2)) < 12,
      ),
    },
    {
      label: "Buổi chiều",
      slots: availableSlots.filter(
        (slot) => Number(formatTime(slot.startAt).slice(0, 2)) >= 12,
      ),
    },
  ];

  const createMutation = useMutation({
    mutationFn: (values: BookingForm) => {
      if (!currentSlot) {
        throw new Error("NO_SLOT");
      }

      return createAppointment(
        {
          doctorId,
          startAt: currentSlot.startAt,
          visitReason: values.visitReason,
        },
        auth,
      );
    },
    onError: (error) => {
      console.error(error);
      toast.error("Không đặt được lịch. Slot có thể đã được người khác chọn.");
    },
    onSuccess: (appointment) => {
      toast.success("Đã gửi yêu cầu đặt lịch. Vui lòng chờ bác sĩ xác nhận.");
      router.push(`/patient/appointments/${appointment.id}`);
    },
  });

  function selectDate(date: string) {
    setSelectedDate(date);
    setSelectedSlot(null);
  }

  function submit(values: BookingForm) {
    if (!currentSlot) {
      toast.error("Vui lòng chọn khung giờ khám.");
      return;
    }

    createMutation.mutate(values);
  }

  const doctor = doctorQuery.data;
  const specialties =
    doctor?.specialties?.map((specialty) => specialty.name).join(", ") ??
    "Bác sĩ chuyên khoa";

  return (
    <PatientShell title="Đặt lịch khám">
      <div className="mb-5">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
          href="/patient/doctors"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Quay lại danh sách bác sĩ
        </Link>
      </div>

      <div className="space-y-6">
        <aside className="flex flex-wrap items-center gap-5 border-b border-blue-100 pb-5">
          {doctorQuery.isLoading ? (
            <LoadingBlock label="Đang tải bác sĩ..." />
          ) : doctorQuery.isError || !doctor ? (
            <ErrorState message="Không tải được thông tin bác sĩ." />
          ) : (
            <>
              <div className="size-24 shrink-0 overflow-hidden rounded-lg border border-blue-100 bg-blue-50">
                <DoctorAvatar alt={doctor.fullName} src={doctor.avatarUrl} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center gap-2 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-primary">
                  <Stethoscope aria-hidden="true" className="size-3.5" />
                  {specialties}
                </span>
                <h2 className="mt-3 text-2xl font-bold text-slate-900">
                  {doctor.fullName}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {doctor.bio ?? "Thông tin giới thiệu đang được cập nhật."}
                </p>
              </div>
            </>
          )}

          <div className="w-full border-l-4 border-amber-300 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
            Sau khi gửi yêu cầu, hệ thống giữ slot 15 phút ở trạng thái chờ bác
            sĩ xác nhận.
          </div>
        </aside>

        <section className="min-w-0 bg-white py-5">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-primary">
              <CalendarDays aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold uppercase text-primary">
                Chọn thời gian
              </p>
              <h1 className="text-2xl font-bold text-slate-900">
                Lịch trống trong 7 ngày tới
              </h1>
            </div>
          </div>

          <div className="mt-6">
            {scheduleQuery.isLoading ? (
              <LoadingBlock label="Đang tải lịch trống..." />
            ) : scheduleQuery.isError ? (
              <ErrorState message="Chưa tải được lịch trống của bác sĩ." />
            ) : days.length ? (
              <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
                <div className="booking-calendar min-w-0">
                  <h2 className="mb-3 text-lg font-bold text-slate-900">
                    Chọn ngày khám
                  </h2>
                  <DatePicker
                    inline
                    locale={vi}
                    selected={activeDay ? parseISO(activeDay.date) : null}
                    onChange={(date: Date | null) => {
                      if (date) selectDate(format(date, "yyyy-MM-dd"));
                    }}
                    includeDates={days
                      .filter((day) => day.slots.length > 0)
                      .map((day) => parseISO(day.date))}
                    minDate={parseISO(days[0].date)}
                    maxDate={parseISO(days[days.length - 1].date)}
                    calendarClassName="vi-calendar"
                    previousMonthAriaLabel="Tháng trước"
                    nextMonthAriaLabel="Tháng sau"
                  />
                </div>

                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                    <Clock aria-hidden="true" className="size-5 text-primary" />
                    Khung giờ{" "}
                    {activeDay
                      ? formatDate(`${activeDay.date}T00:00:00+07:00`)
                      : ""}
                  </h2>
                  {slotGroups.map((group) => (
                    <div className="mt-4" key={group.label}>
                      <h3 className="mb-2 text-sm font-semibold text-slate-700">
                        {group.label}
                      </h3>
                      {group.slots.length ? (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                          {group.slots.map((slot) => (
                            <button
                              className={cn(
                                "min-h-11 rounded border px-2 py-2 text-sm font-semibold transition",
                                currentSlot?.startAt === slot.startAt
                                  ? "border-green-600 bg-green-600 text-white"
                                  : "border-blue-100 bg-white text-slate-700 hover:border-primary hover:text-primary",
                              )}
                              aria-pressed={
                                currentSlot?.startAt === slot.startAt
                              }
                              key={slot.startAt}
                              onClick={() => setSelectedSlot(slot)}
                              type="button"
                            >
                              {formatTimeRange(slot.startAt, slot.endAt)}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="py-3 text-sm text-muted-foreground">
                          Không còn khung giờ trống.
                        </p>
                      )}
                    </div>
                  ))}
                  <div
                    role="status"
                    aria-live="polite"
                    className={cn(
                      "mt-5 rounded px-4 py-3 text-center text-sm font-semibold",
                      currentSlot
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-50 text-amber-800",
                    )}
                  >
                    {currentSlot
                      ? `Quý khách đang đặt hẹn vào lúc ${formatTimeRange(currentSlot.startAt, currentSlot.endAt)} ngày ${formatDate(currentSlot.startAt)}`
                      : "Vui lòng chọn giờ khám."}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                description="Bác sĩ hiện chưa có lịch trống trong 7 ngày tới."
                title="Chưa có lịch trống"
              />
            )}
          </div>

          <form
            className="mt-6 border-t border-blue-100 pt-5"
            onSubmit={form.handleSubmit(submit)}
          >
            <Field
              error={form.formState.errors.visitReason?.message}
              hint="Thông tin này sẽ hiển thị cho bác sĩ trước buổi tư vấn."
              label="Lý do khám"
            >
              <Textarea
                placeholder="Mô tả triệu chứng, thời gian xuất hiện, thuốc đang dùng..."
                {...form.register("visitReason")}
              />
            </Field>

            <div className="mt-5 flex flex-col justify-between gap-3 rounded-lg bg-slate-50 p-4 md:flex-row md:items-center">
              <div className="text-sm">
                <p className="font-bold text-slate-900">Tóm tắt lịch hẹn</p>
                <p className="mt-1 text-muted-foreground">
                  {currentSlot
                    ? `${formatDate(currentSlot.startAt)}, ${formatTimeRange(
                        currentSlot.startAt,
                        currentSlot.endAt,
                      )}`
                    : "Chưa chọn khung giờ"}
                </p>
              </div>
              <Button
                disabled={!currentSlot || createMutation.isPending}
                type="submit"
                variant="success"
              >
                {createMutation.isPending ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <ShieldCheck aria-hidden="true" className="size-4" />
                )}
                Xác nhận đặt lịch
              </Button>
            </div>
          </form>
        </section>
      </div>
    </PatientShell>
  );
}
