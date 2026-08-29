"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { loginStaff } from "@/lib/api/auth";
import { getRoleHome, useAuthStore } from "@/lib/auth/session-store";

import { AuthShell } from "./auth-shell";

const staffLoginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(1, "Nhập mật khẩu"),
});

type StaffLoginForm = z.infer<typeof staffLoginSchema>;

export function StaffLoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<StaffLoginForm>({
    defaultValues: {
      email: "",
      password: "",
    },
    resolver: zodResolver(staffLoginSchema),
  });

  async function submit(values: StaffLoginForm) {
    setIsSubmitting(true);

    try {
      const session = await loginStaff(values);

      setSession(session);
      toast.success("Đăng nhập thành công.");
      router.push(getRoleHome(session.user.role));
    } catch (error) {
      console.error(error);
      toast.error("Email hoặc mật khẩu không đúng.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      description="Bác sĩ và quản trị viên đăng nhập bằng email, mật khẩu để xử lý lịch hẹn, quản lý lịch làm việc và theo dõi hệ thống."
      title="Cổng nhân viên y tế"
    >
      <div className="rounded-lg border border-blue-100 bg-white p-6 shadow-soft">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase text-primary">
            Bác sĩ & quản trị viên
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Đăng nhập nhân viên
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Sử dụng tài khoản email do quản trị viên cấp.
          </p>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={form.handleSubmit(submit)}>
          <Field error={form.formState.errors.email?.message} label="Email">
            <div className="relative">
              <Mail
                aria-hidden="true"
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary"
              />
              <Input
                className="pl-9"
                placeholder="doctor@example.com"
                type="email"
                {...form.register("email")}
              />
            </div>
          </Field>

          <Field
            error={form.formState.errors.password?.message}
            label="Mật khẩu"
          >
            <div className="relative">
              <KeyRound
                aria-hidden="true"
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary"
              />
              <Input
                className="pl-9"
                placeholder="Nhập mật khẩu"
                type="password"
                {...form.register("password")}
              />
            </div>
          </Field>

          <Button className="mt-2 w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <KeyRound aria-hidden="true" className="size-4" />
            )}
            Đăng nhập
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-between gap-3 text-sm">
          <Link
            className="font-semibold text-primary"
            href="/auth/forgot-password"
          >
            Quên mật khẩu
          </Link>
          <Link className="font-semibold text-primary" href="/auth/patient">
            Đăng nhập bệnh nhân
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
