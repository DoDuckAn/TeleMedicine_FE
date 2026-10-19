"use client";

/* eslint-disable @next/next/no-img-element */

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  GraduationCap,
  Loader2,
  LockKeyhole,
  MailCheck,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { DoctorShell } from "@/components/doctor/doctor-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ErrorState, LoadingBlock } from "@/components/ui/feedback";
import {
  changeDoctorPassword,
  getDoctorMe,
  requestDoctorPasswordOtp,
  updateDoctorMe,
  uploadDoctorAvatar,
} from "@/lib/api/doctor";
import { useAuthStore } from "@/lib/auth/session-store";

const profileSchema = z.object({
  bio: z.string().min(10, "Giới thiệu tối thiểu 10 ký tự").max(1000),
  email: z.string().email("Email không hợp lệ"),
  fullName: z.string().min(2, "Nhập họ tên").max(72),
  qualifications: z
    .string()
    .refine(
      (value) => parseQualifications(value).length > 0,
      "Nhập ít nhất một bằng cấp/chứng chỉ",
    ),
  yearsOfExperience: z.coerce.number().int().min(0).max(80),
});

const passwordSchema = z
  .object({
    confirmPassword: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự").max(72),
    currentPassword: z.string().min(1, "Nhập mật khẩu hiện tại").max(72),
    newPassword: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự").max(72),
    otp: z.string().regex(/^\d{6}$/, "OTP gồm 6 số"),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });

type ProfileFormInput = z.input<typeof profileSchema>;
type ProfileFormOutput = z.output<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

const emptyProfileValues: ProfileFormInput = {
  bio: "",
  email: "",
  fullName: "",
  qualifications: "",
  yearsOfExperience: 0,
};

export function DoctorProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const clearSession = useAuthStore((state) => state.clearSession);
  const auth = { accessToken: accessToken ?? "" };
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const profileQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getDoctorMe(auth),
    queryKey: ["doctor", "me"],
  });

  const formValues = useMemo<ProfileFormInput>(() => {
    const profile = profileQuery.data?.doctorProfile;

    if (!profile) {
      return emptyProfileValues;
    }

    return {
      bio: profile.bio ?? "",
      email: profileQuery.data?.email ?? "",
      fullName: profile.fullName ?? "",
      qualifications: profile.qualifications?.join("\n") ?? "",
      yearsOfExperience: profile.yearsOfExperience ?? 0,
    };
  }, [profileQuery.data]);

  const profileForm = useForm<ProfileFormInput, unknown, ProfileFormOutput>({
    resolver: zodResolver(profileSchema),
    values: formValues,
  });

  const passwordForm = useForm<PasswordForm>({
    defaultValues: {
      confirmPassword: "",
      currentPassword: "",
      newPassword: "",
      otp: "",
    },
    resolver: zodResolver(passwordSchema),
  });

  const updateProfileMutation = useMutation({
    mutationFn: (values: ProfileFormOutput) =>
      updateDoctorMe(
        {
          bio: values.bio.trim(),
          email: values.email.trim(),
          fullName: values.fullName.trim(),
          qualifications: parseQualifications(values.qualifications),
          yearsOfExperience: values.yearsOfExperience,
        },
        auth,
      ),
    onError: (error) => {
      console.error(error);
      toast.error("Không cập nhật được hồ sơ bác sĩ.");
    },
    onSuccess: async () => {
      toast.success("Đã cập nhật hồ sơ bác sĩ.");
      await queryClient.invalidateQueries({ queryKey: ["doctor", "me"] });
      await queryClient.invalidateQueries({ queryKey: ["public", "doctor"] });
    },
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => uploadDoctorAvatar(file, auth),
    onError: (error) => {
      console.error(error);
      toast.error("Không upload được ảnh đại diện.");
    },
    onSuccess: async () => {
      toast.success("Đã cập nhật ảnh đại diện.");
      setAvatarFile(null);
      await queryClient.invalidateQueries({ queryKey: ["doctor", "me"] });
      await queryClient.invalidateQueries({ queryKey: ["public", "doctor"] });
    },
  });

  const requestOtpMutation = useMutation({
    mutationFn: () => requestDoctorPasswordOtp(auth),
    onError: (error) => {
      console.error(error);
      toast.error("Không gửi được OTP đổi mật khẩu.");
    },
    onSuccess: () => {
      toast.success("Đã gửi OTP đổi mật khẩu qua email.");
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (values: PasswordForm) => changeDoctorPassword(values, auth),
    onError: (error) => {
      console.error(error);
      toast.error("Không đổi được mật khẩu.");
    },
    onSuccess: () => {
      toast.success("Đã đổi mật khẩu. Vui lòng đăng nhập lại.");
      passwordForm.reset();
      clearSession();
      router.push("/auth/staff");
    },
  });

  const profile = profileQuery.data?.doctorProfile;
  const specialties = profile?.specialties ?? [];

  return (
    <DoctorShell title="Hồ sơ">
      {profileQuery.isLoading ? (
        <LoadingBlock label="Đang tải hồ sơ bác sĩ..." />
      ) : profileQuery.isError ? (
        <ErrorState message="Chưa tải được hồ sơ bác sĩ." />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <aside className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
            <div className="mx-auto flex size-36 items-center justify-center overflow-hidden rounded-lg border border-blue-100 bg-blue-50">
              {profile?.avatarUrl ? (
                <img
                  alt="Ảnh đại diện bác sĩ"
                  className="h-full w-full object-cover"
                  src={profile.avatarUrl}
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
                {profile?.fullName}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {profileQuery.data?.email}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {specialties.length ? (
                specialties.map((specialty) => (
                  <span
                    className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-primary"
                    key={specialty.id}
                  >
                    {specialty.name}
                  </span>
                ))
              ) : (
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  Chưa gán chuyên khoa
                </span>
              )}
            </div>

            <div className="mt-6 grid gap-3 border-t border-blue-100 pt-5">
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

          <section className="space-y-6">
            <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
              <div>
                <p className="text-sm font-semibold uppercase text-primary">
                  Hồ sơ công khai
                </p>
                <h1 className="mt-1 text-3xl font-bold text-slate-900">
                  Thông tin hiển thị cho bệnh nhân
                </h1>
              </div>

              <form
                className="mt-6 grid gap-4"
                onSubmit={profileForm.handleSubmit((values) =>
                  updateProfileMutation.mutate(values),
                )}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    error={profileForm.formState.errors.fullName?.message}
                    label="Họ tên"
                  >
                    <Input {...profileForm.register("fullName")} />
                  </Field>
                  <Field
                    error={profileForm.formState.errors.email?.message}
                    label="Email"
                  >
                    <Input
                      placeholder="doctor@example.com"
                      {...profileForm.register("email")}
                    />
                  </Field>
                  <Field
                    error={
                      profileForm.formState.errors.yearsOfExperience?.message
                    }
                    label="Số năm kinh nghiệm"
                  >
                    <Input
                      min={0}
                      type="number"
                      {...profileForm.register("yearsOfExperience")}
                    />
                  </Field>
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                      <GraduationCap aria-hidden="true" className="size-4" />
                      Chuyên khoa
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {specialties.length
                        ? specialties
                            .map((specialty) => specialty.name)
                            .join(", ")
                        : "Admin sẽ gán chuyên khoa cho bác sĩ."}
                    </p>
                  </div>
                </div>

                <Field
                  error={profileForm.formState.errors.qualifications?.message}
                  hint="Mỗi dòng là một bằng cấp/chứng chỉ."
                  label="Bằng cấp"
                >
                  <Textarea
                    placeholder="TS.BS Chuyên khoa II&#10;Chứng chỉ tư vấn ung bướu..."
                    {...profileForm.register("qualifications")}
                  />
                </Field>

                <Field
                  error={profileForm.formState.errors.bio?.message}
                  label="Giới thiệu"
                >
                  <Textarea
                    placeholder="Giới thiệu kinh nghiệm tư vấn, lĩnh vực chuyên sâu..."
                    {...profileForm.register("bio")}
                  />
                </Field>

                <Button
                  className="justify-self-start"
                  disabled={updateProfileMutation.isPending}
                  type="submit"
                  variant="success"
                >
                  {updateProfileMutation.isPending ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : (
                    <Save aria-hidden="true" className="size-4" />
                  )}
                  Lưu hồ sơ
                </Button>
              </form>
            </div>

            <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
              <div>
                <p className="text-sm font-semibold uppercase text-primary">
                  Bảo mật tài khoản
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                  Đổi mật khẩu
                </h2>
              </div>

              <div className="mt-5 flex flex-col justify-between gap-4 rounded-lg border border-blue-100 bg-slate-50 p-4 md:flex-row md:items-center">
                <div>
                  <p className="flex items-center gap-2 font-semibold text-slate-900">
                    <MailCheck
                      aria-hidden="true"
                      className="size-4 text-primary"
                    />
                    OTP qua email
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cần OTP 6 số trước khi đổi mật khẩu.
                  </p>
                </div>
                <Button
                  disabled={requestOtpMutation.isPending}
                  onClick={() => requestOtpMutation.mutate()}
                  variant="outline"
                >
                  {requestOtpMutation.isPending ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : (
                    <ShieldCheck aria-hidden="true" className="size-4" />
                  )}
                  Gửi OTP
                </Button>
              </div>

              <form
                className="mt-5 grid gap-4 md:grid-cols-2"
                onSubmit={passwordForm.handleSubmit((values) =>
                  changePasswordMutation.mutate(values),
                )}
              >
                <Field
                  error={passwordForm.formState.errors.currentPassword?.message}
                  label="Mật khẩu hiện tại"
                >
                  <Input
                    type="password"
                    {...passwordForm.register("currentPassword")}
                  />
                </Field>
                <Field
                  error={passwordForm.formState.errors.otp?.message}
                  label="OTP"
                >
                  <Input
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    {...passwordForm.register("otp")}
                  />
                </Field>
                <Field
                  error={passwordForm.formState.errors.newPassword?.message}
                  label="Mật khẩu mới"
                >
                  <Input
                    type="password"
                    {...passwordForm.register("newPassword")}
                  />
                </Field>
                <Field
                  error={passwordForm.formState.errors.confirmPassword?.message}
                  label="Xác nhận mật khẩu"
                >
                  <Input
                    type="password"
                    {...passwordForm.register("confirmPassword")}
                  />
                </Field>
                <Button
                  className="md:col-span-2 md:justify-self-start"
                  disabled={changePasswordMutation.isPending}
                  type="submit"
                  variant="destructive"
                >
                  {changePasswordMutation.isPending ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : (
                    <LockKeyhole aria-hidden="true" className="size-4" />
                  )}
                  Đổi mật khẩu
                </Button>
              </form>
            </div>
          </section>
        </div>
      )}
    </DoctorShell>
  );
}

function parseQualifications(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}
