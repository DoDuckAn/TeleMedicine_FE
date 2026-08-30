"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  ExternalLink,
  Loader2,
  MessageSquareText,
  UserRound,
  Video,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { StatusBadge } from "@/components/appointment/status-badge";
import { PatientShell } from "@/components/patient/patient-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { cancelAppointment, getAppointment } from "@/lib/api/patient";
import { canPatientCancelAppointment } from "@/lib/appointment-status";
import { useAuthStore } from "@/lib/auth/session-store";
import { formatDateTime, formatTimeRange } from "@/lib/format";

const cancelSchema = z.object({
  reason: z.string().min(1, "Nhập lý do hủy").max(2000),
});

type CancelForm = z.infer<typeof cancelSchema>;

export function AppointmentDetailPage({
  appointmentId,
}: {
  appointmentId: string;
}) {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const auth = { accessToken: accessToken ?? "" };
  const enabled = Boolean(accessToken && appointmentId);

  const appointmentQuery = useQuery({
    enabled,
    queryFn: () => getAppointment(appointmentId, auth),
    queryKey: ["patient", "appointments", appointmentId],
  });

  const form = useForm<CancelForm>({
    defaultValues: {
      reason: "",
    },
    resolver: zodResolver(cancelSchema),
  });

  const cancelMutation = useMutation({
    mutationFn: (values: CancelForm) =>
      cancelAppointment(appointmentId, values, auth),
    onError: (error) => {
      console.error(error);
      toast.error("Không hủy được lịch hẹn. Kiểm tra điều kiện hủy lịch.");
    },
    onSuccess: async () => {
      toast.success("Đã hủy lịch hẹn.");
      form.reset();
      await queryClient.invalidateQueries({
        queryKey: ["patient", "appointments"],
      });
    },
  });

  const appointment = appointmentQuery.data;
  const doctorName = appointment?.doctor?.fullName ?? "Bác sĩ";
  const canCancel = appointment
    ? canPatientCancelAppointment(appointment.status, appointment.startAt)
    : false;

  return (
    <PatientShell title="Chi tiết lịch hẹn">
      <div className="mb-5">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
          href="/patient/appointments"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Quay lại lịch hẹn
        </Link>
      </div>

      {appointmentQuery.isLoading ? (
        <LoadingBlock label="Đang tải lịch hẹn..." />
      ) : appointmentQuery.isError || !appointment ? (
        <ErrorState message="Không tải được chi tiết lịch hẹn." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <StatusBadge status={appointment.status} />
                <h1 className="mt-4 text-3xl font-bold text-slate-900">
                  {doctorName}
                </h1>
                <p className="mt-2 leading-7 text-muted-foreground">
                  {appointment.doctor?.specialties
                    ?.map((specialty) => specialty.name)
                    .join(", ") ?? "Chuyên khoa"}
                </p>
              </div>
              {appointment.meetingUrl ? (
                <a
                  className={buttonVariants({ size: "lg", variant: "success" })}
                  href={appointment.meetingUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <Video aria-hidden="true" className="size-5" />
                  Vào phòng khám
                  <ExternalLink aria-hidden="true" className="size-4" />
                </a>
              ) : null}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <InfoBlock
                icon={CalendarDays}
                label="Thời gian"
                value={formatDateTime(appointment.startAt)}
              />
              <InfoBlock
                icon={Clock}
                label="Khung giờ"
                value={formatTimeRange(appointment.startAt, appointment.endAt)}
              />
              <InfoBlock icon={UserRound} label="Bác sĩ" value={doctorName} />
              <InfoBlock
                icon={MessageSquareText}
                label="Lý do khám"
                value={appointment.visitReason}
              />
            </div>

            {appointment.rejectionReason || appointment.cancellationReason ? (
              <div className="mt-6 rounded-lg border border-red-100 bg-red-50 p-4 text-sm leading-6 text-red-700">
                {appointment.rejectionReason
                  ? `Lý do từ chối: ${appointment.rejectionReason}`
                  : `Lý do hủy: ${appointment.cancellationReason}`}
              </div>
            ) : null}

            <div className="mt-6 border-t border-blue-100 pt-5">
              <h2 className="text-lg font-bold text-slate-900">
                Dòng trạng thái
              </h2>
              {appointment.statusHistory?.length ? (
                <div className="mt-4 space-y-3">
                  {appointment.statusHistory.map((history, index) => (
                    <div
                      className="rounded-lg border border-blue-100 bg-slate-50 p-3 text-sm"
                      key={history.id ?? `${history.toStatus}-${index}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <StatusBadge status={history.toStatus} />
                        <span className="font-medium text-muted-foreground">
                          {formatDateTime(history.createdAt)}
                        </span>
                      </div>
                      {history.reason ? (
                        <p className="mt-2 text-muted-foreground">
                          {history.reason}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Chưa có lịch sử trạng thái chi tiết.
                </p>
              )}
            </div>
          </section>

          <aside className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <XCircle aria-hidden="true" className="size-5 text-red-600" />
              Hủy lịch hẹn
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Có thể hủy lịch khi trạng thái còn chờ xác nhận/đã xác nhận và
              trước giờ hẹn ít nhất 30 phút.
            </p>

            {canCancel ? (
              <form
                className="mt-5 grid gap-4"
                onSubmit={form.handleSubmit((values) =>
                  cancelMutation.mutate(values),
                )}
              >
                <Field
                  error={form.formState.errors.reason?.message}
                  label="Lý do hủy"
                >
                  <Textarea
                    placeholder="Nhập lý do hủy lịch..."
                    {...form.register("reason")}
                  />
                </Field>
                <Button
                  disabled={cancelMutation.isPending}
                  type="submit"
                  variant="destructive"
                >
                  {cancelMutation.isPending ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : (
                    <XCircle aria-hidden="true" className="size-4" />
                  )}
                  Xác nhận hủy
                </Button>
              </form>
            ) : (
              <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-muted-foreground">
                Lịch hẹn này không còn đủ điều kiện hủy từ phía bệnh nhân.
              </div>
            )}
          </aside>
        </div>
      )}
    </PatientShell>
  );
}

function InfoBlock({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-blue-100 bg-slate-50 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Icon aria-hidden="true" className="size-4 text-primary" />
        {label}
      </p>
      <p className="mt-2 font-bold text-slate-900">{value}</p>
    </div>
  );
}
