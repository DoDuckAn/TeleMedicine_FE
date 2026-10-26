import type {
  Appointment,
  AppointmentStatus,
  DoctorReview,
  Gender,
  PaginatedResponse,
  PatientMe,
  ReviewEligibility,
} from "@/types/api";

import { apiFetch } from "./client";

export type AuthenticatedOptions = {
  accessToken: string;
  loginId: string | null;
};

export type AppointmentListParams = {
  from?: string;
  limit?: number;
  order?: "asc" | "desc";
  page?: number;
  status?: AppointmentStatus | "";
  to?: string;
};

export type CreateAppointmentPayload = {
  doctorId: string;
  startAt: string;
  visitReason: string;
};

export type CancelAppointmentPayload = {
  reason: string;
};

export type UpdatePatientProfilePayload = {
  address?: string | null;
  dateOfBirth?: string;
  drugAllergies?: string | null;
  email?: string | null;
  fullName?: string;
  gender?: Gender;
  medicalHistory?: string | null;
};

export type CreateDoctorReviewPayload = {
  comment?: string | null;
  rating: number;
};

export function getPatientMe({ accessToken, loginId }: AuthenticatedOptions) {
  return apiFetch<PatientMe>("/patients/me", { accessToken, loginId });
}

export function updatePatientMe(
  payload: UpdatePatientProfilePayload,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<Pick<PatientMe, "email" | "patientProfile">>("/patients/me", {
    accessToken,
    loginId,
    json: payload,
    method: "PATCH",
  });
}

export function uploadPatientAvatar(
  avatar: File,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  const formData = new FormData();
  formData.append("avatar", avatar);

  return apiFetch<{ avatarUrl: string }>("/patients/me/avatar", {
    accessToken,
    loginId,
    body: formData,
    method: "POST",
  });
}

export function createAppointment(
  payload: CreateAppointmentPayload,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<Appointment>("/appointments", {
    accessToken,
    loginId,
    json: payload,
    method: "POST",
  });
}

export function getPatientUpcomingAppointments(
  params: Pick<AppointmentListParams, "limit" | "page"> | undefined,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<PaginatedResponse<Appointment>>("/appointments/upcoming", {
    accessToken,
    loginId,
    params,
  });
}

export function getPatientHistoryAppointments(
  params: AppointmentListParams | undefined,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<PaginatedResponse<Appointment>>("/appointments/history", {
    accessToken,
    loginId,
    params,
  });
}

export function getPatientMedicalHistoryAppointments(
  params: AppointmentListParams | undefined,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<PaginatedResponse<Appointment>>(
    "/appointments/patient/history",
    {
      accessToken,
      loginId,
      params,
    },
  );
}

export function getAppointment(
  appointmentId: string,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<Appointment>(`/appointments/${appointmentId}`, {
    accessToken,
    loginId,
  });
}

export function cancelAppointment(
  appointmentId: string,
  payload: CancelAppointmentPayload,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<Appointment>(`/appointments/${appointmentId}/cancel`, {
    accessToken,
    loginId,
    json: payload,
    method: "POST",
  });
}

export function getReviewEligibility(
  doctorId: string,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<ReviewEligibility>(
    `/doctor-reviews/${doctorId}/eligibility`,
    {
      accessToken,
      loginId,
    },
  );
}

export function createDoctorReview(
  doctorId: string,
  payload: CreateDoctorReviewPayload,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<DoctorReview>(`/doctor-reviews/${doctorId}`, {
    accessToken,
    loginId,
    json: payload,
    method: "POST",
  });
}
