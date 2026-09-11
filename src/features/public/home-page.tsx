"use client";

import {
  BellRing,
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  Hospital,
  Search,
  ShieldCheck,
  Stethoscope,
  UsersRound,
  Video,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { PublicShell } from "@/components/public/public-shell";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { DoctorCard } from "@/features/doctors/doctor-card";
import { getDoctors, getSpecialties } from "@/lib/api/public";

const featureCards = [
  {
    description: "Chọn chuyên khoa phù hợp với triệu chứng hiện tại.",
    icon: Hospital,
    title: "Danh mục chuyên khoa",
  },
  {
    description: "Xem kinh nghiệm, bằng cấp và đánh giá trước khi đặt hẹn.",
    icon: Stethoscope,
    title: "Lựa chọn bác sĩ",
  },
  {
    description: "Chọn khung giờ phù hợp và gửi yêu cầu hẹn.",
    icon: CalendarCheck,
    title: "Đặt hẹn trực tuyến",
  },
  {
    description: "Nhận nhắc lịch và vào phòng khám khi đến giờ tư vấn.",
    icon: BellRing,
    title: "Nhắc lịch khám",
  },
];

const stats = [
  { icon: ShieldCheck, label: "Bác sĩ được quản lý hồ sơ rõ ràng" },
  { icon: CalendarPlus, label: "Chủ động chọn khung giờ còn trống" },
  { icon: Video, label: "Tư vấn qua Google Meet khi lịch được xác nhận" },
  { icon: UsersRound, label: "Hồ sơ bệnh nhân gửi trước cho bác sĩ" },
];

export function HomePage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");

  const specialtiesQuery = useQuery({
    queryFn: getSpecialties,
    queryKey: ["public", "specialties"],
  });

  const doctorsQuery = useQuery({
    queryFn: () => getDoctors({ limit: 3, order: "desc", sortBy: "rating" }),
    queryKey: ["public", "doctors", "featured"],
  });

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();

    if (keyword.trim()) {
      params.set("q", keyword.trim());
    }

    router.push(`/doctors${params.size ? `?${params.toString()}` : ""}`);
  }

  return (
    <PublicShell>
      <main>
        <section className="bg-primary pb-12 pt-8 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-lg border border-white/20 bg-blue-700 shadow-soft">
              <Image
                alt="Bác sĩ tư vấn khám bệnh từ xa qua video"
                className="absolute inset-0 h-full w-full object-cover"
                fill
                priority
                src="/images/telemedicine-hero.png"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-blue-950/82 via-blue-800/54 to-blue-600/5" />
              <div className="relative grid min-h-[360px] items-center px-5 py-10 sm:px-10 lg:grid-cols-[0.92fr_1fr]">
                <div className="max-w-xl">
                  <p className="inline-flex items-center gap-2 rounded-md bg-white/14 px-3 py-1.5 text-sm font-semibold text-blue-600">
                    <CheckCircle2 aria-hidden="true" className="size-4" />
                    Tư vấn sức khỏe trong tầm tay
                  </p>
                  <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl text-blue-600">
                    Đặt lịch khám từ xa với bác sĩ chuyên khoa
                  </h1>
                  <p className="mt-4 text-md leading-7 text-blue-600">
                    Tìm bác sĩ, chọn khung giờ còn trống và nhận tư vấn video
                    sau khi lịch được xác nhận.
                  </p>

                  <form
                    className="mt-7 flex flex-col gap-3 rounded-lg bg-white p-2 shadow-lg sm:flex-row"
                    onSubmit={handleSearch}
                  >
                    <label className="flex min-h-12 flex-1 items-center gap-2 rounded-md px-3 text-slate-700">
                      <Search
                        aria-hidden="true"
                        className="size-5 text-primary"
                      />
                      <input
                        className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400 focus:ring-0"
                        onChange={(event) => setKeyword(event.target.value)}
                        placeholder="Tìm bác sĩ hoặc chuyên khoa"
                        value={keyword}
                      />
                    </label>
                    <button
                      className={buttonVariants({
                        size: "lg",
                        variant: "success",
                      })}
                      type="submit"
                    >
                      Tìm bác sĩ
                    </button>
                  </form>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => {
                const Icon = stat.icon;

                return (
                  <div
                    className="flex items-center gap-3 rounded-lg bg-white/10 p-4 text-sm font-semibold text-blue-50"
                    key={stat.label}
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/14">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    {stat.label}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase text-primary">
              Quy trình khám từ xa
            </p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">
              Chăm sóc sức khỏe trong tầm tay
            </h2>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featureCards.map((feature) => {
              const Icon = feature.icon;

              return (
                <article
                  className="rounded-lg border border-blue-200 bg-white p-6 text-center shadow-sm transition hover:border-primary hover:shadow-soft"
                  key={feature.title}
                >
                  <span className="mx-auto flex size-16 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-primary">
                    <Icon aria-hidden="true" className="size-8" />
                  </span>
                  <h3 className="mt-5 text-lg font-bold text-slate-900">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {feature.description}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="bg-sky-50/70 py-12">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
            <div>
              <p className="text-sm font-semibold uppercase text-primary">
                Chuyên khoa
              </p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900">
                Chọn đúng chuyên khoa trước khi đặt lịch
              </h2>
              <p className="mt-4 leading-7 text-muted-foreground">
                Danh mục chuyên khoa được quản lý bởi hệ thống, giúp bệnh nhân
                lọc bác sĩ phù hợp và đặt hẹn nhanh hơn.
              </p>
              <Link className={cnButton("mt-6", "primary")} href="/doctors">
                Xem tất cả bác sĩ
              </Link>
            </div>

            <div>
              {specialtiesQuery.isLoading ? (
                <LoadingBlock label="Đang tải chuyên khoa..." />
              ) : specialtiesQuery.isError ? (
                <ErrorState message="Chưa tải được danh sách chuyên khoa. Vui lòng thử lại." />
              ) : specialtiesQuery.data?.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {specialtiesQuery.data.slice(0, 6).map((specialty) => (
                    <Link
                      className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm transition hover:border-primary hover:shadow-soft"
                      href={`/doctors?specialtyId=${specialty.id}`}
                      key={specialty.id}
                    >
                      <p className="font-bold text-slate-900">
                        {specialty.name}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {specialty.description ??
                          "Xem bác sĩ thuộc chuyên khoa này"}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  description="Hiện chưa có chuyên khoa để hiển thị."
                  title="Chưa có chuyên khoa"
                />
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold uppercase text-primary">
                Chuyên gia - Bác sĩ
              </p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900">
                Bác sĩ được đánh giá nổi bật
              </h2>
            </div>
            <Link
              className={buttonVariants({ size: "md", variant: "outline" })}
              href="/doctors"
            >
              Xem danh sách
            </Link>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {doctorsQuery.isLoading ? (
              <LoadingBlock
                className="lg:col-span-3"
                label="Đang tải bác sĩ..."
              />
            ) : doctorsQuery.isError ? (
              <ErrorState
                className="lg:col-span-3"
                message="Chưa tải được danh sách bác sĩ. Vui lòng thử lại."
              />
            ) : doctorsQuery.data?.items.length ? (
              doctorsQuery.data.items.map((doctor) => (
                <DoctorCard doctor={doctor} featured key={doctor.userID} />
              ))
            ) : (
              <EmptyState
                className="lg:col-span-3"
                description="Hiện chưa có bác sĩ để hiển thị."
                title="Chưa có bác sĩ"
              />
            )}
          </div>
        </section>
      </main>
    </PublicShell>
  );
}

function cnButton(
  className: string,
  variant: "primary" | "success" | "outline",
) {
  return buttonVariants({ className, size: "md", variant });
}
