"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Loader2,
  Save,
  ShieldAlert,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
  SpecialtyStatusBadge,
  UserStatusBadge,
} from "@/components/admin/admin-badges";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminWeeklyScheduleEditor } from "@/components/admin/admin-weekly-schedule-editor";
import { StatusChangeModal } from "@/components/admin/status-change-modal";
import { AdminDoctorSchedule } from "@/components/admin/admin-doctor-schedule";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import {
  getAdminDoctor,
  getAdminDoctorStatistics,
  listAdminSpecialties,
  updateAdminDoctor,
  updateAdminDoctorStatus,
} from "@/lib/api/admin";
import { getScheduleSettings } from "@/lib/api/settings";
import {
  createEmptyWeeklySchedule,
  parseMultiline,
  statusActionLabel,
} from "@/lib/admin-format";
import { useAuthStore } from "@/lib/auth/session-store";
import {
  cloneWeeklySchedule,
  normalizeWeeklySchedule,
  validateWeeklySchedule,
} from "@/lib/doctor-schedule";
import { formatDateTime, formatRating } from "@/lib/format";
import type { UserStatus, WeeklySchedule } from "@/types/api";

const doctorSchema = z.object({
  avatarUrl: z.string().url("Avatar URL không hợp lệ"),
  bio: z.string().min(10, "Giới thiệu tối thiểu 10 ký tự").max(1000),
  email: z.string().email("Email không hợp lệ"),
  fullName: z.string().min(2, "Nhập họ tên").max(72),
  qualifications: z
    .string()
    .refine(
      (value) => parseMultiline(value).length > 0,
      "Nhập ít nhất một bằng cấp/chứng chỉ",
    ),
  specialtyIds: z.array(z.string()).min(1, "Chọn ít nhất một chuyên khoa"),
  yearsOfExperience: z.coerce.number().int().min(0).max(80),
});

type DoctorFormInput = z.input<typeof doctorSchema>;
type DoctorFormOutput = z.output<typeof doctorSchema>;

const emptyValues: DoctorFormInput = {
  avatarUrl: "",
  bio: "",
  email: "",
  fullName: "",
  qualifications: "",
  specialtyIds: [],
  yearsOfExperience: 0,
};

export function AdminDoctorDetailPage({ doctorId }: { doctorId: string }) {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const auth = { accessToken: accessToken ?? "" };
  const [scheduleDraft, setScheduleDraft] = useState<WeeklySchedule | null>(
    null,
  );
  const [statusModalOpen, setStatusModalOpen] = useState(false);

  const doctorQuery = useQuery({
    enabled: Boolean(accessToken && doctorId),
    queryFn: () => getAdminDoctor(doctorId, auth),
    queryKey: ["admin", "doctors", doctorId],
  });

  const specialtiesQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => listAdminSpecialties(auth),
    queryKey: ["admin", "specialties"],
  });
  const settingsQuery = useQuery({
    queryFn: getScheduleSettings,
    queryKey: ["system", "schedule-settings"],
  });

  const statisticsQuery = useQuery({
    enabled: Boolean(accessToken && doctorId),
    queryFn: () => getAdminDoctorStatistics(doctorId, { groupBy: "day" }, auth),
    queryKey: ["admin", "doctors", doctorId, "statistics"],
  });

  const doctor = doctorQuery.data;
  const serverSchedule = useMemo(
    () =>
      cloneWeeklySchedule(
        doctor?.weeklySchedule ?? createEmptyWeeklySchedule(),
      ),
    [doctor?.weeklySchedule],
  );
  const weeklySchedule = scheduleDraft ?? serverSchedule;

  const formValues = useMemo<DoctorFormInput>(() => {
    if (!doctor) {
      return emptyValues;
    }

    return {
      avatarUrl: doctor.avatarUrl ?? "",
      bio: doctor.bio ?? "",
      email: doctor.user.email ?? "",
      fullName: doctor.fullName ?? "",
      qualifications: doctor.qualifications?.join("\n") ?? "",
      specialtyIds: doctor.specialties?.map((specialty) => specialty.id) ?? [],
      yearsOfExperience: doctor.yearsOfExperience ?? 0,
    };
  }, [doctor]);

  const form = useForm<DoctorFormInput, unknown, DoctorFormOutput>({
    resolver: zodResolver(doctorSchema),
    values: formValues,
  });
  const selectedSpecialtyIds =
    useWatch({ control: form.control, name: "specialtyIds" }) ?? [];

  const updateMutation = useMutation({
    mutationFn: (values: DoctorFormOutput) =>
      updateAdminDoctor(
        doctorId,
        {
          avatarUrl: values.avatarUrl.trim(),
          bio: values.bio.trim(),
          email: values.email.trim(),
          fullName: values.fullName.trim(),
          qualifications: parseMultiline(values.qualifications),
          specialtyIds: values.specialtyIds,
          weeklySchedule: normalizeWeeklySchedule(weeklySchedule),
          yearsOfExperience: values.yearsOfExperience,
        },
        auth,
      ),
    onError: (error) => {
      console.error(error);
      toast.error("Không cập nhật được bác sĩ.");
    },
    onSuccess: async (updated) => {
      toast.success("Đã cập nhật bác sĩ.");
      setScheduleDraft(cloneWeeklySchedule(updated.weeklySchedule));
      await queryClient.invalidateQueries({ queryKey: ["admin", "doctors"] });
      await queryClient.invalidateQueries({ queryKey: ["public", "doctor"] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (payload: { reason: string; status: UserStatus }) =>
      updateAdminDoctorStatus(doctorId, payload, auth),
    onError: (error) => {
      console.error(error);
      toast.error("Không cập nhật được trạng thái bác sĩ.");
    },
    onSuccess: async (updated) => {
      toast.success("Đã cập nhật trạng thái bác sĩ.");
      setStatusModalOpen(false);
      setScheduleDraft(cloneWeeklySchedule(updated.weeklySchedule));
      await queryClient.invalidateQueries({ queryKey: ["admin", "doctors"] });
      await queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });

  const activeSpecialties =
    specialtiesQuery.data?.filter(
      (specialty) => specialty.status === "ACTIVE",
    ) ?? [];
  function toggleSpecialty(specialtyId: string) {
    const exists = selectedSpecialtyIds.includes(specialtyId);
    const next = exists
      ? selectedSpecialtyIds.filter((id) => id !== specialtyId)
      : [...selectedSpecialtyIds, specialtyId];

    form.setValue("specialtyIds", next, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function submit(values: DoctorFormOutput) {
    const scheduleError = validateWeeklySchedule(
      normalizeWeeklySchedule(weeklySchedule),
      settingsQuery.data?.slotDurationMinutes ?? 30,
      settingsQuery.data
        ? {
            endTime: settingsQuery.data.workdayEndTime,
            startTime: settingsQuery.data.workdayStartTime,
          }
        : undefined,
    );

    if (scheduleError) {
      toast.error(scheduleError);
      return;
    }

    updateMutation.mutate(values);
  }

  return (
    <AdminShell title="Chi tiết bác sĩ">
      <div className="mb-5">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
          href="/admin/doctors"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Quay lại danh sách bác sĩ
        </Link>
      </div>

      {doctorQuery.isLoading ? (
        <LoadingBlock label="Đang tải hồ sơ bác sĩ..." />
      ) : doctorQuery.isError || !doctor ? (
        <ErrorState message="Chưa tải được hồ sơ bác sĩ." />
      ) : (
        <div className="grid gap-6">
          <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <UserStatusBadge status={doctor.user.status} />
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                    <Star
                      aria-hidden="true"
                      className="size-3.5 fill-current"
                    />
                    {formatRating(doctor.averageRating)}
                  </span>
                </div>
                <h1 className="mt-3 text-3xl font-bold text-slate-900">
                  {doctor.fullName}
                </h1>
                <p className="mt-2 text-muted-foreground">
                  {doctor.user.email} · {doctor.yearsOfExperience ?? 0} năm kinh
                  nghiệm
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => setStatusModalOpen(true)}
                  variant={
                    doctor.user.status === "ACTIVE" ? "destructive" : "success"
                  }
                >
                  <ShieldAlert aria-hidden="true" className="size-4" />
                  {statusActionLabel(doctor.user.status)}
                </Button>
              </div>
            </div>
          </section>

          <AdminDoctorSchedule
            doctorId={doctorId}
            active={doctor.user.status === "ACTIVE"}
          />

          <section className="grid gap-4 md:grid-cols-4">
            <QuickMetric
              icon={BarChart3}
              label="Tổng lịch"
              value={doctor._count?.appointments ?? 0}
            />
            <QuickMetric
              icon={Star}
              label="Đánh giá"
              value={doctor._count?.reviews ?? 0}
            />
            <QuickMetric
              icon={CheckCircle2}
              label="Hoàn thành 30 ngày"
              value={statisticsQuery.data?.summary.completedAppointments ?? 0}
            />
            <QuickMetric
              icon={ShieldAlert}
              label="Override lịch"
              value={doctor._count?.scheduleOverrides ?? 0}
            />
          </section>

          <form
            className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_520px]"
            onSubmit={form.handleSubmit(submit)}
          >
            <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">
                Cập nhật hồ sơ
              </h2>
              <div className="mt-5 grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    error={form.formState.errors.fullName?.message}
                    label="Họ tên"
                  >
                    <Input {...form.register("fullName")} />
                  </Field>
                  <Field
                    error={form.formState.errors.email?.message}
                    label="Email"
                  >
                    <Input {...form.register("email")} />
                  </Field>
                  <Field
                    error={form.formState.errors.yearsOfExperience?.message}
                    label="Số năm kinh nghiệm"
                  >
                    <Input
                      min={0}
                      type="number"
                      {...form.register("yearsOfExperience")}
                    />
                  </Field>
                  <Field
                    error={form.formState.errors.avatarUrl?.message}
                    label="Avatar URL"
                  >
                    <Input {...form.register("avatarUrl")} />
                  </Field>
                </div>

                <Field
                  error={form.formState.errors.qualifications?.message}
                  hint="Mỗi dòng là một bằng cấp/chứng chỉ."
                  label="Bằng cấp"
                >
                  <Textarea {...form.register("qualifications")} />
                </Field>

                <Field error={form.formState.errors.bio?.message} label="Bio">
                  <Textarea {...form.register("bio")} />
                </Field>

                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Chuyên khoa
                  </p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {activeSpecialties.map((specialty) => (
                      <label
                        className="flex items-start gap-3 rounded-lg border border-blue-100 bg-slate-50 p-3 text-sm"
                        key={specialty.id}
                      >
                        <input
                          checked={selectedSpecialtyIds.includes(specialty.id)}
                          className="mt-1"
                          onChange={() => toggleSpecialty(specialty.id)}
                          type="checkbox"
                        />
                        <span>
                          <span className="font-bold text-slate-900">
                            {specialty.name}
                          </span>
                          <span className="mt-1 block">
                            <SpecialtyStatusBadge status={specialty.status} />
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {form.formState.errors.specialtyIds?.message ? (
                    <p className="mt-2 text-sm text-red-600">
                      {form.formState.errors.specialtyIds.message}
                    </p>
                  ) : null}
                </div>

                <Button
                  className="justify-self-start"
                  disabled={updateMutation.isPending}
                  type="submit"
                  variant="success"
                >
                  {updateMutation.isPending ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : (
                    <Save aria-hidden="true" className="size-4" />
                  )}
                  Lưu bác sĩ
                </Button>
              </div>
            </section>

            <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">
                Weekly schedule
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Các khung giờ được chia theo từng khoảng 30 phút.
              </p>
              <div className="mt-5">
                <AdminWeeklyScheduleEditor
                  onChange={setScheduleDraft}
                  schedule={weeklySchedule}
                  workdayEndTime={settingsQuery.data?.workdayEndTime}
                  workdayStartTime={settingsQuery.data?.workdayStartTime}
                />
              </div>
            </section>
          </form>

          <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">
              Lịch sử trạng thái
            </h2>
            <div className="mt-5 space-y-3">
              {doctor.user.statusHistory?.length ? (
                doctor.user.statusHistory.map((history) => (
                  <div
                    className="rounded-lg border border-blue-100 bg-slate-50 p-4"
                    key={history.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <UserStatusBadge
                          status={history.fromStatus ?? undefined}
                        />
                        <span className="text-muted-foreground">→</span>
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
          currentStatus={doctor?.user.status ?? "ACTIVE"}
          isPending={statusMutation.isPending}
          onClose={() => setStatusModalOpen(false)}
          onSubmit={(payload) => statusMutation.mutate(payload)}
          targetName={doctor?.fullName ?? "Bác sĩ"}
        />
      ) : null}
    </AdminShell>
  );
}

function QuickMetric({
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
