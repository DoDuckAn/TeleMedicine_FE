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

import { DoctorShell } from "@/components/doctor/doctor-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { getDoctorStatistics } from "@/lib/api/doctor";
import { appointmentStatusMeta } from "@/lib/appointment-status";
import {
  addDaysToDateOnly,
  dateOnlyEndIso,
  dateOnlyStartIso,
  todayInVietnamDateOnly,
} from "@/lib/doctor-schedule";
import { useAuthStore } from "@/lib/auth/session-store";
import { formatDate } from "@/lib/format";
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

export function DoctorStatisticsPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const auth = { accessToken: accessToken ?? "" };
  const [filters, setFilters] = useState(defaultFilters);

  const statisticsQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () =>
      getDoctorStatistics(
        {
          from: dateOnlyStartIso(filters.from),
          groupBy: filters.groupBy,
          to: dateOnlyEndIso(filters.to),
        },
        auth,
      ),
    queryKey: ["doctor", "statistics", filters],
  });

  const data = statisticsQuery.data;
  const summary = data?.summary;
  const chartData = useMemo(
    () =>
      data?.appointmentsByPeriod.map((item) => ({
        ...item,
        label: formatPeriod(item.period, filters.groupBy),
      })) ?? [],
    [data?.appointmentsByPeriod, filters.groupBy],
  );

  return (
    <DoctorShell title="Thống kê">
      <section className="grid gap-6">
        <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <div>
              <p className="text-sm font-semibold uppercase text-primary">
                Hiệu suất tư vấn
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Thống kê cá nhân
              </h1>
              <p className="mt-2 max-w-3xl leading-7 text-muted-foreground">
                Theo dõi tổng lịch khám, tỷ lệ hoàn thành và số bệnh nhân duy
                nhất trong khoảng thời gian đã chọn.
              </p>
            </div>
            <Button
              onClick={() => setFilters(defaultFilters())}
              variant="outline"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Đặt lại bộ lọc
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

        {statisticsQuery.isLoading ? (
          <LoadingBlock label="Đang tải thống kê..." />
        ) : statisticsQuery.isError ? (
          <ErrorState message="Chưa tải được thống kê bác sĩ." />
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                icon={BarChart3}
                label="Tổng lịch"
                value={summary?.totalAppointments ?? 0}
              />
              <MetricCard
                icon={CheckCircle2}
                label="Hoàn thành"
                value={summary?.completedAppointments ?? 0}
              />
              <MetricCard
                icon={Activity}
                label="Đã xử lý"
                value={summary?.resolvedAppointments ?? 0}
              />
              <MetricCard
                icon={Stethoscope}
                label="Tỷ lệ hoàn thành"
                suffix="%"
                value={Math.round(summary?.completionRate ?? 0)}
              />
              <MetricCard
                icon={UsersRound}
                label="Bệnh nhân"
                value={summary?.uniquePatients ?? 0}
              />
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
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
                  Trạng thái lịch hẹn
                </h2>
                <div className="mt-5 space-y-3">
                  {Object.entries(appointmentStatusMeta).map(
                    ([status, meta]) => {
                      const count =
                        data?.statusBreakdown[status as AppointmentStatus] ?? 0;

                      return (
                        <div
                          className="rounded-lg border border-blue-100 bg-slate-50 p-3"
                          key={status}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-slate-700">
                              {meta.label}
                            </span>
                            <span className="text-lg font-bold text-slate-900">
                              {count}
                            </span>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </section>
    </DoctorShell>
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

function formatPeriod(period: string, groupBy: GroupBy) {
  if (groupBy === "month" && /^\d{4}-\d{2}/.test(period)) {
    return `${period.slice(5, 7)}/${period.slice(0, 4)}`;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(period)) {
    return formatDate(`${period.slice(0, 10)}T00:00:00+07:00`);
  }

  return period;
}
