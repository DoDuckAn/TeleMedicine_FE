"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CalendarCheck,
  Clock,
  ClipboardList,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { DoctorAppointmentCard } from "@/components/doctor/doctor-appointment-card";
import { DoctorShell } from "@/components/doctor/doctor-shell";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import {
  getDoctorMe,
  getDoctorPendingAppointments,
  getDoctorStatistics,
  getDoctorUpcomingAppointments,
} from "@/lib/api/doctor";
import { useAuthStore } from "@/lib/auth/session-store";

export function DoctorDashboardPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const auth = { accessToken: accessToken ?? "" };
  const enabled = Boolean(accessToken);

  const meQuery = useQuery({
    enabled,
    queryFn: () => getDoctorMe(auth),
    queryKey: ["doctor", "me"],
  });

  const pendingQuery = useQuery({
    enabled,
    queryFn: () => getDoctorPendingAppointments({ limit: 3, page: 1 }, auth),
    queryKey: ["doctor", "appointments", "pending", "dashboard"],
  });

  const upcomingQuery = useQuery({
    enabled,
    queryFn: () => getDoctorUpcomingAppointments({ limit: 3, page: 1 }, auth),
    queryKey: ["doctor", "appointments", "upcoming", "dashboard"],
  });

  const statisticsQuery = useQuery({
    enabled,
    queryFn: () => getDoctorStatistics({ groupBy: "day" }, auth),
    queryKey: ["doctor", "statistics", "dashboard"],
  });

  const pendingAppointments = pendingQuery.data?.items ?? [];
  const upcomingAppointments = upcomingQuery.data?.items ?? [];
  const summary = statisticsQuery.data?.summary;

  return (
    <DoctorShell title="Tổng quan">
      <div className="grid gap-6">
        <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase text-primary">
                Cổng bác sĩ
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                {meQuery.data?.doctorProfile.fullName ?? "Bác sĩ"}
              </h1>
            </div>
            <Link
              className={buttonVariants({ size: "lg", variant: "success" })}
              href="/doctor/requests"
            >
              <ClipboardList aria-hidden="true" className="size-5" />
              Xem yêu cầu khám
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <MetricCard
            icon={Clock}
            label="Chờ xác nhận"
            value={
              pendingQuery.data?.pagination.total ?? pendingAppointments.length
            }
          />
          <MetricCard
            icon={CalendarCheck}
            label="Sắp tư vấn"
            value={
              upcomingQuery.data?.pagination.total ??
              upcomingAppointments.length
            }
          />
          <MetricCard
            icon={Stethoscope}
            label="Hoàn thành"
            value={summary?.completedAppointments ?? 0}
          />
          <MetricCard
            icon={UsersRound}
            label="Bệnh nhân"
            value={summary?.uniquePatients ?? 0}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <DashboardPanel
            actionHref="/doctor/requests"
            actionLabel="Xem tất cả"
            error={pendingQuery.isError}
            isLoading={pendingQuery.isLoading}
            title="Yêu cầu đang chờ"
          >
            {pendingAppointments.length ? (
              pendingAppointments.map((appointment) => (
                <DoctorAppointmentCard
                  appointment={appointment}
                  key={appointment.id}
                />
              ))
            ) : (
              <EmptyState
                description="Yêu cầu đặt lịch mới sẽ xuất hiện tại đây."
                title="Không có yêu cầu chờ"
              />
            )}
          </DashboardPanel>

          <DashboardPanel
            actionHref="/doctor/appointments"
            actionLabel="Xem lịch"
            error={upcomingQuery.isError}
            isLoading={upcomingQuery.isLoading}
            title="Lịch tư vấn sắp tới"
          >
            {upcomingAppointments.length ? (
              upcomingAppointments.map((appointment) => (
                <DoctorAppointmentCard
                  appointment={appointment}
                  key={appointment.id}
                />
              ))
            ) : (
              <EmptyState
                description="Lịch đã xác nhận sắp tới sẽ xuất hiện tại đây."
                title="Chưa có lịch tư vấn"
              />
            )}
          </DashboardPanel>
        </section>
      </div>
    </DoctorShell>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <article className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
      <span className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-primary">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <p className="mt-4 text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm font-semibold text-muted-foreground">
        {label}
      </p>
    </article>
  );
}

function DashboardPanel({
  actionHref,
  actionLabel,
  children,
  error,
  isLoading,
  title,
}: {
  actionHref: string;
  actionLabel: string;
  children: React.ReactNode;
  error: boolean;
  isLoading: boolean;
  title: string;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <Link
          className={buttonVariants({ size: "sm", variant: "outline" })}
          href={actionHref}
        >
          {actionLabel}
        </Link>
      </div>
      <div className="space-y-4">
        {isLoading ? (
          <LoadingBlock label="Đang tải dữ liệu..." />
        ) : error ? (
          <ErrorState message="Chưa tải được dữ liệu." />
        ) : (
          children
        )}
      </div>
    </section>
  );
}
