"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock,
  Search,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { AppointmentCard } from "@/components/patient/appointment-card";
import { PatientShell } from "@/components/patient/patient-shell";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { getUnreadNotificationCount } from "@/lib/api/notifications";
import {
  getPatientMe,
  getPatientUpcomingAppointments,
} from "@/lib/api/patient";
import { useAuthStore } from "@/lib/auth/session-store";

export function PatientDashboardPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const auth = { accessToken: accessToken ?? "" };
  const enabled = Boolean(accessToken);

  const profileQuery = useQuery({
    enabled,
    queryFn: () => getPatientMe(auth),
    queryKey: ["patient", "me"],
  });

  const upcomingQuery = useQuery({
    enabled,
    queryFn: () => getPatientUpcomingAppointments({ limit: 4, page: 1 }, auth),
    queryKey: ["patient", "appointments", "upcoming", "dashboard"],
  });

  const unreadQuery = useQuery({
    enabled,
    queryFn: () => getUnreadNotificationCount(auth),
    queryKey: ["notifications", "unread-count"],
  });

  const upcomingAppointments = upcomingQuery.data?.items ?? [];
  const confirmedCount = upcomingAppointments.filter(
    (appointment) => appointment.status === "CONFIRMED",
  ).length;
  const pendingCount = upcomingAppointments.filter(
    (appointment) => appointment.status === "PENDING_CONFIRMATION",
  ).length;

  return (
    <PatientShell title="Tổng quan">
      <div className="grid gap-6">
        <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase text-primary">
                Xin chào
              </p>
              <h2 className="mt-1 text-3xl font-bold text-slate-900">
                {profileQuery.data?.patientProfile.fullName ?? "Bệnh nhân"}
              </h2>
            </div>
            <Link
              className={buttonVariants({ size: "lg", variant: "success" })}
              href="/patient/doctors"
            >
              <Search aria-hidden="true" className="size-5" />
              Tìm bác sĩ đặt lịch
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <MetricCard
            icon={CalendarClock}
            label="Lịch sắp tới"
            value={upcomingAppointments.length}
          />
          <MetricCard icon={Clock} label="Chờ xác nhận" value={pendingCount} />
          <MetricCard
            icon={CheckCircle2}
            label="Đã xác nhận"
            value={confirmedCount}
          />
          <MetricCard
            icon={BellRing}
            label="Thông báo chưa đọc"
            value={unreadQuery.data?.count ?? 0}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase text-primary">
                  Lịch hẹn
                </p>
                <h2 className="text-2xl font-bold text-slate-900">
                  Sắp diễn ra
                </h2>
              </div>
              <Link
                className={buttonVariants({ size: "sm", variant: "outline" })}
                href="/patient/appointments"
              >
                Xem tất cả
              </Link>
            </div>

            <div className="space-y-4">
              {upcomingQuery.isLoading ? (
                <LoadingBlock label="Đang tải lịch hẹn..." />
              ) : upcomingQuery.isError ? (
                <ErrorState message="Chưa tải được lịch hẹn sắp tới." />
              ) : upcomingAppointments.length ? (
                upcomingAppointments.map((appointment) => (
                  <AppointmentCard
                    appointment={appointment}
                    key={appointment.id}
                  />
                ))
              ) : (
                <EmptyState
                  action={
                    <Link
                      className={buttonVariants({
                        size: "md",
                        variant: "success",
                      })}
                      href="/patient/doctors"
                    >
                      Tìm bác sĩ
                    </Link>
                  }
                  description="Bạn chưa có lịch hẹn sắp tới. Hãy chọn bác sĩ và khung giờ còn trống để đặt lịch."
                  title="Chưa có lịch hẹn"
                />
              )}
            </div>
          </div>

          <aside className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <UserRound aria-hidden="true" className="size-5 text-primary" />
              Hồ sơ khám
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Bác sĩ sẽ thấy thông tin hồ sơ cần thiết trước buổi tư vấn. Cập
              nhật tiền sử bệnh và dị ứng thuốc để hỗ trợ khám chính xác hơn.
            </p>
            <div className="mt-5 space-y-3 text-sm">
              <InfoLine
                label="Số điện thoại"
                value={profileQuery.data?.phone ?? "Chưa có"}
              />
              <InfoLine
                label="Email"
                value={profileQuery.data?.email ?? "Chưa cập nhật"}
              />
              <InfoLine
                label="Dị ứng thuốc"
                value={
                  profileQuery.data?.patientProfile.drugAllergies ??
                  "Chưa cập nhật"
                }
              />
            </div>
            <Link
              className={buttonVariants({
                className: "mt-5 w-full",
                size: "md",
                variant: "primary",
              })}
              href="/patient/profile"
            >
              Cập nhật hồ sơ
            </Link>
          </aside>
        </section>
      </div>
    </PatientShell>
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

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="font-semibold text-slate-900">{label}</p>
      <p className="mt-1 text-muted-foreground">{value}</p>
    </div>
  );
}
