"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Search, SlidersHorizontal } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { PatientShell } from "@/components/patient/patient-shell";
import { BookingProgress } from "@/components/patient/booking-progress";
import { PublicShell } from "@/components/public/public-shell";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { getDoctors, getSpecialties } from "@/lib/api/public";

import { DoctorCard } from "./doctor-card";

export function DoctorsListPage({ patient = false }: { patient?: boolean }) {
  const Shell = patient ? PatientShell : PublicShell;
  const searchParams = useSearchParams();
  const [keyword, setKeyword] = useState(() => searchParams.get("q") ?? "");
  const [specialtyId, setSpecialtyId] = useState(
    () => searchParams.get("specialtyId") ?? "",
  );
  const [sortBy, setSortBy] = useState<"name" | "rating">("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const debouncedKeyword = useDebouncedValue(keyword, 300);

  const specialtiesQuery = useQuery({
    queryFn: getSpecialties,
    queryKey: ["public", "specialties"],
  });

  const doctorsQuery = useQuery({
    placeholderData: keepPreviousData,
    queryFn: () =>
      getDoctors({
        limit: 8,
        order,
        page,
        q: debouncedKeyword,
        sortBy,
        specialtyId,
      }),
    queryKey: [
      "public",
      "doctors",
      { debouncedKeyword, order, page, sortBy, specialtyId },
    ],
  });

  const totalPages = doctorsQuery.data?.pagination.totalPages ?? 1;
  const totalDoctors = doctorsQuery.data?.pagination.total ?? 0;
  const doctors = doctorsQuery.data?.items ?? [];

  return (
    <Shell title={patient ? "Đặt lịch hẹn" : "Tìm bác sĩ"}>
      {patient && <BookingProgress step={1} />}
      <main className="bg-slate-50/70">
        <section className="border-b border-blue-100 bg-white py-10">
          <div className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase text-primary">
              Chuyên gia - Bác sĩ
            </p>
            <h1 className="mt-2 text-4xl font-bold text-slate-900">
              Tìm bác sĩ phù hợp
            </h1>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px_160px]">
              <label className="relative">
                <Search
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary"
                />
                <Input
                  className="pl-9"
                  onChange={(event) => {
                    setKeyword(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Tìm tên bác sĩ hoặc chuyên khoa"
                  value={keyword}
                />
              </label>

              <Select
                aria-label="Chuyên khoa"
                onChange={(event) => {
                  setSpecialtyId(event.target.value);
                  setPage(1);
                }}
                value={specialtyId}
              >
                <option value="">Tất cả chuyên khoa</option>
                {specialtiesQuery.data?.map((specialty) => (
                  <option key={specialty.id} value={specialty.id}>
                    {specialty.name}
                  </option>
                ))}
              </Select>

              <Select
                aria-label="Sắp xếp"
                onChange={(event) => {
                  setSortBy(event.target.value as "name" | "rating");
                  setPage(1);
                }}
                value={sortBy}
              >
                <option value="name">Sắp theo tên</option>
                <option value="rating">Sắp theo đánh giá</option>
              </Select>

              <Select
                aria-label="Thứ tự"
                onChange={(event) => {
                  setOrder(event.target.value as "asc" | "desc");
                  setPage(1);
                }}
                value={order}
              >
                <option value="asc">Tăng dần</option>
                <option value="desc">Giảm dần</option>
              </Select>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <SlidersHorizontal
                aria-hidden="true"
                className="size-4 text-primary"
              />
              {doctorsQuery.isSuccess
                ? `${totalDoctors} bác sĩ phù hợp`
                : "Đang lọc dữ liệu"}
            </p>
          </div>

          <div className="mt-5 space-y-5">
            {doctorsQuery.isLoading ? (
              <LoadingBlock label="Đang tải danh sách bác sĩ..." />
            ) : doctorsQuery.isError ? (
              <ErrorState message="Chưa tải được danh sách bác sĩ. Vui lòng thử lại." />
            ) : doctors.length ? (
              doctors.map((doctor) => (
                <DoctorCard doctor={doctor} key={doctor.userID} />
              ))
            ) : (
              <EmptyState
                description="Thử đổi từ khóa, chuyên khoa hoặc thứ tự sắp xếp."
                title="Không tìm thấy bác sĩ"
              />
            )}
          </div>

          {doctors.length ? (
            <div className="mt-8 flex items-center justify-between rounded-lg border border-blue-100 bg-white p-3">
              <Button
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                variant="outline"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Trang trước
              </Button>
              <p className="text-sm font-semibold text-slate-700">
                Trang {page} / {totalPages}
              </p>
              <Button
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                variant="outline"
              >
                Trang sau
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
          ) : null}
        </section>
      </main>
    </Shell>
  );
}
