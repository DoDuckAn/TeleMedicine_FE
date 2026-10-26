"use client";

import { getErrorMessage } from "@/lib/api/error-message";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionMutation } from "@/lib/auth/use-session-mutation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DoctorAppointmentCard } from "@/components/doctor/doctor-appointment-card";
import { DoctorShell } from "@/components/doctor/doctor-shell";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import {
  confirmDoctorAppointment,
  getDoctorPendingAppointments,
  rejectDoctorAppointment,
} from "@/lib/api/doctor";
import { useAuthStore } from "@/lib/auth/session-store";

export function DoctorRequestsPage() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const loginId = useAuthStore((state) => state.loginId);
  const auth = { accessToken: accessToken ?? "", loginId };
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>(
    {},
  );

  const pendingQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getDoctorPendingAppointments({ limit: 20, page: 1 }, auth),
    queryKey: ["doctor", "appointments", "pending"],
  });

  const confirmMutation = useSessionMutation({
    mutationFn: (appointmentId: string) =>
      confirmDoctorAppointment(appointmentId, auth),
    onError: (error) => {
      console.error(error);
      toast.error(getErrorMessage(error, "Không xác nhận được lịch hẹn."));
    },
    onSuccess: () => {
      toast.success("Đã xác nhận lịch hẹn và tạo phòng Google Meet.");
      invalidateDoctorAppointments(queryClient);
    },
  });

  const rejectMutation = useSessionMutation({
    mutationFn: ({
      appointmentId,
      reason,
    }: {
      appointmentId: string;
      reason: string;
    }) => rejectDoctorAppointment(appointmentId, { reason }, auth),
    onError: (error) => {
      console.error(error);
      toast.error(getErrorMessage(error, "Không từ chối được lịch hẹn."));
    },
    onSuccess: () => {
      toast.success("Đã từ chối lịch hẹn.");
      setRejectReasons({});
      invalidateDoctorAppointments(queryClient);
    },
  });

  const appointments = pendingQuery.data?.items ?? [];

  return (
    <DoctorShell title="Yêu cầu khám">
      <section className="grid gap-5">
        <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase text-primary">
            Chờ phản hồi
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Yêu cầu đặt lịch của bệnh nhân
          </h1>
        </div>

        {pendingQuery.isLoading ? (
          <LoadingBlock label="Đang tải yêu cầu khám..." />
        ) : pendingQuery.isError ? (
          <ErrorState message="Chưa tải được yêu cầu khám đang chờ." />
        ) : appointments.length ? (
          appointments.map((appointment) => (
            <div
              className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm"
              key={appointment.id}
            >
              <DoctorAppointmentCard appointment={appointment} />

              <div className="mt-4 grid gap-4 border-t border-blue-100 pt-4 lg:grid-cols-[1fr_auto]">
                <Field label="Lý do từ chối">
                  <Textarea
                    onChange={(event) =>
                      setRejectReasons((current) => ({
                        ...current,
                        [appointment.id]: event.target.value,
                      }))
                    }
                    placeholder="Nhập lý do nếu cần từ chối..."
                    value={rejectReasons[appointment.id] ?? ""}
                  />
                </Field>

                <div className="flex items-end gap-2">
                  <Button
                    disabled={confirmMutation.isPending}
                    onClick={() => confirmMutation.mutate(appointment.id)}
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
                    Xác nhận
                  </Button>
                  <Button
                    disabled={
                      rejectMutation.isPending ||
                      !rejectReasons[appointment.id]?.trim()
                    }
                    onClick={() =>
                      rejectMutation.mutate({
                        appointmentId: appointment.id,
                        reason: rejectReasons[appointment.id].trim(),
                      })
                    }
                    variant="destructive"
                  >
                    <XCircle aria-hidden="true" className="size-4" />
                    Từ chối
                  </Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <EmptyState
            description="Hiện không có yêu cầu nào cần xử lý."
            title="Không có yêu cầu đang chờ"
          />
        )}
      </section>
    </DoctorShell>
  );
}

function invalidateDoctorAppointments(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  queryClient.invalidateQueries({ queryKey: ["doctor", "appointments"] });
}
