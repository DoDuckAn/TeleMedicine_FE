"use client";

import { getErrorMessage } from "@/lib/api/error-message";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionMutation } from "@/lib/auth/use-session-mutation";
import { ExternalLink, Loader2, Search, Video, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusBadge } from "@/components/appointment/status-badge";
import { Modal } from "@/components/ui/modal";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import {
  cancelAdminAppointment,
  getAdminAppointment,
  listAdminAppointments,
} from "@/lib/api/admin";
import {
  appointmentStatusMeta,
  canDoctorCancelAppointment,
} from "@/lib/appointment-status";
import { dateOnlyEndIso, dateOnlyStartIso } from "@/lib/doctor-schedule";
import { useAuthStore } from "@/lib/auth/session-store";
import { formatDateTime, formatTimeRange } from "@/lib/format";
import type { AppointmentStatus } from "@/types/api";

export function AdminAppointmentsPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const loginId = useAuthStore((state) => state.loginId);
  const auth = { accessToken: accessToken ?? "", loginId };
  const [page, setPage] = useState(1);
  const [doctorId, setDoctorId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [status, setStatus] = useState<AppointmentStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    string | null
  >(null);

  const appointmentsQuery = useQuery({
    enabled: Boolean(accessToken),
    placeholderData: keepPreviousData,
    queryFn: () =>
      listAdminAppointments(
        {
          doctorId: doctorId.trim() || undefined,
          from: from ? dateOnlyStartIso(from) : undefined,
          limit: 10,
          order,
          page,
          patientId: patientId.trim() || undefined,
          status,
          to: to ? dateOnlyEndIso(to) : undefined,
        },
        auth,
      ),
    queryKey: [
      "admin",
      "appointments",
      { doctorId, from, order, page, patientId, status, to },
    ],
  });

  const appointments = appointmentsQuery.data?.items ?? [];
  const totalPages = appointmentsQuery.data?.pagination.totalPages ?? 1;

  return (
    <AdminShell title="Lịch hẹn">
      <section className="grid gap-6">
        <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase text-primary">
            Quản lý lịch khám
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Toàn bộ lịch hẹn
          </h1>

          <div className="mt-5 grid gap-3 border-t border-blue-100 pt-5 md:grid-cols-2 xl:grid-cols-6">
            <div className="relative xl:col-span-2">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                className="pl-9"
                onChange={(event) => {
                  setDoctorId(event.target.value);
                  setPage(1);
                }}
                placeholder="Mã bác sĩ..."
                value={doctorId}
              />
            </div>
            <Input
              onChange={(event) => {
                setPatientId(event.target.value);
                setPage(1);
              }}
              placeholder="Mã bệnh nhân..."
              value={patientId}
            />
            <Select
              aria-label="Trạng thái"
              onChange={(event) => {
                setStatus(event.target.value as AppointmentStatus | "");
                setPage(1);
              }}
              value={status}
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(appointmentStatusMeta).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </Select>
            <Input
              aria-label="Từ ngày"
              onDateChange={(dateValue) => {
                setFrom(dateValue);
                setPage(1);
              }}
              type="date"
              value={from}
            />
            <Input
              aria-label="Đến ngày"
              onDateChange={(dateValue) => {
                setTo(dateValue);
                setPage(1);
              }}
              type="date"
              value={to}
            />
            <Select
              aria-label="Thứ tự"
              onChange={(event) => {
                setOrder(event.target.value as "asc" | "desc");
                setPage(1);
              }}
              value={order}
            >
              <option value="desc">Mới nhất trước</option>
              <option value="asc">Cũ nhất trước</option>
            </Select>
          </div>
        </div>

        {appointmentsQuery.isLoading ? (
          <LoadingBlock label="Đang tải lịch hẹn..." />
        ) : appointmentsQuery.isError ? (
          <ErrorState message="Chưa tải được danh sách lịch hẹn." />
        ) : appointments.length ? (
          <>
            <div className="overflow-x-auto rounded-lg border border-blue-100 bg-white shadow-sm">
              <table className="min-w-[1040px] w-full text-left text-sm">
                <thead className="bg-blue-50 text-xs uppercase text-primary">
                  <tr>
                    <th className="px-4 py-3">Thời gian</th>
                    <th className="px-4 py-3">Bác sĩ</th>
                    <th className="px-4 py-3">Bệnh nhân</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Lý do khám</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100">
                  {appointments.map((appointment) => (
                    <tr key={appointment.id}>
                      <td className="px-4 py-4">
                        <p className="font-bold text-slate-900">
                          {formatDateTime(appointment.startAt)}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {formatTimeRange(
                            appointment.startAt,
                            appointment.endAt,
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          className="font-semibold text-primary hover:underline"
                          href={`/admin/doctors/${appointment.doctorID}`}
                        >
                          {appointment.doctor?.fullName ?? appointment.doctorID}
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          className="font-semibold text-primary hover:underline"
                          href={`/admin/patients/${appointment.patientID}`}
                        >
                          {appointment.patient?.fullName ??
                            appointment.patientID}
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={appointment.status} />
                      </td>
                      <td className="max-w-xs px-4 py-4 text-muted-foreground">
                        <span className="line-clamp-2">
                          {appointment.visitReason}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Button
                          onClick={() =>
                            setSelectedAppointmentId(appointment.id)
                          }
                          size="sm"
                          variant="outline"
                        >
                          Chi tiết
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AdminPagination
              page={page}
              setPage={setPage}
              totalPages={totalPages}
            />
          </>
        ) : (
          <EmptyState
            description="Thử đổi bộ lọc hoặc khoảng ngày."
            title="Chưa có lịch hẹn"
          />
        )}
      </section>

      {selectedAppointmentId ? (
        <AppointmentDetailModal
          appointmentId={selectedAppointmentId}
          onClose={() => setSelectedAppointmentId(null)}
        />
      ) : null}
    </AdminShell>
  );
}

function AppointmentDetailModal({
  appointmentId,
  onClose,
}: {
  appointmentId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const loginId = useAuthStore((state) => state.loginId);
  const auth = { accessToken: accessToken ?? "", loginId };
  const [reason, setReason] = useState("");

  const appointmentQuery = useQuery({
    enabled: Boolean(accessToken && appointmentId),
    queryFn: () => getAdminAppointment(appointmentId, auth),
    queryKey: ["admin", "appointments", appointmentId],
  });

  const cancelMutation = useSessionMutation({
    mutationFn: () =>
      cancelAdminAppointment(appointmentId, { reason: reason.trim() }, auth),
    onError: (error) => {
      console.error(error);
      toast.error(getErrorMessage(error, "Không hủy được lịch hẹn."));
    },
    onSuccess: async () => {
      toast.success("Đã hủy lịch hẹn.");
      setReason("");
      await queryClient.invalidateQueries({
        queryKey: ["admin", "appointments"],
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });

  const appointment = appointmentQuery.data;
  const canCancel = appointment
    ? canDoctorCancelAppointment(appointment.status, appointment.startAt)
    : false;

  return (
    <Modal label="Chi tiết lịch hẹn" onClose={onClose}>
      <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-primary">
              Chi tiết lịch hẹn
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              {appointmentId}
            </h2>
          </div>
          <button
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-primary"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Đóng</span>
          </button>
        </div>

        <div className="mt-5">
          {appointmentQuery.isLoading ? (
            <LoadingBlock label="Đang tải chi tiết lịch hẹn..." />
          ) : appointmentQuery.isError || !appointment ? (
            <ErrorState message="Chưa tải được chi tiết lịch hẹn." />
          ) : (
            <div className="grid gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <StatusBadge status={appointment.status} />
                {appointment.meetingUrl ? (
                  <a
                    className={buttonVariants({
                      size: "sm",
                      variant: "success",
                    })}
                    href={appointment.meetingUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <Video aria-hidden="true" className="size-4" />
                    Mở Meet
                    <ExternalLink aria-hidden="true" className="size-3.5" />
                  </a>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Info
                  label="Thời gian"
                  value={formatDateTime(appointment.startAt)}
                />
                <Info
                  label="Khung giờ"
                  value={formatTimeRange(
                    appointment.startAt,
                    appointment.endAt,
                  )}
                />
                <Info
                  label="Bác sĩ"
                  value={appointment.doctor?.fullName ?? appointment.doctorID}
                />
                <Info
                  label="Bệnh nhân"
                  value={appointment.patient?.fullName ?? appointment.patientID}
                />
              </div>

              <div className="rounded-lg border border-blue-100 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-muted-foreground">
                  Lý do khám
                </p>
                <p className="mt-2 leading-7 text-slate-700">
                  {appointment.visitReason}
                </p>
              </div>

              <div className="rounded-lg border border-blue-100 bg-white p-4">
                <h3 className="font-bold text-slate-900">Lịch sử trạng thái</h3>
                <div className="mt-3 space-y-2">
                  {appointment.statusHistory?.length ? (
                    appointment.statusHistory.map((history, index) => (
                      <div
                        className="rounded-md bg-slate-50 p-3 text-sm"
                        key={history.id ?? index}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <StatusBadge status={history.toStatus} />
                          <span className="font-semibold text-muted-foreground">
                            {formatDateTime(history.createdAt)}
                          </span>
                        </div>
                        {history.reason || history.note ? (
                          <p className="mt-2 text-muted-foreground">
                            {history.reason ?? history.note}
                          </p>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Chưa có lịch sử trạng thái.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-red-100 bg-red-50 p-4">
                <Field label="Lý do hủy">
                  <Textarea
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Nhập lý do quản trị viên hủy lịch..."
                    value={reason}
                  />
                </Field>
                <Button
                  className="mt-3"
                  disabled={
                    !canCancel || !reason.trim() || cancelMutation.isPending
                  }
                  onClick={() => cancelMutation.mutate()}
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
                  Hủy lịch hẹn
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="mt-2 font-bold text-slate-900">{value}</p>
    </div>
  );
}
