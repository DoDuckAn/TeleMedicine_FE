import type {
  AdminDashboardStatistics,
  AdminDoctor,
  AdminDoctorDetail,
  AdminPatient,
  AdminPatientDetail,
  AdminReview,
  Appointment,
  AppointmentStatus,
  AuthUser,
  DoctorProfile,
  DoctorReviewStatus,
  Gender,
  PaginatedResponse,
  Specialty,
  SpecialtyStatus,
  UserStatus,
  WeeklySchedule,
} from "@/types/api";

import { apiFetch } from "./client";
import type { DoctorScheduleOverrideList } from "@/types/api";
import type { AuthenticatedOptions } from "./patient";

export function getAdminDoctorOverrides(
  doctorId: string,
  params: { from?: string; to?: string },
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<DoctorScheduleOverrideList>(
    `/admin/doctors/${doctorId}/overrides`,
    { accessToken, params },
  );
}

export function updateSpecialtyDoctors(
  specialtyId: string,
  payload: { addDoctorIds: string[]; removeDoctorIds: string[] },
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<{ id: string }>(`/specialties/${specialtyId}/doctors`, {
    accessToken,
    json: payload,
    method: "PATCH",
  });
}

export type StatisticsParams = {
  from?: string;
  groupBy?: "day" | "month" | "week";
  to?: string;
};

export type AdminDoctorListParams = {
  limit?: number;
  order?: "asc" | "desc";
  page?: number;
  q?: string;
  sortBy?: "createdAt" | "fullName";
  specialtyId?: string;
  status?: UserStatus | "";
};

export type AdminPatientListParams = {
  gender?: Gender | "";
  limit?: number;
  order?: "asc" | "desc";
  page?: number;
  q?: string;
  sortBy?: "createdAt" | "fullName";
  status?: UserStatus | "";
};

export type AdminAppointmentListParams = {
  doctorId?: string;
  from?: string;
  limit?: number;
  order?: "asc" | "desc";
  page?: number;
  patientId?: string;
  status?: AppointmentStatus | "";
  to?: string;
};

export type AdminReviewListParams = {
  doctorId?: string;
  limit?: number;
  order?: "asc" | "desc";
  page?: number;
  patientId?: string;
  q?: string;
  rating?: number | "";
  sortBy?: "createdAt" | "rating";
  status?: DoctorReviewStatus | "";
};

export type AdminDoctorPayload = {
  avatarUrl?: string;
  bio?: string;
  email?: string;
  fullName?: string;
  qualifications?: string[];
  specialtyIds?: string[];
  weeklySchedule?: WeeklySchedule;
  yearsOfExperience?: number;
};

export type AdminSpecialtyPayload = {
  code?: string;
  description?: string | null;
  name?: string;
  status?: SpecialtyStatus;
};

export type UpdateUserStatusPayload = {
  reason: string;
  status: UserStatus;
};

export type ModerateReviewPayload = {
  reason?: string;
  status: DoctorReviewStatus;
};

export function getAdminDashboard(
  params: StatisticsParams | undefined,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<AdminDashboardStatistics>("/admin/dashboard", {
    accessToken,
    params,
  });
}

export function getAdminDoctorStatistics(
  doctorId: string,
  params: StatisticsParams | undefined,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<AdminDashboardStatistics>(
    `/admin/doctors/${doctorId}/statistics`,
    {
      accessToken,
      params,
    },
  );
}

export function listAdminDoctors(
  params: AdminDoctorListParams | undefined,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<PaginatedResponse<AdminDoctor>>("/admin/doctors", {
    accessToken,
    params,
  });
}

export function getAdminDoctor(
  doctorId: string,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<AdminDoctorDetail>(`/admin/doctors/${doctorId}`, {
    accessToken,
  });
}

export function createAdminDoctor(
  payload: Omit<Required<AdminDoctorPayload>, "avatarUrl">,
  avatar: File,
  { accessToken }: AuthenticatedOptions,
) {
  const body = new FormData();
  body.append("profile", JSON.stringify(payload));
  body.append("avatar", avatar);
  return apiFetch<AuthUser & { doctorProfile?: DoctorProfile }>(
    "/admin/doctors",
    {
      accessToken,
      body,
      method: "POST",
    },
  );
}

export function updateAdminDoctor(
  doctorId: string,
  payload: AdminDoctorPayload,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<AdminDoctorDetail>(`/admin/doctors/${doctorId}`, {
    accessToken,
    json: payload,
    method: "PATCH",
  });
}

export function updateAdminDoctorStatus(
  doctorId: string,
  payload: UpdateUserStatusPayload,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<AdminDoctorDetail>(`/admin/doctors/${doctorId}/status`, {
    accessToken,
    json: payload,
    method: "PATCH",
  });
}

export function listAdminPatients(
  params: AdminPatientListParams | undefined,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<PaginatedResponse<AdminPatient>>("/admin/patients", {
    accessToken,
    params,
  });
}

export function getAdminPatient(
  userId: string,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<AdminPatientDetail>(`/admin/patients/${userId}`, {
    accessToken,
  });
}

export function updateAdminPatientStatus(
  userId: string,
  payload: UpdateUserStatusPayload,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<AdminPatientDetail>(`/admin/patients/${userId}/status`, {
    accessToken,
    json: payload,
    method: "PATCH",
  });
}

export function listAdminSpecialties({ accessToken }: AuthenticatedOptions) {
  return apiFetch<Specialty[]>("/specialties/admin/all", { accessToken });
}

export function createAdminSpecialty(
  payload: Required<Pick<AdminSpecialtyPayload, "code" | "name">> &
    Pick<AdminSpecialtyPayload, "description">,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<Specialty>("/specialties", {
    accessToken,
    json: payload,
    method: "POST",
  });
}

export function updateAdminSpecialty(
  specialtyId: string,
  payload: AdminSpecialtyPayload,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<Specialty>(`/specialties/${specialtyId}`, {
    accessToken,
    json: payload,
    method: "PATCH",
  });
}

export function deleteAdminSpecialty(
  specialtyId: string,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<Specialty>(`/specialties/${specialtyId}`, {
    accessToken,
    method: "DELETE",
  });
}

export function addDoctorToSpecialty(
  specialtyId: string,
  doctorId: string,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<Specialty>(
    `/specialties/${specialtyId}/doctors/${doctorId}`,
    {
      accessToken,
      method: "POST",
    },
  );
}

export function removeDoctorFromSpecialty(
  specialtyId: string,
  doctorId: string,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<Specialty>(
    `/specialties/${specialtyId}/doctors/${doctorId}`,
    {
      accessToken,
      method: "DELETE",
    },
  );
}

export function listAdminAppointments(
  params: AdminAppointmentListParams | undefined,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<PaginatedResponse<Appointment>>("/appointments/admin/all", {
    accessToken,
    params,
  });
}

export function getAdminAppointment(
  appointmentId: string,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<Appointment>(`/appointments/${appointmentId}`, {
    accessToken,
  });
}

export function cancelAdminAppointment(
  appointmentId: string,
  payload: { reason: string },
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<Appointment>(`/appointments/${appointmentId}/cancel`, {
    accessToken,
    json: payload,
    method: "POST",
  });
}

export function listAdminReviews(
  params: AdminReviewListParams | undefined,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<PaginatedResponse<AdminReview>>("/doctor-reviews/admin", {
    accessToken,
    params,
  });
}

export function moderateAdminReview(
  reviewId: string,
  payload: ModerateReviewPayload,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<AdminReview>(`/doctor-reviews/${reviewId}/moderation`, {
    accessToken,
    json: payload,
    method: "PATCH",
  });
}
