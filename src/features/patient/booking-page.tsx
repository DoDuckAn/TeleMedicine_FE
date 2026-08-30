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
import { formatDate, formatTimeRange } from "@/lib/format";
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

  const createMutation = useMutation({
    mutationFn: (values: BookingForm) => {
      if (!selectedSlot) {
        throw new Error("NO_SLOT");
      }

      return createAppointment(
        {
          doctorId,
          startAt: selectedSlot.startAt,
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
    if (!selectedSlot) {
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
          href="/doctors"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Quay lại danh sách bác sĩ
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          {doctorQuery.isLoading ? (
            <LoadingBlock label="Đang tải bác sĩ..." />
          ) : doctorQuery.isError || !doctor ? (
            <ErrorState message="Không tải được thông tin bác sĩ." />
          ) : (
            <>
              <div className="aspect-[4/3] overflow-hidden rounded-lg border border-blue-100 bg-blue-50">
                <DoctorAvatar alt={doctor.fullName} src={doctor.avatarUrl} />
              </div>
              <div className="mt-5">
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

          <div className="mt-5 rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            Sau khi gửi yêu cầu, hệ thống giữ slot 15 phút ở trạng thái chờ bác
            sĩ xác nhận.
          </div>
        </aside>

        <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
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
              <>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {days.map((day) => (
                    <button
                      className={cn(
                        "rounded-lg border p-3 text-left transition",
                        (activeDay?.date ?? selectedDate) === day.date
                          ? "border-primary bg-blue-50 text-primary"
                          : "border-blue-100 bg-white text-slate-700 hover:border-primary/50",
                      )}
                      key={day.date}
                      onClick={() => selectDate(day.date)}
                      type="button"
                    >
                      <span className="block font-bold">
                        {formatDate(`${day.date}T00:00:00+07:00`)}
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {day.slots.length} slot trống
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mt-6 border-t border-blue-100 pt-5">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                    <Clock aria-hidden="true" className="size-5 text-primary" />
                    Khung giờ
                  </h2>
                  {activeDay?.slots.length ? (
                    <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {activeDay.slots.map((slot) => (
                        <button
                          className={cn(
                            "rounded-lg border px-3 py-2.5 text-sm font-bold transition",
                            selectedSlot?.startAt === slot.startAt
                              ? "border-green-600 bg-green-50 text-green-700"
                              : "border-blue-100 bg-white text-slate-700 hover:border-primary hover:text-primary",
                          )}
                          key={slot.startAt}
                          onClick={() => setSelectedSlot(slot)}
                          type="button"
                        >
                          {formatTimeRange(slot.startAt, slot.endAt)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      className="mt-4"
                      description="Ngày này hiện không còn khung giờ trống."
                      title="Không có slot"
                    />
                  )}
                </div>
              </>
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
                  {selectedSlot
                    ? `${formatDate(selectedSlot.startAt)}, ${formatTimeRange(
                        selectedSlot.startAt,
                        selectedSlot.endAt,
                      )}`
                    : "Chưa chọn khung giờ"}
                </p>
              </div>
              <Button
                disabled={!selectedSlot || createMutation.isPending}
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
