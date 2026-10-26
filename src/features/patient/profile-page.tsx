"use client";

import { getErrorMessage } from "@/lib/api/error-message";

/* eslint-disable @next/next/no-img-element */

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionMutation } from "@/lib/auth/use-session-mutation";
import { Camera, Loader2, Save, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { PatientShell } from "@/components/patient/patient-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ErrorState, LoadingBlock } from "@/components/ui/feedback";
import {
  getPatientMe,
  updatePatientMe,
  uploadPatientAvatar,
} from "@/lib/api/patient";
import { useAuthStore } from "@/lib/auth/session-store";
import type { Gender } from "@/types/api";

const profileSchema = z.object({
  address: z.string().optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Chọn ngày sinh")
    .refine(isValidDate, "Ngày sinh không hợp lệ"),
  drugAllergies: z.string().optional(),
  email: z.union([z.string().email("Email không hợp lệ"), z.literal("")]),
  fullName: z.string().min(2, "Nhập họ tên"),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNSPECIFIED"]),
  medicalHistory: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

const emptyProfileValues: ProfileForm = {
  address: "",
  dateOfBirth: "",
  drugAllergies: "",
  email: "",
  fullName: "",
  gender: "UNSPECIFIED",
  medicalHistory: "",
};

export function PatientProfilePage() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const loginId = useAuthStore((state) => state.loginId);
  const auth = { accessToken: accessToken ?? "", loginId };
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const profileQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getPatientMe(auth),
    queryKey: ["patient", "me"],
  });

  const formValues = useMemo<ProfileForm>(() => {
    const profile = profileQuery.data?.patientProfile;

    if (!profile) {
      return emptyProfileValues;
    }

    return {
      address: profile.address ?? "",
      dateOfBirth: profile.dateOfBirth?.slice(0, 10) ?? "",
      drugAllergies: profile.drugAllergies ?? "",
      email: profileQuery.data?.email ?? "",
      fullName: profile.fullName ?? "",
      gender: profile.gender ?? "UNSPECIFIED",
      medicalHistory: profile.medicalHistory ?? "",
    };
  }, [profileQuery.data]);

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: formValues,
  });

  const updateMutation = useSessionMutation({
    mutationFn: (values: ProfileForm) =>
      updatePatientMe(
        {
          address: nullable(values.address),
          dateOfBirth: values.dateOfBirth,
          drugAllergies: nullable(values.drugAllergies),
          email: nullable(values.email),
          fullName: values.fullName,
          gender: values.gender as Gender,
          medicalHistory: nullable(values.medicalHistory),
        },
        auth,
      ),
    onError: (error) => {
      console.error(error);
      toast.error(getErrorMessage(error, "Không cập nhật được hồ sơ."));
    },
    onSuccess: async () => {
      toast.success("Đã cập nhật hồ sơ.");
      await queryClient.invalidateQueries({ queryKey: ["patient", "me"] });
    },
  });

  const avatarMutation = useSessionMutation({
    mutationFn: (file: File) => uploadPatientAvatar(file, auth),
    onError: (error) => {
      console.error(error);
      toast.error(getErrorMessage(error, "Không tải được ảnh đại diện."));
    },
    onSuccess: async () => {
      toast.success("Đã cập nhật ảnh đại diện.");
      setAvatarFile(null);
      await queryClient.invalidateQueries({ queryKey: ["patient", "me"] });
    },
  });

  const avatarUrl = profileQuery.data?.patientProfile.avatar;

  return (
    <PatientShell title="Hồ sơ cá nhân">
      {profileQuery.isLoading ? (
        <LoadingBlock label="Đang tải hồ sơ..." />
      ) : profileQuery.isError ? (
        <ErrorState message="Chưa tải được hồ sơ bệnh nhân." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
            <div className="mx-auto flex size-36 items-center justify-center overflow-hidden rounded-lg border border-blue-100 bg-blue-50">
              {avatarUrl ? (
                <img
                  alt="Ảnh đại diện bệnh nhân"
                  className="h-full w-full object-cover"
                  src={avatarUrl}
                />
              ) : (
                <UserRound
                  aria-hidden="true"
                  className="size-16 text-primary"
                />
              )}
            </div>

            <div className="mt-5 text-center">
              <h2 className="text-xl font-bold text-slate-900">
                {profileQuery.data?.patientProfile.fullName}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {profileQuery.data?.phone}
              </p>
            </div>

            <div className="mt-6 grid gap-3">
              <Field label="Ảnh đại diện">
                <Input
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    setAvatarFile(event.target.files?.[0] ?? null)
                  }
                  type="file"
                />
              </Field>
              <Button
                disabled={!avatarFile || avatarMutation.isPending}
                onClick={() => avatarFile && avatarMutation.mutate(avatarFile)}
                variant="primary"
              >
                {avatarMutation.isPending ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Camera aria-hidden="true" className="size-4" />
                )}
                Cập nhật ảnh
              </Button>
            </div>
          </aside>

          <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
            <div>
              <p className="text-sm font-semibold uppercase text-primary">
                Thông tin bệnh nhân
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Hồ sơ hiển thị cho bác sĩ
              </h1>
            </div>

            <form
              className="mt-6 grid gap-4"
              onSubmit={form.handleSubmit((values) =>
                updateMutation.mutate(values),
              )}
            >
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
                  <Input
                    placeholder="patient@example.com"
                    {...form.register("email")}
                  />
                </Field>
                <Field
                  error={form.formState.errors.dateOfBirth?.message}
                  label="Ngày sinh"
                >
                  <Controller
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <Input
                        type="date"
                        required
                        name={field.name}
                        ref={field.ref}
                        value={field.value}
                        onDateChange={field.onChange}
                        onDateBlur={field.onBlur}
                      />
                    )}
                  />
                </Field>
                <Field
                  error={form.formState.errors.gender?.message}
                  label="Giới tính"
                >
                  <Select {...form.register("gender")}>
                    <option value="UNSPECIFIED">Chưa chọn</option>
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="OTHER">Khác</option>
                  </Select>
                </Field>
              </div>

              <Field
                error={form.formState.errors.address?.message}
                label="Địa chỉ"
              >
                <Input
                  placeholder="TP. Hồ Chí Minh"
                  {...form.register("address")}
                />
              </Field>

              <Field
                error={form.formState.errors.medicalHistory?.message}
                label="Tiền sử bệnh"
              >
                <Textarea
                  placeholder="Bệnh nền, phẫu thuật, thuốc đang dùng..."
                  {...form.register("medicalHistory")}
                />
              </Field>

              <Field
                error={form.formState.errors.drugAllergies?.message}
                label="Dị ứng thuốc"
              >
                <Textarea
                  placeholder="Ghi rõ thuốc hoặc nhóm thuốc từng dị ứng..."
                  {...form.register("drugAllergies")}
                />
              </Field>

              <Button
                className="justify-self-start"
                disabled={updateMutation.isPending}
                type="submit"
                variant="success"
              >
                {updateMutation.isPending ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Save aria-hidden="true" className="size-4" />
                )}
                Lưu hồ sơ
              </Button>
            </form>
          </section>
        </div>
      )}
    </PatientShell>
  );
}

function nullable(value?: string | null) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

function isValidDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
