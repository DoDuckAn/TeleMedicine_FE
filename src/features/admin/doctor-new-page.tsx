"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save, Upload } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AdminWeeklyScheduleEditor } from "@/components/admin/admin-weekly-schedule-editor";
import { SpecialtyStatusBadge } from "@/components/admin/admin-badges";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { createAdminDoctor, listAdminSpecialties } from "@/lib/api/admin";
import { getScheduleSettings } from "@/lib/api/settings";
import { createEmptyWeeklySchedule, parseMultiline } from "@/lib/admin-format";
import { useAuthStore } from "@/lib/auth/session-store";
import {
  normalizeWeeklySchedule,
  validateWeeklySchedule,
} from "@/lib/doctor-schedule";
import type { WeeklySchedule } from "@/types/api";

const doctorSchema = z.object({
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

export function AdminDoctorNewPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const auth = { accessToken: accessToken ?? "" };
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string>();
  const avatarInput = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    },
    [avatarPreview],
  );
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(
    createEmptyWeeklySchedule,
  );

  const specialtiesQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => listAdminSpecialties(auth),
    queryKey: ["admin", "specialties"],
  });
  const settingsQuery = useQuery({
    queryFn: getScheduleSettings,
    queryKey: ["system", "schedule-settings"],
  });

  const form = useForm<DoctorFormInput, unknown, DoctorFormOutput>({
    defaultValues: {
      bio: "",
      email: "",
      fullName: "",
      qualifications: "",
      specialtyIds: [],
      yearsOfExperience: 0,
    },
    resolver: zodResolver(doctorSchema),
  });
  const selectedSpecialtyIds =
    useWatch({ control: form.control, name: "specialtyIds" }) ?? [];

  const createMutation = useMutation({
    mutationFn: (values: DoctorFormOutput) => {
      const normalizedSchedule = normalizeWeeklySchedule(weeklySchedule);

      return createAdminDoctor(
        {
          bio: values.bio.trim(),
          email: values.email.trim(),
          fullName: values.fullName.trim(),
          qualifications: parseMultiline(values.qualifications),
          specialtyIds: values.specialtyIds,
          weeklySchedule: normalizedSchedule,
          yearsOfExperience: values.yearsOfExperience,
        },
        avatarFile!,
        auth,
      );
    },
    onError: (error) => {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Không tạo được tài khoản bác sĩ.",
      );
    },
    onSuccess: async (data) => {
      toast.success("Đã tạo tài khoản bác sĩ.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "doctors"] });
      router.push(`/admin/doctors/${data.id}`);
    },
  });

  const specialties =
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
    if (!avatarFile) {
      setAvatarError("Chọn ảnh đại diện cho bác sĩ.");
      return;
    }
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

    createMutation.mutate(values);
  }

  return (
    <AdminShell title="Tạo bác sĩ">
      <div className="mb-5">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
          href="/admin/doctors"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Quay lại danh sách bác sĩ
        </Link>
      </div>

      <form
        className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_520px]"
        onSubmit={form.handleSubmit(submit)}
      >
        <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase text-primary">
            Tài khoản mới
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Thông tin bác sĩ
          </h1>

          <div className="mt-6 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                error={form.formState.errors.fullName?.message}
                label="Họ tên"
              >
                <Input {...form.register("fullName")} />
              </Field>
              <Field error={form.formState.errors.email?.message} label="Email">
                <Input
                  placeholder="doctor@example.com"
                  {...form.register("email")}
                />
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
                error={avatarError}
                label="Ảnh đại diện"
                hint="JPG, PNG hoặc WebP. Tối đa 5 MB."
              >
                <input
                  ref={avatarInput}
                  className="sr-only"
                  tabIndex={-1}
                  accept="image/jpeg,image/png,image/webp"
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setAvatarFile(null);
                    setAvatarPreview(null);
                    setAvatarError(undefined);
                    if (!file) return;
                    if (
                      !["image/jpeg", "image/png", "image/webp"].includes(
                        file.type,
                      )
                    ) {
                      setAvatarError("Chọn ảnh JPG, PNG hoặc WebP.");
                      event.target.value = "";
                      return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                      setAvatarError("Ảnh đại diện không được vượt quá 5 MB.");
                      event.target.value = "";
                      return;
                    }
                    setAvatarFile(file);
                    setAvatarPreview(URL.createObjectURL(file));
                  }}
                  disabled={createMutation.isPending}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={createMutation.isPending}
                    onClick={() => avatarInput.current?.click()}
                  >
                    <Upload aria-hidden="true" className="size-4" />
                    Chọn ảnh
                  </Button>
                  <span className="min-w-0 break-all text-sm text-muted-foreground">
                    {avatarFile?.name ?? "Chưa chọn ảnh"}
                  </span>
                </div>
                {avatarPreview ? (
                  <Image
                    alt="Ảnh đại diện đã chọn"
                    src={avatarPreview}
                    width={96}
                    height={96}
                    unoptimized
                    className="mt-3 size-24 rounded-lg object-cover"
                  />
                ) : null}
              </Field>
            </div>

            <Field
              error={form.formState.errors.qualifications?.message}
              hint="Mỗi dòng là một bằng cấp/chứng chỉ."
              label="Bằng cấp"
            >
              <Textarea
                placeholder="Bác sĩ Chuyên khoa I&#10;Chứng chỉ tư vấn từ xa..."
                {...form.register("qualifications")}
              />
            </Field>

            <Field
              error={form.formState.errors.bio?.message}
              label="Giới thiệu"
            >
              <Textarea
                placeholder="Giới thiệu kinh nghiệm, thế mạnh chuyên môn..."
                {...form.register("bio")}
              />
            </Field>

            <div>
              <p className="text-sm font-semibold text-slate-800">
                Chuyên khoa
              </p>
              <div className="mt-2">
                {specialtiesQuery.isLoading ? (
                  <LoadingBlock
                    className="min-h-24"
                    label="Đang tải chuyên khoa..."
                  />
                ) : specialtiesQuery.isError ? (
                  <ErrorState message="Chưa tải được chuyên khoa." />
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    {specialties.map((specialty) => (
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
                )}
                {form.formState.errors.specialtyIds?.message ? (
                  <p className="mt-2 text-sm text-red-600">
                    {form.formState.errors.specialtyIds.message}
                  </p>
                ) : null}
              </div>
            </div>

            <Button
              className="justify-self-start"
              disabled={
                createMutation.isPending ||
                settingsQuery.isPending ||
                specialtiesQuery.isPending
              }
              type="submit"
              variant="success"
            >
              {createMutation.isPending ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Save aria-hidden="true" className="size-4" />
              )}
              Tạo bác sĩ
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900">
            Lịch tuần mặc định
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Các khung giờ được chia theo từng khoảng 30 phút.
          </p>
          <div className="mt-5">
            <AdminWeeklyScheduleEditor
              onChange={setWeeklySchedule}
              schedule={weeklySchedule}
              workdayEndTime={settingsQuery.data?.workdayEndTime}
              workdayStartTime={settingsQuery.data?.workdayStartTime}
            />
          </div>
        </section>
      </form>
    </AdminShell>
  );
}
