"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { createEmptyWeeklySchedule, parseMultiline } from "@/lib/admin-format";
import { useAuthStore } from "@/lib/auth/session-store";
import {
  normalizeWeeklySchedule,
  validateWeeklySchedule,
} from "@/lib/doctor-schedule";
import type { WeeklySchedule } from "@/types/api";

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

export function AdminDoctorNewPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const auth = { accessToken: accessToken ?? "" };
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>(
    createEmptyWeeklySchedule,
  );

  const specialtiesQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => listAdminSpecialties(auth),
    queryKey: ["admin", "specialties"],
  });

  const form = useForm<DoctorFormInput, unknown, DoctorFormOutput>({
    defaultValues: {
      avatarUrl: "",
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
          avatarUrl: values.avatarUrl.trim(),
          bio: values.bio.trim(),
          email: values.email.trim(),
          fullName: values.fullName.trim(),
          qualifications: parseMultiline(values.qualifications),
          specialtyIds: values.specialtyIds,
          weeklySchedule: normalizedSchedule,
          yearsOfExperience: values.yearsOfExperience,
        },
        auth,
      );
    },
    onError: (error) => {
      console.error(error);
      toast.error("Không tạo được tài khoản bác sĩ.");
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
    const scheduleError = validateWeeklySchedule(
      normalizeWeeklySchedule(weeklySchedule),
      30,
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
                error={form.formState.errors.avatarUrl?.message}
                label="Avatar URL"
              >
                <Input
                  placeholder="https://..."
                  {...form.register("avatarUrl")}
                />
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
              disabled={createMutation.isPending}
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
            Các khung giờ phải chia theo slot 30 phút.
          </p>
          <div className="mt-5">
            <AdminWeeklyScheduleEditor
              onChange={setWeeklySchedule}
              schedule={weeklySchedule}
            />
          </div>
        </section>
      </form>
    </AdminShell>
  );
}
