"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CalendarRange } from "lucide-react";
import { useState } from "react";

import { AppointmentCard } from "@/components/patient/appointment-card";
import { PatientShell } from "@/components/patient/patient-shell";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { getPatientHistoryAppointments } from "@/lib/api/patient";
import { appointmentStatusMeta } from "@/lib/appointment-status";
import { useAuthStore } from "@/lib/auth/session-store";
import type { AppointmentStatus } from "@/types/api";

const statusOptions: { label: string; value: AppointmentStatus | "" }[] = [
  { label: "Tất cả trạng thái", value: "" },
  ...Object.entries(appointmentStatusMeta).map(([value, meta]) => ({
    label: meta.label,
    value: value as AppointmentStatus,
  })),
];

export function PatientHistoryPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const auth = { accessToken: accessToken ?? "" };
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<AppointmentStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const historyQuery = useQuery({
    enabled: Boolean(accessToken),
    placeholderData: keepPreviousData,
    queryFn: () =>
      getPatientHistoryAppointments(
        {
          from: toIsoStart(from),
          limit: 10,
          order: "desc",
          page,
          status,
          to: toIsoEnd(to),
        },
        auth,
      ),
    queryKey: ["patient", "history", { from, page, status, to }],
  });

  const appointments = historyQuery.data?.items ?? [];
  const totalPages = historyQuery.data?.pagination.totalPages ?? 1;

  return (
    <PatientShell title="Lịch sử khám">
      <section className="grid gap-6">
        <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-primary">
              <CalendarRange aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold uppercase text-primary">
                Hồ sơ lịch sử
              </p>
              <h1 className="text-3xl font-bold text-slate-900">
                Các buổi khám đã qua
              </h1>
            </div>
          </div>

          <div className="mt-5 grid gap-3 border-t border-blue-100 pt-5 md:grid-cols-3">
            <Select
              aria-label="Trạng thái"
              onChange={(event) => {
                setStatus(event.target.value as AppointmentStatus | "");
                setPage(1);
              }}
              value={status}
            >
              {statusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input
              aria-label="Từ ngày"
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              type="date"
              value={from}
            />
            <Input
              aria-label="Đến ngày"
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              type="date"
              value={to}
            />
          </div>
        </div>

        <div className="space-y-4">
          {historyQuery.isLoading ? (
            <LoadingBlock label="Đang tải lịch sử khám..." />
          ) : historyQuery.isError ? (
            <ErrorState message="Chưa tải được lịch sử khám." />
          ) : appointments.length ? (
            appointments.map((appointment) => (
              <AppointmentCard
                appointment={appointment}
                key={appointment.id}
                showReviewAction
              />
            ))
          ) : (
            <EmptyState
              description="Các buổi khám đã xử lý sẽ được lưu tại đây."
              title="Chưa có lịch sử khám"
            />
          )}
        </div>

        {appointments.length ? (
          <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-white p-3 shadow-sm">
            <Button
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              variant="outline"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Trang trước
            </Button>
            <p className="text-sm font-semibold text-slate-700">
              Trang {page} / {totalPages}
            </p>
            <Button
              disabled={page >= totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              variant="outline"
            >
              Trang sau
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        ) : null}
      </section>
    </PatientShell>
  );
}

function toIsoStart(value: string) {
  return value ? `${value}T00:00:00+07:00` : undefined;
}

function toIsoEnd(value: string) {
  return value ? `${value}T23:59:59+07:00` : undefined;
}
