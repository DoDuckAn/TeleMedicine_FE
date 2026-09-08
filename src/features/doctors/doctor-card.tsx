import {
  CalendarPlus,
  GraduationCap,
  Medal,
  Star,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { formatRating } from "@/lib/format";
import { useAuthStore } from "@/lib/auth/session-store";
import { cn } from "@/lib/utils";
import type { DoctorSummary } from "@/types/api";

import { DoctorAvatar } from "./doctor-avatar";

type DoctorCardProps = {
  className?: string;
  doctor: DoctorSummary;
  featured?: boolean;
};

export function DoctorCard({ className, doctor, featured }: DoctorCardProps) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const specialties =
    doctor.specialties?.map((specialty) => specialty.name).filter(Boolean) ??
    [];
  const detailPath =
    accessToken && user?.role === "PATIENT"
      ? `/patient/doctors/${doctor.userID}`
      : `/doctors/${doctor.userID}`;
  const bookingPath = `/patient/book/${doctor.userID}`;
  const loginPath = `/auth/patient?next=${encodeURIComponent(bookingPath)}`;
  const canBook = !user || user.role === "PATIENT";
  const bookingHref =
    accessToken && user?.role === "PATIENT" ? bookingPath : loginPath;

  return (
    <article
      className={cn(
        "grid gap-4 rounded-lg border border-blue-100 bg-white p-4 shadow-sm transition hover:border-primary/40 hover:shadow-soft md:grid-cols-[180px_1fr_auto]",
        featured ? "md:grid-cols-[150px_1fr]" : null,
        className,
      )}
    >
      <Link
        className="block aspect-[4/3] overflow-hidden rounded-lg border border-blue-100 bg-blue-50 md:aspect-square"
        href={detailPath}
      >
        <DoctorAvatar alt={doctor.fullName} src={doctor.avatarUrl} />
      </Link>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-primary">
            <Stethoscope aria-hidden="true" className="size-3.5" />
            {specialties[0] ?? "Bác sĩ chuyên khoa"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
            <Star aria-hidden="true" className="size-3.5 fill-current" />
            {formatRating(doctor.ratingAverage)}
          </span>
        </div>

        <Link href={detailPath}>
          <h3 className="mt-3 text-xl font-bold text-slate-900 transition hover:text-primary">
            {doctor.fullName}
          </h3>
        </Link>

        <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <p className="flex items-center gap-2">
            <Medal aria-hidden="true" className="size-4 text-primary" />
            {doctor.yearsOfExperience ?? 0} năm kinh nghiệm
          </p>
          <p className="flex items-center gap-2">
            <GraduationCap aria-hidden="true" className="size-4 text-primary" />
            {doctor.qualifications?.[0] ?? "Thông tin bằng cấp đang cập nhật"}
          </p>
        </div>

        {doctor.bio ? (
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {doctor.bio}
          </p>
        ) : null}

        {specialties.length > 1 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {specialties.slice(1, 4).map((specialty) => (
              <span
                className="rounded-md border border-blue-100 px-2 py-1 text-xs font-medium text-slate-600"
                key={specialty}
              >
                {specialty}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {!featured ? (
        <div className="flex items-end gap-2 md:flex-col md:justify-end">
          {canBook && (
            <Link
              className={buttonVariants({ size: "sm", variant: "success" })}
              href={bookingHref}
            >
              <CalendarPlus aria-hidden="true" className="size-4" />
              Đặt lịch hẹn
            </Link>
          )}
          <Link
            className={buttonVariants({ size: "sm", variant: "primary" })}
            href={detailPath}
          >
            Xem chi tiết
          </Link>
        </div>
      ) : null}
    </article>
  );
}
