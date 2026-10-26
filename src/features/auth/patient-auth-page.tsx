"use client";

import { getErrorMessage } from "@/lib/api/error-message";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2, Phone, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { loginPatient, registerPatient } from "@/lib/api/auth";
import { getRoleHome } from "@/lib/auth/session-store";
import { replaceLoginSession } from "@/lib/auth/session-coordinator";
import {
  getFirebaseAuth,
  isFirebaseConfigured,
  normalizeVietnamPhone,
} from "@/lib/firebase/client";
import type { Gender } from "@/types/api";

import { AuthShell } from "./auth-shell";

const phoneSchema = z.object({
  phone: z.string().min(9, "Nhập số điện thoại hợp lệ"),
});

const otpSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, "OTP gồm 6 chữ số"),
});

const registerSchema = z.object({
  dateOfBirth: z.string().min(1, "Chọn ngày sinh"),
  fullName: z.string().min(2, "Nhập họ tên"),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNSPECIFIED"]),
});

type AuthMode = "login" | "register";
type PhoneForm = z.infer<typeof phoneSchema>;
type OtpForm = z.infer<typeof otpSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

export function PatientAuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode =
    searchParams.get("mode") === "register" ? "register" : "login";
  const nextPath = getSafeNextPath(searchParams.get("next"));
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(
    null,
  );
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [recaptchaVerifier, setRecaptchaVerifier] =
    useState<RecaptchaVerifier | null>(null);

  const phoneForm = useForm<PhoneForm>({
    defaultValues: { phone: "" },
    resolver: zodResolver(phoneSchema),
  });

  const otpForm = useForm<OtpForm>({
    defaultValues: { otp: "" },
    resolver: zodResolver(otpSchema),
  });

  const registerForm = useForm<RegisterForm>({
    defaultValues: {
      dateOfBirth: "",
      fullName: "",
      gender: "UNSPECIFIED",
    },
    resolver: zodResolver(registerSchema),
  });

  async function sendOtp(values: PhoneForm) {
    if (mode === "register") {
      const validProfile = await registerForm.trigger();

      if (!validProfile) {
        return;
      }
    }

    if (!isFirebaseConfigured()) {
      toast.error("Đăng nhập qua điện thoại tạm thời chưa khả dụng.");
      return;
    }

    setIsSendingOtp(true);

    try {
      const auth = getFirebaseAuth();
      let verifier = recaptchaVerifier;

      if (!verifier) {
        verifier = new RecaptchaVerifier(auth, "patient-recaptcha", {
          size: "invisible",
        });
        setRecaptchaVerifier(verifier);
      }

      const result = await signInWithPhoneNumber(
        auth,
        normalizeVietnamPhone(values.phone),
        verifier,
      );

      setConfirmation(result);
      toast.success("Đã gửi OTP tới số điện thoại.");
    } catch (error) {
      console.error(error);
      recaptchaVerifier?.clear();
      setRecaptchaVerifier(null);
      toast.error(getErrorMessage(error, "Không gửi được mã xác thực. Vui lòng kiểm tra số điện thoại và thử lại."));
    } finally {
      setIsSendingOtp(false);
    }
  }

  async function verifyOtp(values: OtpForm) {
    if (!confirmation) {
      toast.error("Vui lòng gửi OTP trước.");
      return;
    }

    if (mode === "register") {
      const validProfile = await registerForm.trigger();

      if (!validProfile) {
        return;
      }
    }

    setIsVerifying(true);

    try {
      const credential = await confirmation.confirm(values.otp);
      const firebaseIdToken = await credential.user.getIdToken();
      const session =
        mode === "login"
          ? await loginPatient({ firebaseIdToken })
          : await registerPatient({
              firebaseIdToken,
              ...registerForm.getValues(),
              gender: registerForm.getValues("gender") as Gender,
            });

      await replaceLoginSession(session);
      toast.success("Đăng nhập thành công.");
      router.push(nextPath ?? getRoleHome(session.user.role));
    } catch (error) {
      console.error(error);
      toast.error(getErrorMessage(error, "OTP không hợp lệ hoặc tài khoản chưa sẵn sàng."));
    } finally {
      setIsVerifying(false);
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setConfirmation(null);
    otpForm.reset();
  }

  return (
    <AuthShell
      description="Chăm sóc sức khỏe cùng bác sĩ chuyên khoa."
      title={mode === "login" ? "Chào mừng bạn quay lại" : "Đăng ký khám từ xa"}
    >
      <div className="rounded-lg border border-blue-100 bg-white p-6 shadow-soft">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase text-primary">
            Tài khoản bệnh nhân
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            {mode === "login" ? "Đăng nhập bằng OTP" : "Đăng ký tài khoản"}
          </h1>
        </div>

        <div className="mt-6 grid grid-cols-2 rounded-lg bg-blue-50 p-1">
          <button
            className={tabClass(mode === "login")}
            onClick={() => switchMode("login")}
            type="button"
          >
            Đăng nhập
          </button>
          <button
            className={tabClass(mode === "register")}
            onClick={() => switchMode("register")}
            type="button"
          >
            Đăng ký
          </button>
        </div>

        {mode === "register" ? (
          <div className="mt-5 grid gap-4">
            <Field
              error={registerForm.formState.errors.fullName?.message}
              label="Họ tên"
            >
              <Input
                placeholder="Nguyễn Văn A"
                {...registerForm.register("fullName")}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                error={registerForm.formState.errors.dateOfBirth?.message}
                label="Ngày sinh"
              >
                <Controller
                  control={registerForm.control}
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
                error={registerForm.formState.errors.gender?.message}
                label="Giới tính"
              >
                <Select {...registerForm.register("gender")}>
                  <option value="UNSPECIFIED">Chưa chọn</option>
                  <option value="MALE">Nam</option>
                  <option value="FEMALE">Nữ</option>
                  <option value="OTHER">Khác</option>
                </Select>
              </Field>
            </div>
          </div>
        ) : null}

        <form
          className="mt-5 grid gap-4"
          onSubmit={phoneForm.handleSubmit(sendOtp)}
        >
          <Field
            error={phoneForm.formState.errors.phone?.message}
            label="Số điện thoại"
          >
            <Input
              placeholder="090 123 4567"
              {...phoneForm.register("phone")}
            />
          </Field>
          <Button disabled={isSendingOtp} type="submit" variant="primary">
            {isSendingOtp ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Phone aria-hidden="true" className="size-4" />
            )}
            Gửi OTP
          </Button>
        </form>

        <form
          className="mt-5 grid gap-4"
          onSubmit={otpForm.handleSubmit(verifyOtp)}
        >
          <Field error={otpForm.formState.errors.otp?.message} label="Mã OTP">
            <Input
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              {...otpForm.register("otp")}
            />
          </Field>
          <Button
            disabled={!confirmation || isVerifying}
            type="submit"
            variant="success"
          >
            {isVerifying ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <ShieldCheck aria-hidden="true" className="size-4" />
            )}
            Xác thực và tiếp tục
          </Button>
        </form>

        <div id="patient-recaptcha" />

        <div className="mt-6 flex items-center justify-between gap-3 text-sm">
          <Link className="font-semibold text-primary" href="/auth/staff">
            Đăng nhập nhân viên
          </Link>
          <Link
            className="inline-flex items-center gap-1 font-semibold text-primary"
            href="/doctors"
          >
            Xem bác sĩ
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}

function getSafeNextPath(value: string | null) {
  if (!value?.startsWith("/")) {
    return null;
  }

  return value;
}

function tabClass(active: boolean) {
  return active
    ? "rounded-md bg-white px-3 py-2 text-sm font-bold text-primary shadow-sm"
    : "rounded-md px-3 py-2 text-sm font-semibold text-slate-600";
}
