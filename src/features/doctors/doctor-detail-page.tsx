"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  GraduationCap,
  Medal,
  MessageSquareText,
  Star,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";

import { PublicShell } from "@/components/public/public-shell";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import {
  getDoctor,
  getDoctorReviews,
  getDoctorSchedule,
} from "@/lib/api/public";
import { formatDate, formatRating, formatTimeRange } from "@/lib/format";

import { DoctorAvatar } from "./doctor-avatar";

type DoctorDetailPageProps = {
  doctorId: string;
};

export function DoctorDetailPage({ doctorId }: DoctorDetailPageProps) {
  const doctorQuery = useQuery({
    enabled: Boolean(doctorId),
    queryFn: () => getDoctor(doctorId),
    queryKey: ["public", "doctor", doctorId],
  });

  const scheduleQuery = useQuery({
    enabled: Boolean(doctorId),
    queryFn: () => getDoctorSchedule(doctorId),
    queryKey: ["public", "doctor", doctorId, "schedule"],
  });

  const reviewsQuery = useQuery({
    enabled: Boolean(doctorId),
    queryFn: () => getDoctorReviews(doctorId, { limit: 5, order: "desc" }),
    queryKey: ["public", "doctor", doctorId, "reviews"],
  });

  const doctor = doctorQuery.data;
  const bookingPath = `/patient/book/${doctorId}`;
  const loginPath = `/auth/patient?next=${encodeURIComponent(bookingPath)}`;
  const specialties =
    doctor?.specialties?.map((specialty) => specialty.name).filter(Boolean) ??
    [];
  const ratingAverage =
    reviewsQuery.data?.summary?.ratingAverage ??
    doctor?.ratingSummary?.ratingAverage ??
    doctor?.ratingAverage;
  const reviewCount =
    reviewsQuery.data?.summary?.reviewCount ??
    doctor?.ratingSummary?.reviewCount ??
    doctor?.reviewCount ??
    0;
  const reviews = reviewsQuery.data?.items ?? doctor?.reviews ?? [];

  return (
    <PublicShell>
      <main className="bg-slate-50/70">
        <section className="border-b border-blue-100 bg-white py-8">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <Link
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
              href="/doctors"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Quay lại danh sách bác sĩ
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {doctorQuery.isLoading ? (
            <LoadingBlock label="Đang tải hồ sơ bác sĩ..." />
          ) : doctorQuery.isError || !doctor ? (
            <ErrorState message="Không tìm thấy hoặc chưa tải được hồ sơ bác sĩ." />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
                <div className="grid gap-5 md:grid-cols-[220px_1fr]">
                  <div className="aspect-[4/5] overflow-hidden rounded-lg border border-blue-100 bg-blue-50">
                    <DoctorAvatar
                      alt={doctor.fullName}
                      src={doctor.avatarUrl}
                    />
                  </div>

                  <div>
                    <div className="flex flex-wrap gap-2">
                      {specialties.length ? (
                        specialties.map((specialty) => (
                          <span
                            className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-primary"
                            key={specialty}
                          >
                            {specialty}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-primary">
                          Bác sĩ chuyên khoa
                        </span>
                      )}
                    </div>

                    <h1 className="mt-4 text-3xl font-bold text-slate-900">
                      {doctor.fullName}
                    </h1>

                    <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                      <p className="flex items-center gap-2">
                        <Medal
                          aria-hidden="true"
                          className="size-4 text-primary"
                        />
                        {doctor.yearsOfExperience ?? 0} năm kinh nghiệm
                      </p>
                      <p className="flex items-center gap-2">
                        <Star
                          aria-hidden="true"
                          className="size-4 fill-amber-500 text-amber-500"
                        />
                        {formatRating(ratingAverage)} ({reviewCount} đánh giá)
                      </p>
                      <p className="flex items-center gap-2 sm:col-span-2">
                        <GraduationCap
                          aria-hidden="true"
                          className="size-4 text-primary"
                        />
                        {doctor.qualifications?.length
                          ? doctor.qualifications.join(", ")
                          : "Thông tin bằng cấp đang cập nhật"}
                      </p>
                    </div>

                    <div className="mt-6 border-t border-blue-100 pt-5">
                      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                        <Stethoscope
                          aria-hidden="true"
                          className="size-5 text-primary"
                        />
                        Giới thiệu
                      </h2>
                      <p className="mt-3 leading-7 text-muted-foreground">
                        {doctor.bio ??
                          "Thông tin giới thiệu của bác sĩ đang được cập nhật."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <aside className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <CalendarDays
                    aria-hidden="true"
                    className="size-5 text-primary"
                  />
                  Lịch trống 7 ngày
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Chọn khung giờ ở phase đặt lịch. Hiện tại nút đặt lịch sẽ đưa
                  bệnh nhân đến đăng nhập trước.
                </p>

                <Link
                  className={buttonVariants({
                    className: "mt-5 w-full",
                    size: "lg",
                    variant: "success",
                  })}
                  href={loginPath}
                >
                  <CalendarPlus aria-hidden="true" className="size-5" />
                  Đặt lịch hẹn
                </Link>

                <div className="mt-5 space-y-4">
                  {scheduleQuery.isLoading ? (
                    <LoadingBlock
                      className="min-h-32"
                      label="Đang tải lịch..."
                    />
                  ) : scheduleQuery.isError ? (
                    <ErrorState message="Chưa tải được lịch trống của bác sĩ." />
                  ) : scheduleQuery.data?.days.length ? (
                    scheduleQuery.data.days.map((day) => (
                      <div
                        className="border-t border-blue-100 pt-4"
                        key={day.date}
                      >
                        <p className="font-semibold text-slate-900">
                          {formatDate(`${day.date}T00:00:00+07:00`)}
                        </p>
                        {day.slots.length ? (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {day.slots.slice(0, 6).map((slot) => (
                              <span
                                className="rounded-md border border-blue-100 bg-blue-50 px-2 py-1.5 text-center text-xs font-semibold text-primary"
                                key={slot.startAt}
                              >
                                {formatTimeRange(slot.startAt, slot.endAt)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-muted-foreground">
                            Không còn slot trống.
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      className="p-5"
                      description="Bác sĩ hiện chưa có slot trống trong 7 ngày tới."
                      title="Chưa có lịch trống"
                    />
                  )}
                </div>
              </aside>

              <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm lg:col-span-2">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                    <MessageSquareText
                      aria-hidden="true"
                      className="size-5 text-primary"
                    />
                    Đánh giá từ bệnh nhân
                  </h2>
                  <span className="rounded-md bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">
                    {formatRating(ratingAverage)}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {reviewsQuery.isLoading ? (
                    <LoadingBlock
                      className="md:col-span-2"
                      label="Đang tải đánh giá..."
                    />
                  ) : reviewsQuery.isError ? (
                    <ErrorState
                      className="md:col-span-2"
                      message="Chưa tải được đánh giá của bác sĩ."
                    />
                  ) : reviews.length ? (
                    reviews.map((review) => (
                      <article
                        className="rounded-lg border border-blue-100 bg-slate-50 p-4"
                        key={review.id}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-900">
                            {review.patientDisplayName ?? "Bệnh nhân"}
                          </p>
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700">
                            <Star
                              aria-hidden="true"
                              className="size-4 fill-current"
                            />
                            {review.rating}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                          {review.comment ?? "Bệnh nhân không để lại nhận xét."}
                        </p>
                        {review.doctorReply?.content ? (
                          <p className="mt-3 rounded-md bg-white p-3 text-sm leading-6 text-slate-700">
                            Phản hồi: {review.doctorReply.content}
                          </p>
                        ) : null}
                      </article>
                    ))
                  ) : (
                    <EmptyState
                      className="md:col-span-2"
                      description="Các đánh giá đã xuất bản sẽ hiển thị tại đây."
                      title="Chưa có đánh giá"
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </PublicShell>
  );
}
