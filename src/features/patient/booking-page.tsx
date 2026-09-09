"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Clock,
  Loader2,
  ShieldCheck,
  CircleCheck,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import DatePicker from "react-datepicker";
import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { toast } from "sonner";
import { z } from "zod";

import { PatientShell } from "@/components/patient/patient-shell";
import { BookingProgress } from "@/components/patient/booking-progress";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
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
  const queryClient = useQueryClient();
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
      setSelectedSlot(null);
      void scheduleQuery.refetch();
    },
    onSuccess: () => {
      toast.success("Đã gửi yêu cầu đặt lịch. Vui lòng chờ bác sĩ xác nhận.");
      void queryClient.invalidateQueries({
        queryKey: ["public", "doctor", doctorId, "schedule"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["patient", "appointments"],
      });
    },
  });

  function selectDate(date: string) {
    setSelectedDate(date);
    setSelectedSlot(null);
  }

  function submit(values: BookingForm) {
    if (createMutation.isPending || createMutation.isSuccess) return;
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

  if (createMutation.isSuccess) {
    const appointment = createMutation.data;
    return (
      <PatientShell title="Đặt lịch hẹn">
        <BookingProgress step={3} />
        <div className="mb-5">
          <Link
            href="/patient/doctors"
            className={buttonVariants({
              variant: "outline",
              className: "bg-white shadow-sm",
            })}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Quay về tìm bác sĩ
          </Link>
        </div>
        <section className="mx-auto max-w-2xl border-t-4 border-green-600 bg-white px-5 py-8 shadow-sm sm:px-10">
          <p className="mb-6 text-center text-xs font-bold uppercase text-slate-500">
            Phiếu xác nhận yêu cầu đặt lịch
          </p>
          <CircleCheck
            aria-hidden="true"
            className="mx-auto size-14 text-green-600"
          />
          <h1
            className="mt-5 text-center text-2xl font-bold text-slate-900"
            tabIndex={-1}
            ref={(node) => node?.focus()}
          >
            Đặt lịch thành công
          </h1>
          <p className="mt-3 text-center text-slate-600" role="status">
            Yêu cầu đã được gửi. Vui lòng chờ bác sĩ xác nhận lịch hẹn.
          </p>
          <dl className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
            {[
              ["Mã lịch hẹn", appointment.id],
              ["Bác sĩ", doctor?.fullName ?? "Bác sĩ đã chọn"],
              ["Chuyên khoa", specialties],
              ["Ngày khám", formatDate(appointment.startAt)],
              [
                "Giờ khám",
                formatTimeRange(appointment.startAt, appointment.endAt),
              ],
              ["Trạng thái", "Chờ bác sĩ xác nhận"],
              ["Lý do khám", appointment.visitReason],
            ].map(([label, value]) => (
              <div
                key={label}
                className="grid gap-1 py-3 sm:grid-cols-[140px_1fr]"
              >
                <dt className="text-sm text-slate-500">{label}</dt>
                <dd className="break-words font-medium text-slate-900">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href={`/patient/appointments/${appointment.id}`}
              className={buttonVariants({ variant: "outline" })}
            >
              Xem lịch hẹn
            </Link>
            <Link
              href="/patient/doctors"
              className={buttonVariants({ variant: "success" })}
            >
              <CircleCheck className="size-4" />
              Hoàn tất
            </Link>
          </div>
        </section>
      </PatientShell>
    );
  }

  return (
    <PatientShell title="Đặt lịch khám">
      <BookingProgress step={2} />
      <div className="mb-5">
        <Link
          className={buttonVariants({
            variant: "outline",
            className: "bg-white shadow-sm",
          })}
          href="/patient/doctors"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Quay lại danh sách bác sĩ
        </Link>
      </div>

      <div className="space-y-6">
        <header className="border-b border-slate-200 bg-white px-5 py-7 text-center sm:px-8">
          <h1 className="text-2xl font-bold text-slate-900">
            Chọn lịch khám phù hợp
          </h1>
          <p className="mx-auto mt-3 max-w-2xl leading-7 text-slate-600">
            Chọn ngày khám, khung giờ còn trống và nhập lý do khám trước khi xác
            nhận đặt lịch.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-amber-800">
            Sau khi gửi yêu cầu, hệ thống giữ khung giờ trong 15 phút để chờ bác
            sĩ xác nhận. Lịch hẹn chỉ được xác nhận sau khi bác sĩ đồng ý.
          </p>
        </header>

        <section className="min-w-0 bg-white px-4 py-6 sm:px-8 lg:px-10">
          <div>
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
                    disabled={createMutation.isPending}
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
                  <div className="max-h-80 overflow-y-auto pr-2">
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
                                    : "border-slate-300 bg-slate-100 text-slate-700 hover:border-slate-500 hover:bg-slate-200",
                                )}
                                aria-pressed={
                                  currentSlot?.startAt === slot.startAt
                                }
                                key={slot.startAt}
                                disabled={createMutation.isPending}
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
                  </div>
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
                disabled={createMutation.isPending}
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
                {createMutation.isPending
                  ? "Đang đặt lịch..."
                  : "Xác nhận đặt lịch"}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </PatientShell>
  );
}
