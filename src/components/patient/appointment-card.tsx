import {
  CalendarDays,
  CalendarPlus,
  Clock,
  Stethoscope,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/appointment/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatTimeRange } from "@/lib/format";
import type { Appointment } from "@/types/api";

export function AppointmentCard({
  appointment,
  showReviewAction,
}: {
  appointment: Appointment;
  showReviewAction?: boolean;
}) {
  const doctorName = appointment.doctor?.fullName ?? "Bác sĩ";
  const specialties =
    appointment.doctor?.specialties
      ?.map((specialty) => specialty.name)
      .filter(Boolean)
      .join(", ") ?? "Chuyên khoa";

  return (
    <article className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={appointment.status} />
            {appointment.meetingUrl ? (
              <span className="rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700">
                Có link phòng khám
              </span>
            ) : null}
          </div>

          <h3 className="mt-3 text-lg font-bold text-slate-900">
            {doctorName}
          </h3>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <p className="flex items-center gap-2">
              <Stethoscope aria-hidden="true" className="size-4 text-primary" />
              {specialties}
            </p>
            <p className="flex items-center gap-2">
              <CalendarDays
                aria-hidden="true"
                className="size-4 text-primary"
              />
              {formatDate(appointment.startAt)}
            </p>
            <p className="flex items-center gap-2">
              <Clock aria-hidden="true" className="size-4 text-primary" />
              {formatTimeRange(appointment.startAt, appointment.endAt)}
            </p>
            <p className="flex items-center gap-2">
              <UserRound aria-hidden="true" className="size-4 text-primary" />
              Lý do: {appointment.visitReason}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
          {showReviewAction && appointment.status === "COMPLETED" ? (
            <Link
              className={buttonVariants({ size: "sm", variant: "success" })}
              href={`/patient/reviews/${appointment.doctorID}`}
            >
              <CalendarPlus aria-hidden="true" className="size-4" />
              Đánh giá
            </Link>
          ) : null}
          <Link
            className={buttonVariants({ size: "sm", variant: "primary" })}
            href={`/patient/appointments/${appointment.id}`}
          >
            Xem chi tiết
          </Link>
        </div>
      </div>
    </article>
  );
}
