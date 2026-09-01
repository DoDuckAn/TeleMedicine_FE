"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Plus, Search, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { UserStatusBadge } from "@/components/admin/admin-badges";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusChangeModal } from "@/components/admin/status-change-modal";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import {
  listAdminDoctors,
  listAdminSpecialties,
  updateAdminDoctorStatus,
} from "@/lib/api/admin";
import { statusActionLabel } from "@/lib/admin-format";
import { useAuthStore } from "@/lib/auth/session-store";
import { formatDateTime, formatRating } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { AdminDoctor, UserStatus } from "@/types/api";

export function AdminDoctorsPage() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const auth = { accessToken: accessToken ?? "" };
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<UserStatus | "">("");
  const [specialtyId, setSpecialtyId] = useState("");
  const [sortBy, setSortBy] = useState<"createdAt" | "fullName">("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [statusTarget, setStatusTarget] = useState<AdminDoctor | null>(null);
  const debouncedQ = useDebouncedValue(q);

  const doctorsQuery = useQuery({
    enabled: Boolean(accessToken),
    placeholderData: keepPreviousData,
    queryFn: () =>
      listAdminDoctors(
        {
          limit: 10,
          order,
          page,
          q: debouncedQ.trim() || undefined,
          sortBy,
          specialtyId: specialtyId || undefined,
          status,
        },
        auth,
      ),
    queryKey: [
      "admin",
      "doctors",
      { debouncedQ, order, page, sortBy, specialtyId, status },
    ],
  });

  const specialtiesQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => listAdminSpecialties(auth),
    queryKey: ["admin", "specialties"],
  });

  const statusMutation = useMutation({
    mutationFn: ({
      doctorId,
      reason,
      nextStatus,
    }: {
      doctorId: string;
      nextStatus: UserStatus;
      reason: string;
    }) =>
      updateAdminDoctorStatus(doctorId, { reason, status: nextStatus }, auth),
    onError: (error) => {
      console.error(error);
      toast.error("Không cập nhật được trạng thái bác sĩ.");
    },
    onSuccess: async () => {
      toast.success("Đã cập nhật trạng thái bác sĩ.");
      setStatusTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "doctors"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });

  const doctors = doctorsQuery.data?.items ?? [];
  const totalPages = doctorsQuery.data?.pagination.totalPages ?? 1;
  const specialties = specialtiesQuery.data ?? [];

  return (
    <AdminShell title="Bác sĩ">
      <section className="grid gap-6">
        <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <div>
              <p className="text-sm font-semibold uppercase text-primary">
                Quản lý tài khoản bác sĩ
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Danh sách bác sĩ
              </h1>
            </div>
            <Link
              className={buttonVariants({ size: "lg", variant: "success" })}
              href="/admin/doctors/new"
            >
              <Plus aria-hidden="true" className="size-5" />
              Tạo bác sĩ
            </Link>
          </div>

          <div className="mt-5 grid gap-3 border-t border-blue-100 pt-5 md:grid-cols-2 xl:grid-cols-5">
            <div className="relative xl:col-span-2">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                className="pl-9"
                onChange={(event) => {
                  setQ(event.target.value);
                  setPage(1);
                }}
                placeholder="Tìm theo tên hoặc email..."
                value={q}
              />
            </div>
            <Select
              aria-label="Trạng thái"
              onChange={(event) => {
                setStatus(event.target.value as UserStatus | "");
                setPage(1);
              }}
              value={status}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="DISABLED">Đã khóa</option>
            </Select>
            <Select
              aria-label="Chuyên khoa"
              onChange={(event) => {
                setSpecialtyId(event.target.value);
                setPage(1);
              }}
              value={specialtyId}
            >
              <option value="">Tất cả chuyên khoa</option>
              {specialties.map((specialty) => (
                <option key={specialty.id} value={specialty.id}>
                  {specialty.name}
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Select
                aria-label="Sắp xếp"
                onChange={(event) => {
                  setSortBy(event.target.value as "createdAt" | "fullName");
                  setPage(1);
                }}
                value={sortBy}
              >
                <option value="createdAt">Ngày tạo</option>
                <option value="fullName">Họ tên</option>
              </Select>
              <Select
                aria-label="Thứ tự"
                onChange={(event) => {
                  setOrder(event.target.value as "asc" | "desc");
                  setPage(1);
                }}
                value={order}
              >
                <option value="desc">Giảm dần</option>
                <option value="asc">Tăng dần</option>
              </Select>
            </div>
          </div>
        </div>

        {doctorsQuery.isLoading ? (
          <LoadingBlock label="Đang tải danh sách bác sĩ..." />
        ) : doctorsQuery.isError ? (
          <ErrorState message="Chưa tải được danh sách bác sĩ." />
        ) : doctors.length ? (
          <>
            <div className="overflow-x-auto rounded-lg border border-blue-100 bg-white shadow-sm">
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="bg-blue-50 text-xs uppercase text-primary">
                  <tr>
                    <th className="px-4 py-3">Bác sĩ</th>
                    <th className="px-4 py-3">Chuyên khoa</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Lịch / Review</th>
                    <th className="px-4 py-3">Đăng nhập</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100">
                  {doctors.map((doctor) => (
                    <tr key={doctor.userID}>
                      <td className="px-4 py-4">
                        <p className="font-bold text-slate-900">
                          {doctor.fullName}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {doctor.user.email}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {doctor.yearsOfExperience ?? 0} năm kinh nghiệm ·{" "}
                          {formatRating(doctor.averageRating)}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex max-w-xs flex-wrap gap-1.5">
                          {doctor.specialties?.length ? (
                            doctor.specialties.map((specialty) => (
                              <span
                                className="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-primary"
                                key={specialty.id}
                              >
                                {specialty.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted-foreground">
                              Chưa gán
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <UserStatusBadge status={doctor.user.status} />
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {doctor._count?.appointments ?? 0} lịch ·{" "}
                        {doctor._count?.reviews ?? 0} review
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {doctor.user.lastLoginAt
                          ? formatDateTime(doctor.user.lastLoginAt)
                          : "Chưa đăng nhập"}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Link
                            className={buttonVariants({
                              size: "sm",
                              variant: "outline",
                            })}
                            href={`/admin/doctors/${doctor.userID}`}
                          >
                            Chi tiết
                          </Link>
                          <Button
                            onClick={() => setStatusTarget(doctor)}
                            size="sm"
                            variant={
                              doctor.user.status === "ACTIVE"
                                ? "destructive"
                                : "success"
                            }
                          >
                            <ShieldAlert
                              aria-hidden="true"
                              className="size-4"
                            />
                            {statusActionLabel(doctor.user.status)}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <AdminPagination
              page={page}
              setPage={setPage}
              totalPages={totalPages}
            />
          </>
        ) : (
          <EmptyState
            description="Thử đổi bộ lọc hoặc tạo tài khoản bác sĩ mới."
            title="Chưa có bác sĩ"
          />
        )}
      </section>

      {statusTarget ? (
        <StatusChangeModal
          currentStatus={statusTarget.user.status}
          isPending={statusMutation.isPending}
          onClose={() => setStatusTarget(null)}
          onSubmit={({ reason, status: nextStatus }) =>
            statusMutation.mutate({
              doctorId: statusTarget.userID,
              nextStatus,
              reason,
            })
          }
          targetName={statusTarget.fullName}
        />
      ) : null}
    </AdminShell>
  );
}
