"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, KeyRound, Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { requestDoctorPasswordOtp, resetDoctorPassword } from "@/lib/api/auth";

import { AuthShell } from "./auth-shell";

const requestSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
});

const resetSchema = z
  .object({
    confirmPassword: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
    email: z.string().email("Email không hợp lệ"),
    newPassword: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự").max(72),
    otp: z.string().regex(/^\d{6}$/, "OTP gồm 6 chữ số"),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });

type RequestForm = z.infer<typeof requestSchema>;
type ResetForm = z.infer<typeof resetSchema>;

export function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requestForm = useForm<RequestForm>({
    defaultValues: { email: "" },
    resolver: zodResolver(requestSchema),
  });
  const resetForm = useForm<ResetForm>({
    defaultValues: {
      confirmPassword: "",
      email: "",
      newPassword: "",
      otp: "",
    },
    resolver: zodResolver(resetSchema),
  });

  async function requestOtp(values: RequestForm) {
    setIsSubmitting(true);

    try {
      await requestDoctorPasswordOtp(values);
      resetForm.setValue("email", values.email);
      setStep("reset");
      toast.success("Nếu email tồn tại, mã OTP đã được gửi.");
    } catch (error) {
      console.error(error);
      toast.error("Không gửi được OTP. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resetPassword(values: ResetForm) {
    setIsSubmitting(true);

    try {
      await resetDoctorPassword(values);
      toast.success("Đổi mật khẩu thành công. Vui lòng đăng nhập lại.");
      router.push("/auth/staff");
    } catch (error) {
      console.error(error);
      toast.error("OTP hoặc mật khẩu không hợp lệ.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      description="Bác sĩ dùng OTP gửi qua email để đặt lại mật khẩu, sau đó đăng nhập lại bằng tài khoản nhân viên."
      title="Khôi phục quyền truy cập"
    >
      <div className="rounded-lg border border-blue-100 bg-white p-6 shadow-soft">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
          href="/auth/staff"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Quay lại đăng nhập
        </Link>

        <div className="mt-5">
          <p className="text-sm font-semibold uppercase text-primary">
            Quên mật khẩu
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            {step === "request" ? "Nhận mã OTP qua email" : "Đặt lại mật khẩu"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Mã OTP gồm 6 số, dùng cho tài khoản bác sĩ.
          </p>
        </div>

        {step === "request" ? (
          <form
            className="mt-6 grid gap-4"
            onSubmit={requestForm.handleSubmit(requestOtp)}
          >
            <Field
              error={requestForm.formState.errors.email?.message}
              label="Email"
            >
              <Input
                placeholder="doctor@example.com"
                type="email"
                {...requestForm.register("email")}
              />
            </Field>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <MailCheck aria-hidden="true" className="size-4" />
              )}
              Gửi OTP
            </Button>
          </form>
        ) : (
          <form
            className="mt-6 grid gap-4"
            onSubmit={resetForm.handleSubmit(resetPassword)}
          >
            <Field
              error={resetForm.formState.errors.email?.message}
              label="Email"
            >
              <Input type="email" {...resetForm.register("email")} />
            </Field>
            <Field error={resetForm.formState.errors.otp?.message} label="OTP">
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                {...resetForm.register("otp")}
              />
            </Field>
            <Field
              error={resetForm.formState.errors.newPassword?.message}
              label="Mật khẩu mới"
            >
              <Input type="password" {...resetForm.register("newPassword")} />
            </Field>
            <Field
              error={resetForm.formState.errors.confirmPassword?.message}
              label="Xác nhận mật khẩu"
            >
              <Input
                type="password"
                {...resetForm.register("confirmPassword")}
              />
            </Field>
            <Button disabled={isSubmitting} type="submit" variant="success">
              {isSubmitting ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <KeyRound aria-hidden="true" className="size-4" />
              )}
              Đổi mật khẩu
            </Button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
