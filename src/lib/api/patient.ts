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

export function getPatientMe({ accessToken }: AuthenticatedOptions) {
  return apiFetch<PatientMe>("/patients/me", { accessToken });
}

export function updatePatientMe(
  payload: UpdatePatientProfilePayload,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<Pick<PatientMe, "email" | "patientProfile">>("/patients/me", {
    accessToken,
    json: payload,
    method: "PATCH",
  });
}

export function uploadPatientAvatar(
  avatar: File,
  { accessToken }: AuthenticatedOptions,
) {
  const formData = new FormData();
  formData.append("avatar", avatar);

  return apiFetch<{ avatarUrl: string }>("/patients/me/avatar", {
    accessToken,
    body: formData,
    method: "POST",
  });
}

export function createAppointment(
  payload: CreateAppointmentPayload,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<Appointment>("/appointments", {
    accessToken,
    json: payload,
    method: "POST",
  });
}

export function getPatientUpcomingAppointments(
  params: Pick<AppointmentListParams, "limit" | "page"> | undefined,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<PaginatedResponse<Appointment>>("/appointments/upcoming", {
    accessToken,
    params,
  });
}

export function getPatientHistoryAppointments(
  params: AppointmentListParams | undefined,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<PaginatedResponse<Appointment>>("/appointments/history", {
    accessToken,
    params,
  });
}

export function getPatientMedicalHistoryAppointments(
  params: AppointmentListParams | undefined,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<PaginatedResponse<Appointment>>(
    "/appointments/patient/history",
    {
      accessToken,
      params,
    },
  );
}

export function getAppointment(
  appointmentId: string,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<Appointment>(`/appointments/${appointmentId}`, {
    accessToken,
  });
}

export function cancelAppointment(
  appointmentId: string,
  payload: CancelAppointmentPayload,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<Appointment>(`/appointments/${appointmentId}/cancel`, {
    accessToken,
    json: payload,
    method: "POST",
  });
}

export function getReviewEligibility(
  doctorId: string,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<ReviewEligibility>(
    `/doctor-reviews/${doctorId}/eligibility`,
    {
      accessToken,
    },
  );
}

export function createDoctorReview(
  doctorId: string,
  payload: CreateDoctorReviewPayload,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<DoctorReview>(`/doctor-reviews/${doctorId}`, {
    accessToken,
    json: payload,
    method: "POST",
  });
}
