import { CalendarDays, Clock, FileText, UserRound, Video } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/appointment/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatTimeRange } from "@/lib/format";
import type { Appointment } from "@/types/api";

export function DoctorAppointmentCard({
  appointment,
}: {
  appointment: Appointment;
}) {
  const patientName =
    appointment.patient?.fullName ??
    appointment.patient?.patientProfile?.fullName ??
    "Bệnh nhân";

  return (
    <article className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={appointment.status} />
            {appointment.meetingUrl ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700">
                <Video aria-hidden="true" className="size-3.5" />
                Có link Meet
              </span>
            ) : null}
          </div>

          <h3 className="mt-3 text-lg font-bold text-slate-900">
            {patientName}
          </h3>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
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
            <p className="flex items-center gap-2 sm:col-span-2">
              <FileText aria-hidden="true" className="size-4 text-primary" />
              {appointment.visitReason}
            </p>
            {appointment.patient?.patientProfile?.drugAllergies ? (
              <p className="flex items-center gap-2 sm:col-span-2">
                <UserRound aria-hidden="true" className="size-4 text-red-600" />
                Dị ứng: {appointment.patient.patientProfile.drugAllergies}
              </p>
            ) : null}
          </div>
        </div>

        <Link
          className={buttonVariants({ size: "sm", variant: "primary" })}
          href={`/doctor/appointments/${appointment.id}`}
        >
          Xem chi tiết
        </Link>
      </div>
    </article>
  );
}
