import type { AuthSessionResponse, Gender } from "@/types/api";

import { apiFetch } from "./client";

export type PatientRegisterPayload = {
  dateOfBirth: string;
  firebaseIdToken: string;
  fullName: string;
  gender: Gender;
};

export type PatientLoginPayload = {
  firebaseIdToken: string;
};

export type StaffLoginPayload = {
  email: string;
  password: string;
};

export type ForgotPasswordRequestPayload = {
  email: string;
};

export type ForgotPasswordResetPayload = {
  confirmPassword: string;
  email: string;
  newPassword: string;
  otp: string;
};

export type ForgotPasswordResetResponse = {
  passwordChanged: boolean;
  sessionsRevoked: boolean;
};

export function registerPatient(payload: PatientRegisterPayload) {
  return apiFetch<AuthSessionResponse>("/auth/register/patient", {
    json: payload,
    method: "POST",
  });
}

export function loginPatient(payload: PatientLoginPayload) {
  return apiFetch<AuthSessionResponse>("/auth/login/patient", {
    json: payload,
    method: "POST",
  });
}

export function loginStaff(payload: StaffLoginPayload) {
  return apiFetch<AuthSessionResponse>("/auth/login/staff", {
    json: payload,
    method: "POST",
  });
}

export function requestDoctorPasswordOtp(
  payload: ForgotPasswordRequestPayload,
) {
  return apiFetch<{ message?: string }>(
    "/auth/doctors/password/forgot/request-otp",
    {
      json: payload,
      method: "POST",
    },
  );
}

export function resetDoctorPassword(payload: ForgotPasswordResetPayload) {
  return apiFetch<ForgotPasswordResetResponse>(
    "/auth/doctors/password/forgot/reset",
    {
      json: payload,
      method: "POST",
    },
  );
}
