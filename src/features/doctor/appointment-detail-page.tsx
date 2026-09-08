"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  ShieldCheck,
  UserRound,
  Video,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { StatusBadge } from "@/components/appointment/status-badge";
import { DoctorShell } from "@/components/doctor/doctor-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { ErrorState, LoadingBlock } from "@/components/ui/feedback";
import {
  cancelDoctorAppointment,
  completeDoctorAppointment,
  confirmDoctorAppointment,
  getDoctorAppointment,
  rejectDoctorAppointment,
} from "@/lib/api/doctor";
import {
  canDoctorCancelAppointment,
  canDoctorCompleteAppointment,
} from "@/lib/appointment-status";
import { useAuthStore } from "@/lib/auth/session-store";
import { formatDateTime, formatTimeRange } from "@/lib/format";

const reasonSchema = z.object({
  reason: z.string().min(1, "Nhập lý do").max(2000),
});

type ReasonForm = z.infer<typeof reasonSchema>;

export function DoctorAppointmentDetailPage({
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
    queryFn: () => getDoctorAppointment(appointmentId, auth),
    queryKey: ["doctor", "appointments", appointmentId],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });

  const rejectForm = useForm<ReasonForm>({
    defaultValues: { reason: "" },
    resolver: zodResolver(reasonSchema),
  });

  const cancelForm = useForm<ReasonForm>({
    defaultValues: { reason: "" },
    resolver: zodResolver(reasonSchema),
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmDoctorAppointment(appointmentId, auth),
    onError: (error) => {
      console.error(error);
      toast.error("Không xác nhận được lịch hẹn.");
    },
    onSuccess: () => {
      toast.success("Đã xác nhận lịch hẹn và tạo phòng Google Meet.");
      invalidateDoctorAppointments(queryClient, appointmentId);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (values: ReasonForm) =>
      rejectDoctorAppointment(appointmentId, values, auth),
    onError: (error) => {
      console.error(error);
      toast.error("Không từ chối được lịch hẹn.");
    },
    onSuccess: () => {
      toast.success("Đã từ chối lịch hẹn.");
      rejectForm.reset();
      invalidateDoctorAppointments(queryClient, appointmentId);
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => completeDoctorAppointment(appointmentId, auth),
    onError: (error) => {
      console.error(error);
      toast.error("Không hoàn tất được buổi khám.");
    },
    onSuccess: () => {
      toast.success("Đã hoàn tất buổi khám.");
      invalidateDoctorAppointments(queryClient, appointmentId);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (values: ReasonForm) =>
      cancelDoctorAppointment(appointmentId, values, auth),
    onError: (error) => {
      console.error(error);
      toast.error("Không hủy được lịch hẹn.");
    },
    onSuccess: () => {
      toast.success("Đã hủy lịch hẹn.");
      cancelForm.reset();
      invalidateDoctorAppointments(queryClient, appointmentId);
    },
  });

  const appointment = appointmentQuery.data;
  const patientName =
    appointment?.patient?.fullName ??
    appointment?.patient?.patientProfile?.fullName ??
    "Bệnh nhân";
  const canConfirm = appointment?.status === "PENDING_CONFIRMATION";
  const canComplete = appointment
    ? canDoctorCompleteAppointment(appointment.status, appointment.startAt)
    : false;
  const canCancel = appointment
    ? canDoctorCancelAppointment(appointment.status, appointment.startAt)
    : false;

  return (
    <DoctorShell title="Chi tiết tư vấn">
      <div className="mb-5">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
          href="/doctor/appointments"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Quay lại lịch tư vấn
        </Link>
      </div>

      {appointmentQuery.isLoading ? (
        <LoadingBlock label="Đang tải chi tiết lịch hẹn..." />
      ) : appointmentQuery.isError || !appointment ? (
        <ErrorState message="Không tải được chi tiết lịch hẹn." />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <StatusBadge status={appointment.status} />
                <h1 className="mt-4 text-3xl font-bold text-slate-900">
                  {patientName}
                </h1>
                <p className="mt-2 leading-7 text-muted-foreground">
                  Kiểm tra hồ sơ bệnh nhân và lý do khám trước khi phản hồi.
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
                  Vào Meet
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
              <InfoBlock
                icon={UserRound}
                label="Bệnh nhân"
                value={patientName}
              />
              <InfoBlock
                icon={FileText}
                label="Lý do khám"
                value={appointment.visitReason}
              />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <ProfileBlock
                label="Tiền sử bệnh"
                value={appointment.patient?.medicalHistory ?? "Chưa cập nhật"}
              />
              <ProfileBlock
                label="Dị ứng thuốc"
                value={appointment.patient?.drugAllergies ?? "Chưa cập nhật"}
              />
              <ProfileBlock
                label="Địa chỉ"
                value={appointment.patient?.address ?? "Chưa cập nhật"}
              />
              <ProfileBlock
                label="Email"
                value={appointment.patient?.email ?? "Chưa cập nhật"}
              />
            </div>

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

          <aside className="space-y-5">
            {canConfirm ? (
              <ActionCard title="Phản hồi yêu cầu">
                <Button
                  className="w-full"
                  disabled={confirmMutation.isPending}
                  onClick={() => confirmMutation.mutate()}
                  variant="success"
                >
                  {confirmMutation.isPending ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : (
                    <CheckCircle2 aria-hidden="true" className="size-4" />
                  )}
                  Xác nhận lịch hẹn
                </Button>

                <form
                  className="mt-4 grid gap-3"
                  onSubmit={rejectForm.handleSubmit((values) =>
                    rejectMutation.mutate(values),
                  )}
                >
                  <Field
                    error={rejectForm.formState.errors.reason?.message}
                    label="Lý do từ chối"
                  >
                    <Textarea
                      placeholder="Nhập lý do từ chối..."
                      {...rejectForm.register("reason")}
                    />
                  </Field>
                  <Button
                    disabled={rejectMutation.isPending}
                    type="submit"
                    variant="destructive"
                  >
                    <XCircle aria-hidden="true" className="size-4" />
                    Từ chối lịch hẹn
                  </Button>
                </form>
              </ActionCard>
            ) : null}

            <ActionCard title="Thao tác buổi khám">
              <Button
                className="w-full"
                disabled={!canComplete || completeMutation.isPending}
                onClick={() => completeMutation.mutate()}
                variant="primary"
              >
                {completeMutation.isPending ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <ShieldCheck aria-hidden="true" className="size-4" />
                )}
                Hoàn tất buổi khám
              </Button>
              {!canComplete ? (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Chỉ hoàn tất được khi lịch đã xác nhận và đã tới giờ bắt đầu.
                </p>
              ) : null}
            </ActionCard>

            <ActionCard title="Hủy lịch hẹn">
              {canCancel ? (
                <form
                  className="grid gap-3"
                  onSubmit={cancelForm.handleSubmit((values) =>
                    cancelMutation.mutate(values),
                  )}
                >
                  <Field
                    error={cancelForm.formState.errors.reason?.message}
                    label="Lý do hủy"
                  >
                    <Textarea
                      placeholder="Nhập lý do hủy lịch..."
                      {...cancelForm.register("reason")}
                    />
                  </Field>
                  <Button
                    disabled={cancelMutation.isPending}
                    type="submit"
                    variant="destructive"
                  >
                    <XCircle aria-hidden="true" className="size-4" />
                    Hủy lịch hẹn
                  </Button>
                </form>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">
                  Lịch hẹn này không còn đủ điều kiện hủy.
                </p>
              )}
            </ActionCard>
          </aside>
        </div>
      )}
    </DoctorShell>
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

function ProfileBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-bold leading-6 text-slate-900">{value}</p>
    </div>
  );
}

function ActionCard({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function invalidateDoctorAppointments(
  queryClient: ReturnType<typeof useQueryClient>,
  appointmentId: string,
) {
  queryClient.invalidateQueries({ queryKey: ["doctor", "appointments"] });
  queryClient.invalidateQueries({
    queryKey: ["doctor", "appointments", appointmentId],
  });
}
