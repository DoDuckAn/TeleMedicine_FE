"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CalendarOff } from "lucide-react";
import { getAdminDoctorOverrides } from "@/lib/api/admin";
import { getDoctorSchedule } from "@/lib/api/public";
import { useAuthStore } from "@/lib/auth/session-store";
import { formatDate, formatDateTime } from "@/lib/format";
import { AvailabilityView } from "@/components/doctor/availability-view";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ErrorState, LoadingBlock } from "@/components/ui/feedback";

export function AdminDoctorSchedule({
  doctorId,
  active,
}: {
  doctorId: string;
  active: boolean;
}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [view, setView] = useState<"overrides" | "available">("overrides");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const invalidRange = Boolean(from && to && to < from);
  const overrides = useQuery({
    enabled: Boolean(accessToken) && view === "overrides" && !invalidRange,
    queryKey: ["admin", "doctors", doctorId, "overrides", from, to],
    queryFn: () =>
      getAdminDoctorOverrides(
        doctorId,
        {
          from: from
            ? new Date(from + "T00:00:00+07:00").toISOString()
            : undefined,
          to: to
            ? new Date(
                new Date(to + "T00:00:00+07:00").getTime() + 86400000,
              ).toISOString()
            : undefined,
        },
        { accessToken: accessToken! },
      ),
  });
  const available = useQuery({
    enabled: view === "available" && active,
    queryKey: ["public", "doctor", doctorId, "schedule"],
    queryFn: () => getDoctorSchedule(doctorId),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  return (
    <section className="border-y border-blue-100 py-5">
      <div
        className="mb-5 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Lịch bác sĩ"
      >
        <Button
          role="tab"
          aria-selected={view === "overrides"}
          variant={view === "overrides" ? "primary" : "outline"}
          onClick={() => setView("overrides")}
        >
          <CalendarOff className="size-4" />
          Lịch nghỉ / làm thêm
        </Button>
        <Button
          role="tab"
          aria-selected={view === "available"}
          variant={view === "available" ? "primary" : "outline"}
          onClick={() => setView("available")}
        >
          <CalendarDays className="size-4" />
          Lịch có thể đặt
        </Button>
      </div>
      {view === "overrides" ? (
        <div>
          <div className="mb-4 grid max-w-lg grid-cols-2 gap-3">
            <Field label="Từ ngày">
              <Input
                type="date"
                value={from}
                onDateChange={(dateValue) => setFrom(dateValue)}
              />
            </Field>
            <Field label="Đến ngày">
              <Input
                type="date"
                value={to}
                onDateChange={(dateValue) => setTo(dateValue)}
              />
            </Field>
          </div>
          {invalidRange ? (
            <ErrorState message="Ngày kết thúc phải từ ngày bắt đầu trở đi." />
          ) : overrides.isLoading ? (
            <LoadingBlock />
          ) : overrides.isError ? (
            <ErrorState message="Không tải được lịch nghỉ / làm thêm." />
          ) : (
            <>
              {overrides.data && (
                <p className="mb-3 text-sm text-slate-600">
                  {formatDate(overrides.data.from)} -{" "}
                  {formatDate(overrides.data.to)}
                </p>
              )}
              <div className="divide-y divide-blue-100">
                {overrides.data?.items.map((item) => (
                  <div
                    className="grid gap-2 py-3 sm:grid-cols-[140px_1fr]"
                    key={item.id}
                  >
                    <span
                      className={
                        item.type === "AVAILABLE"
                          ? "font-semibold text-green-700"
                          : "font-semibold text-red-700"
                      }
                    >
                      {item.type === "AVAILABLE" ? "Làm thêm" : "Nghỉ đột xuất"}
                    </span>
                    <div>
                      <p>
                        {formatDateTime(item.startAt)} -{" "}
                        {formatDateTime(item.endAt)}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {item.reason}
                      </p>
                    </div>
                  </div>
                ))}
                {!overrides.data?.items.length && (
                  <p>Không có lịch nghỉ / làm thêm trong khoảng này.</p>
                )}
              </div>
            </>
          )}
        </div>
      ) : !active ? (
        <p>Tài khoản bác sĩ đã khóa, bệnh nhân không thể đặt lịch.</p>
      ) : available.isLoading ? (
        <LoadingBlock />
      ) : available.isError ? (
        <ErrorState message="Không tải được lịch có thể đặt." />
      ) : (
        <AvailabilityView key={doctorId} days={available.data?.days ?? []} />
      )}
    </section>
  );
}
