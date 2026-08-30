"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CalendarClock, History } from "lucide-react";
import { useState } from "react";

import { AppointmentCard } from "@/components/patient/appointment-card";
import { PatientShell } from "@/components/patient/patient-shell";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import {
  getPatientHistoryAppointments,
  getPatientUpcomingAppointments,
} from "@/lib/api/patient";
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

export function PatientAppointmentsPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const auth = { accessToken: accessToken ?? "" };
  const enabled = Boolean(accessToken);
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<AppointmentStatus | "">("");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const upcomingQuery = useQuery({
    enabled: enabled && tab === "upcoming",
    placeholderData: keepPreviousData,
    queryFn: () => getPatientUpcomingAppointments({ limit: 8, page }, auth),
    queryKey: ["patient", "appointments", "upcoming", page],
  });

  const historyQuery = useQuery({
    enabled: enabled && tab === "history",
    placeholderData: keepPreviousData,
    queryFn: () =>
      getPatientHistoryAppointments(
        {
          limit: 8,
          order,
          page,
          status,
        },
        auth,
      ),
    queryKey: ["patient", "appointments", "history", { order, page, status }],
  });

  const activeQuery = tab === "upcoming" ? upcomingQuery : historyQuery;
  const appointments = activeQuery.data?.items ?? [];
  const totalPages = activeQuery.data?.pagination.totalPages ?? 1;

  function switchTab(nextTab: "upcoming" | "history") {
    setTab(nextTab);
    setPage(1);
  }

  return (
    <PatientShell title="Lịch hẹn">
      <section className="grid gap-6">
        <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase text-primary">
                Quản lý lịch khám
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Lịch hẹn của tôi
              </h1>
              <p className="mt-2 leading-7 text-muted-foreground">
                Theo dõi yêu cầu đang chờ, lịch đã xác nhận và lịch sử khám.
              </p>
            </div>

            <div className="grid grid-cols-2 rounded-lg bg-blue-50 p-1">
              <button
                className={tabClass(tab === "upcoming")}
                onClick={() => switchTab("upcoming")}
                type="button"
              >
                <CalendarClock aria-hidden="true" className="size-4" />
                Sắp tới
              </button>
              <button
                className={tabClass(tab === "history")}
                onClick={() => switchTab("history")}
                type="button"
              >
                <History aria-hidden="true" className="size-4" />
                Lịch sử
              </button>
            </div>
          </div>

          {tab === "history" ? (
            <div className="mt-5 grid gap-3 border-t border-blue-100 pt-5 md:grid-cols-2">
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
          ) : null}
        </div>

        <div className="space-y-4">
          {activeQuery.isLoading ? (
            <LoadingBlock label="Đang tải lịch hẹn..." />
          ) : activeQuery.isError ? (
            <ErrorState message="Chưa tải được danh sách lịch hẹn." />
          ) : appointments.length ? (
            appointments.map((appointment) => (
              <AppointmentCard
                appointment={appointment}
                key={appointment.id}
                showReviewAction={tab === "history"}
              />
            ))
          ) : (
            <EmptyState
              description={
                tab === "upcoming"
                  ? "Bạn chưa có lịch khám sắp tới."
                  : "Lịch sử khám sẽ xuất hiện sau khi có lịch hẹn được xử lý."
              }
              title="Chưa có lịch hẹn"
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

function tabClass(active: boolean) {
  return active
    ? "inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-bold text-primary shadow-sm"
    : "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-600";
}
