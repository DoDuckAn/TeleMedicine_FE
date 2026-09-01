"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarClock,
  Mail,
  Phone,
  ShieldAlert,
  Star,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { genderLabels, UserStatusBadge } from "@/components/admin/admin-badges";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusChangeModal } from "@/components/admin/status-change-modal";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { getAdminPatient, updateAdminPatientStatus } from "@/lib/api/admin";
import { statusActionLabel } from "@/lib/admin-format";
import { useAuthStore } from "@/lib/auth/session-store";
import { formatDate, formatDateTime } from "@/lib/format";
import type { UserStatus } from "@/types/api";

export function AdminPatientDetailPage({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const auth = { accessToken: accessToken ?? "" };
  const [statusModalOpen, setStatusModalOpen] = useState(false);

  const patientQuery = useQuery({
    enabled: Boolean(accessToken && userId),
    queryFn: () => getAdminPatient(userId, auth),
    queryKey: ["admin", "patients", userId],
  });

  const statusMutation = useMutation({
    mutationFn: (payload: { reason: string; status: UserStatus }) =>
      updateAdminPatientStatus(userId, payload, auth),
    onError: (error) => {
      console.error(error);
      toast.error("Không cập nhật được trạng thái bệnh nhân.");
    },
    onSuccess: async () => {
      toast.success("Đã cập nhật trạng thái bệnh nhân.");
      setStatusModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin", "patients"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });

  const patient = patientQuery.data;

  return (
    <AdminShell title="Chi tiết bệnh nhân">
      <div className="mb-5">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
          href="/admin/patients"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Quay lại danh sách bệnh nhân
        </Link>
      </div>

      {patientQuery.isLoading ? (
        <LoadingBlock label="Đang tải hồ sơ bệnh nhân..." />
      ) : patientQuery.isError || !patient ? (
        <ErrorState message="Chưa tải được hồ sơ bệnh nhân." />
      ) : (
        <div className="grid gap-6">
          <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <UserStatusBadge status={patient.user.status} />
                  <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-primary">
                    {genderLabels[patient.gender]}
                  </span>
                </div>
                <h1 className="mt-3 text-3xl font-bold text-slate-900">
                  {patient.fullName}
                </h1>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <Phone aria-hidden="true" className="size-4 text-primary" />
                    {patient.user.phone ?? "Chưa có SĐT"}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Mail aria-hidden="true" className="size-4 text-primary" />
                    {patient.user.email ?? "Chưa có email"}
                  </span>
                </div>
              </div>
              <Button
                onClick={() => setStatusModalOpen(true)}
                variant={
                  patient.user.status === "ACTIVE" ? "destructive" : "success"
                }
              >
                <ShieldAlert aria-hidden="true" className="size-4" />
                {statusActionLabel(patient.user.status)}
              </Button>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-4">
            <MetricCard
              icon={CalendarClock}
              label="Lịch khám"
              value={patient._count?.appointments ?? 0}
            />
            <MetricCard
              icon={Star}
              label="Đánh giá"
              value={patient._count?.doctorReviews ?? 0}
            />
            <InfoCard
              icon={UserRound}
              label="Ngày sinh"
              value={
                patient.dateOfBirth
                  ? formatDate(patient.dateOfBirth)
                  : "Chưa cập nhật"
              }
            />
            <InfoCard
              icon={ShieldAlert}
              label="Đăng nhập gần nhất"
              value={
                patient.user.lastLoginAt
                  ? formatDateTime(patient.user.lastLoginAt)
                  : "Chưa đăng nhập"
              }
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-3">
            <ProfileBlock
              label="Địa chỉ"
              value={patient.address ?? "Chưa cập nhật"}
            />
            <ProfileBlock
              label="Tiền sử bệnh"
              value={patient.medicalHistory ?? "Chưa cập nhật"}
            />
            <ProfileBlock
              label="Dị ứng thuốc"
              value={patient.drugAllergies ?? "Chưa cập nhật"}
            />
          </section>

          <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">
              Lịch sử trạng thái
            </h2>
            <div className="mt-5 space-y-3">
              {patient.user.statusHistory?.length ? (
                patient.user.statusHistory.map((history) => (
                  <div
                    className="rounded-lg border border-blue-100 bg-slate-50 p-4"
                    key={history.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <UserStatusBadge
                          status={history.fromStatus ?? undefined}
                        />
                        <span className="text-muted-foreground">sang</span>
                        <UserStatusBadge status={history.toStatus} />
                      </div>
                      <span className="text-sm font-semibold text-muted-foreground">
                        {formatDateTime(history.createdAt)}
                      </span>
                    </div>
                    {history.reason ? (
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {history.reason}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <EmptyState
                  description="Các lần khóa/mở tài khoản sẽ xuất hiện tại đây."
                  title="Chưa có lịch sử trạng thái"
                />
              )}
            </div>
          </section>
        </div>
      )}

      {statusModalOpen ? (
        <StatusChangeModal
          currentStatus={patient?.user.status ?? "ACTIVE"}
          isPending={statusMutation.isPending}
          onClose={() => setStatusModalOpen(false)}
          onSubmit={(payload) => statusMutation.mutate(payload)}
          targetName={patient?.fullName ?? "Bệnh nhân"}
        />
      ) : null}
    </AdminShell>
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

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
      <span className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-primary">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <p className="mt-4 text-sm font-semibold text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-bold text-slate-900">{value}</p>
    </article>
  );
}

function ProfileBlock({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold uppercase text-primary">{label}</p>
      <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">
        {value}
      </p>
    </article>
  );
}
