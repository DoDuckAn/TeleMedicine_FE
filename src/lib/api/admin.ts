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
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<DoctorScheduleOverrideList>(
    `/admin/doctors/${doctorId}/overrides`,
    { accessToken, loginId, params },
  );
}

export function updateSpecialtyDoctors(
  specialtyId: string,
  payload: { addDoctorIds: string[]; removeDoctorIds: string[] },
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<{ id: string }>(`/specialties/${specialtyId}/doctors`, {
    accessToken,
    loginId,
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
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<AdminDashboardStatistics>("/admin/dashboard", {
    accessToken,
    loginId,
    params,
  });
}

export function getAdminDoctorStatistics(
  doctorId: string,
  params: StatisticsParams | undefined,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<AdminDashboardStatistics>(
    `/admin/doctors/${doctorId}/statistics`,
    {
      accessToken,
      loginId,
      params,
    },
  );
}

export function listAdminDoctors(
  params: AdminDoctorListParams | undefined,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<PaginatedResponse<AdminDoctor>>("/admin/doctors", {
    accessToken,
    loginId,
    params,
  });
}

export function getAdminDoctor(
  doctorId: string,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<AdminDoctorDetail>(`/admin/doctors/${doctorId}`, {
    accessToken,
    loginId,
  });
}

export function createAdminDoctor(
  payload: Omit<Required<AdminDoctorPayload>, "avatarUrl">,
  avatar: File,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  const body = new FormData();
  body.append("profile", JSON.stringify(payload));
  body.append("avatar", avatar);
  return apiFetch<AuthUser & { doctorProfile?: DoctorProfile }>(
    "/admin/doctors",
    {
      accessToken,
      loginId,
      body,
      method: "POST",
    },
  );
}

export function updateAdminDoctor(
  doctorId: string,
  payload: AdminDoctorPayload,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<AdminDoctorDetail>(`/admin/doctors/${doctorId}`, {
    accessToken,
    loginId,
    json: payload,
    method: "PATCH",
  });
}

export function updateAdminDoctorStatus(
  doctorId: string,
  payload: UpdateUserStatusPayload,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<AdminDoctorDetail>(`/admin/doctors/${doctorId}/status`, {
    accessToken,
    loginId,
    json: payload,
    method: "PATCH",
  });
}

export function listAdminPatients(
  params: AdminPatientListParams | undefined,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<PaginatedResponse<AdminPatient>>("/admin/patients", {
    accessToken,
    loginId,
    params,
  });
}

export function getAdminPatient(
  userId: string,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<AdminPatientDetail>(`/admin/patients/${userId}`, {
    accessToken,
    loginId,
  });
}

export function updateAdminPatientStatus(
  userId: string,
  payload: UpdateUserStatusPayload,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<AdminPatientDetail>(`/admin/patients/${userId}/status`, {
    accessToken,
    loginId,
    json: payload,
    method: "PATCH",
  });
}

export function listAdminSpecialties({
  accessToken,
  loginId,
}: AuthenticatedOptions) {
  return apiFetch<Specialty[]>("/specialties/admin/all", {
    accessToken,
    loginId,
  });
}

export function createAdminSpecialty(
  payload: Required<Pick<AdminSpecialtyPayload, "code" | "name">> &
    Pick<AdminSpecialtyPayload, "description">,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<Specialty>("/specialties", {
    accessToken,
    loginId,
    json: payload,
    method: "POST",
  });
}

export function updateAdminSpecialty(
  specialtyId: string,
  payload: AdminSpecialtyPayload,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<Specialty>(`/specialties/${specialtyId}`, {
    accessToken,
    loginId,
    json: payload,
    method: "PATCH",
  });
}

export function deleteAdminSpecialty(
  specialtyId: string,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<Specialty>(`/specialties/${specialtyId}`, {
    accessToken,
    loginId,
    method: "DELETE",
  });
}

export function addDoctorToSpecialty(
  specialtyId: string,
  doctorId: string,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<Specialty>(
    `/specialties/${specialtyId}/doctors/${doctorId}`,
    {
      accessToken,
      loginId,
      method: "POST",
    },
  );
}

export function removeDoctorFromSpecialty(
  specialtyId: string,
  doctorId: string,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<Specialty>(
    `/specialties/${specialtyId}/doctors/${doctorId}`,
    {
      accessToken,
      loginId,
      method: "DELETE",
    },
  );
}

export function listAdminAppointments(
  params: AdminAppointmentListParams | undefined,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<PaginatedResponse<Appointment>>("/appointments/admin/all", {
    accessToken,
    loginId,
    params,
  });
}

export function getAdminAppointment(
  appointmentId: string,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<Appointment>(`/appointments/${appointmentId}`, {
    accessToken,
    loginId,
  });
}

export function cancelAdminAppointment(
  appointmentId: string,
  payload: { reason: string },
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<Appointment>(`/appointments/${appointmentId}/cancel`, {
    accessToken,
    loginId,
    json: payload,
    method: "POST",
  });
}

export function listAdminReviews(
  params: AdminReviewListParams | undefined,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<PaginatedResponse<AdminReview>>("/doctor-reviews/admin", {
    accessToken,
    loginId,
    params,
  });
}

export function moderateAdminReview(
  reviewId: string,
  payload: ModerateReviewPayload,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<AdminReview>(`/doctor-reviews/${reviewId}/moderation`, {
    accessToken,
    loginId,
    json: payload,
    method: "PATCH",
  });
}
