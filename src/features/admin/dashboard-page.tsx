"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  RotateCcw,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { UserStatusBadge } from "@/components/admin/admin-badges";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { getAdminDashboard } from "@/lib/api/admin";
import { appointmentStatusMeta } from "@/lib/appointment-status";
import {
  addDaysToDateOnly,
  dateOnlyEndIso,
  dateOnlyStartIso,
  todayInVietnamDateOnly,
} from "@/lib/doctor-schedule";
import { formatStatisticPeriod } from "@/lib/admin-format";
import { useAuthStore } from "@/lib/auth/session-store";
import type { AppointmentStatus } from "@/types/api";

type GroupBy = "day" | "month" | "week";

function defaultFilters() {
  const today = todayInVietnamDateOnly();

  return {
    from: addDaysToDateOnly(today, -30),
    groupBy: "day" as GroupBy,
    to: today,
  };
}

export function AdminDashboardPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const auth = { accessToken: accessToken ?? "" };
  const [filters, setFilters] = useState(defaultFilters);

  const dashboardQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      getAdminDashboard(
        {
          from: dateOnlyStartIso(filters.from),
          groupBy: filters.groupBy,
          to: dateOnlyEndIso(filters.to),
        },
        auth,
      ),
    queryKey: ["admin", "dashboard", filters],
  });

  const data = dashboardQuery.data;
  const chartData = useMemo(
    () =>
      data?.appointmentsByPeriod.map((item) => ({
        ...item,
        label: formatStatisticPeriod(item.period, filters.groupBy),
      })) ?? [],
    [data?.appointmentsByPeriod, filters.groupBy],
  );

  return (
    <AdminShell title="Tổng quan">
      <section className="grid gap-6">
        <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <div>
              <p className="text-sm font-semibold uppercase text-primary">
                Điều hành hệ thống
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Dashboard quản trị
              </h1>
              <p className="mt-2 max-w-3xl leading-7 text-muted-foreground">
                Theo dõi lưu lượng lịch khám, tài khoản đang hoạt động và nhóm
                bác sĩ có nhiều phiên tư vấn nhất.
              </p>
            </div>
            <Button
              onClick={() => setFilters(defaultFilters())}
              variant="outline"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Đặt lại
            </Button>
          </div>

          <div className="mt-5 grid gap-3 border-t border-blue-100 pt-5 md:grid-cols-3">
            <Field label="Từ ngày">
              <Input
                onDateChange={(dateValue) =>
                  setFilters((current) => ({
                    ...current,
                    from: dateValue,
                  }))
                }
                type="date"
                value={filters.from}
              />
            </Field>
            <Field label="Đến ngày">
              <Input
                onDateChange={(dateValue) =>
                  setFilters((current) => ({
                    ...current,
                    to: dateValue,
                  }))
                }
                type="date"
                value={filters.to}
              />
            </Field>
            <Field label="Nhóm dữ liệu">
              <Select
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    groupBy: event.target.value as GroupBy,
                  }))
                }
                value={filters.groupBy}
              >
                <option value="day">Theo ngày</option>
                <option value="week">Theo tuần</option>
                <option value="month">Theo tháng</option>
              </Select>
            </Field>
          </div>
        </div>

        {dashboardQuery.isLoading ? (
          <LoadingBlock label="Đang tải dashboard..." />
        ) : dashboardQuery.isError ? (
          <ErrorState message="Chưa tải được dashboard admin." />
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <MetricCard
                icon={BarChart3}
                label="Tổng lịch"
                value={data?.summary.totalAppointments ?? 0}
              />
              <MetricCard
                icon={CheckCircle2}
                label="Hoàn thành"
                value={data?.summary.completedAppointments ?? 0}
              />
              <MetricCard
                icon={Activity}
                label="Tỷ lệ hoàn thành"
                suffix="%"
                value={Math.round(data?.summary.completionRate ?? 0)}
              />
              <MetricCard
                icon={UsersRound}
                label="Bệnh nhân active"
                value={data?.system?.activePatients ?? 0}
              />
              <MetricCard
                icon={Stethoscope}
                label="Bác sĩ active"
                value={data?.system?.activeDoctors ?? 0}
              />
              <MetricCard
                icon={UsersRound}
                label="Bệnh nhân mới"
                value={data?.system?.newPatients ?? 0}
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-900">
                  Lịch khám theo thời gian
                </h2>
                <div className="mt-5 h-80">
                  <ResponsiveContainer height="100%" width="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                      <XAxis dataKey="label" fontSize={12} tickLine={false} />
                      <YAxis allowDecimals={false} fontSize={12} />
                      <Tooltip />
                      <Bar
                        dataKey="total"
                        fill="#2563eb"
                        name="Tổng lịch"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="completed"
                        fill="#16a34a"
                        name="Hoàn thành"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-900">
                  Trạng thái lịch
                </h2>
                <div className="mt-5 space-y-3">
                  {Object.entries(appointmentStatusMeta).map(
                    ([status, meta]) => (
                      <div
                        className="rounded-lg border border-blue-100 bg-slate-50 p-3"
                        key={status}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-slate-700">
                            {meta.label}
                          </span>
                          <span className="text-lg font-bold text-slate-900">
                            {data?.statusBreakdown[
                              status as AppointmentStatus
                            ] ?? 0}
                          </span>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">
                Top bác sĩ theo lịch khám
              </h2>
              <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
                {data?.system?.topDoctors.length ? (
                  data.system.topDoctors.map((doctor) => (
                    <article
                      className="rounded-lg border border-blue-100 bg-slate-50 p-4"
                      key={doctor.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-bold text-slate-900">
                          {doctor.fullName}
                        </h3>
                        <UserStatusBadge status={doctor.status} />
                      </div>
                      <p className="mt-3 text-2xl font-bold text-primary">
                        {doctor.totalAppointments}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {doctor.completedAppointments} lịch hoàn thành
                      </p>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Chưa có dữ liệu bác sĩ trong khoảng đã chọn.
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </section>
    </AdminShell>
  );
}

function MetricCard({
  icon: Icon,
  label,
  suffix = "",
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  suffix?: string;
  value: number;
}) {
  return (
    <article className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
      <span className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-primary">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <p className="mt-4 text-3xl font-bold text-slate-900">
        {value}
        {suffix}
      </p>
      <p className="mt-1 text-sm font-semibold text-muted-foreground">
        {label}
      </p>
    </article>
  );
}
