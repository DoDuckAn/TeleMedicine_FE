"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Search, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { genderLabels, UserStatusBadge } from "@/components/admin/admin-badges";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusChangeModal } from "@/components/admin/status-change-modal";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { listAdminPatients, updateAdminPatientStatus } from "@/lib/api/admin";
import { statusActionLabel } from "@/lib/admin-format";
import { useAuthStore } from "@/lib/auth/session-store";
import { formatDate } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { AdminPatient, Gender, UserStatus } from "@/types/api";

export function AdminPatientsPage() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const auth = { accessToken: accessToken ?? "" };
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<UserStatus | "">("");
  const [gender, setGender] = useState<Gender | "">("");
  const [sortBy, setSortBy] = useState<"createdAt" | "fullName">("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [statusTarget, setStatusTarget] = useState<AdminPatient | null>(null);
  const debouncedQ = useDebouncedValue(q);

  const patientsQuery = useQuery({
    enabled: Boolean(accessToken),
    placeholderData: keepPreviousData,
    queryFn: () =>
      listAdminPatients(
        {
          gender,
          limit: 10,
          order,
          page,
          q: debouncedQ.trim() || undefined,
          sortBy,
          status,
        },
        auth,
      ),
    queryKey: [
      "admin",
      "patients",
      { debouncedQ, gender, order, page, sortBy, status },
    ],
  });

  const statusMutation = useMutation({
    mutationFn: ({
      nextStatus,
      patientId,
      reason,
    }: {
      nextStatus: UserStatus;
      patientId: string;
      reason: string;
    }) =>
      updateAdminPatientStatus(patientId, { reason, status: nextStatus }, auth),
    onError: (error) => {
      console.error(error);
      toast.error("Không cập nhật được trạng thái bệnh nhân.");
    },
    onSuccess: async () => {
      toast.success("Đã cập nhật trạng thái bệnh nhân.");
      setStatusTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "patients"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });

  const patients = patientsQuery.data?.items ?? [];
  const totalPages = patientsQuery.data?.pagination.totalPages ?? 1;

  return (
    <AdminShell title="Bệnh nhân">
      <section className="grid gap-6">
        <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase text-primary">
            Quản lý tài khoản bệnh nhân
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Danh sách bệnh nhân
          </h1>

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
                placeholder="Tìm tên, số điện thoại hoặc email..."
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
              aria-label="Giới tính"
              onChange={(event) => {
                setGender(event.target.value as Gender | "");
                setPage(1);
              }}
              value={gender}
            >
              <option value="">Tất cả giới tính</option>
              {Object.entries(genderLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
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

        {patientsQuery.isLoading ? (
          <LoadingBlock label="Đang tải danh sách bệnh nhân..." />
        ) : patientsQuery.isError ? (
          <ErrorState message="Chưa tải được danh sách bệnh nhân." />
        ) : patients.length ? (
          <>
            <div className="overflow-x-auto rounded-lg border border-blue-100 bg-white shadow-sm">
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="bg-blue-50 text-xs uppercase text-primary">
                  <tr>
                    <th className="px-4 py-3">Bệnh nhân</th>
                    <th className="px-4 py-3">Liên hệ</th>
                    <th className="px-4 py-3">Giới tính</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Lịch / Review</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100">
                  {patients.map((patient) => (
                    <tr key={patient.userID}>
                      <td className="px-4 py-4">
                        <p className="font-bold text-slate-900">
                          {patient.fullName}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {patient.dateOfBirth
                            ? formatDate(patient.dateOfBirth)
                            : "Chưa có ngày sinh"}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        <p>{patient.user.phone ?? "Chưa có SĐT"}</p>
                        <p className="mt-1 text-muted-foreground">
                          {patient.user.email ?? "Chưa có email"}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        {genderLabels[patient.gender]}
                      </td>
                      <td className="px-4 py-4">
                        <UserStatusBadge status={patient.user.status} />
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {patient._count?.appointments ?? 0} lịch ·{" "}
                        {patient._count?.doctorReviews ?? 0} review
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Link
                            className={buttonVariants({
                              size: "sm",
                              variant: "outline",
                            })}
                            href={`/admin/patients/${patient.userID}`}
                          >
                            Chi tiết
                          </Link>
                          <Button
                            onClick={() => setStatusTarget(patient)}
                            size="sm"
                            variant={
                              patient.user.status === "ACTIVE"
                                ? "destructive"
                                : "success"
                            }
                          >
                            <ShieldAlert
                              aria-hidden="true"
                              className="size-4"
                            />
                            {statusActionLabel(patient.user.status)}
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
            description="Thử đổi bộ lọc để tìm bệnh nhân khác."
            title="Chưa có bệnh nhân"
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
              nextStatus,
              patientId: statusTarget.userID,
              reason,
            })
          }
          targetName={statusTarget.fullName}
        />
      ) : null}
    </AdminShell>
  );
}
