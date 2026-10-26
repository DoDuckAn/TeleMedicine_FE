import type {
  Appointment,
  AppointmentStatus,
  CreateScheduleOverrideResult,
  DoctorMe,
  DoctorRatingSummary,
  DoctorReview,
  DoctorStatistics,
  DoctorScheduleCalendar,
  DoctorScheduleOverrideList,
  DoctorScheduleOverrideRange,
  DoctorScheduleOverrideType,
  DoctorWeeklySchedule,
  PaginatedResponse,
  RestoreScheduleOverridesResult,
  WeeklySchedule,
} from "@/types/api";

import { apiFetch } from "./client";
import type { AuthenticatedOptions } from "./patient";

export type DoctorAppointmentListParams = {
  from?: string;
  limit?: number;
  order?: "asc" | "desc";
  page?: number;
  status?: AppointmentStatus | "";
  to?: string;
};

export type DoctorStatisticsParams = {
  from?: string;
  groupBy?: "day" | "week" | "month";
  to?: string;
};

export type DoctorReviewListParams = {
  limit?: number;
  page?: number;
  rating?: number | "";
  replied?: boolean | "";
  status?: DoctorReview["status"] | "";
};

export type DoctorScheduleOverridesParams = {
  from?: string;
  to?: string;
  type?: DoctorScheduleOverrideType | "";
};

export type UpdateDoctorProfilePayload = {
  bio?: string | null;
  email?: string | null;
  fullName?: string;
  qualifications?: string[];
  yearsOfExperience?: number;
};

export type ChangeDoctorPasswordPayload = {
  confirmPassword: string;
  currentPassword: string;
  newPassword: string;
  otp: string;
};

export type CreateScheduleOverridePayload = {
  ranges: DoctorScheduleOverrideRange[];
  reason?: string;
  type: DoctorScheduleOverrideType;
};

export type RestoreScheduleOverridesPayload = {
  ranges: DoctorScheduleOverrideRange[];
};

export type RejectAppointmentPayload = {
  reason: string;
};

export type CancelAppointmentPayload = {
  reason: string;
};

export function getDoctorMe({ accessToken, loginId }: AuthenticatedOptions) {
  return apiFetch<DoctorMe>("/doctors/me", { accessToken, loginId });
}

export function updateDoctorMe(
  payload: UpdateDoctorProfilePayload,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<Pick<DoctorMe, "doctorProfile" | "email">>("/doctors/me", {
    accessToken,
    loginId,
    json: payload,
    method: "PATCH",
  });
}

export function uploadDoctorAvatar(
  avatar: File,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  const formData = new FormData();
  formData.append("avatar", avatar);

  return apiFetch<{ avatarUrl: string }>("/doctors/me/avatar", {
    accessToken,
    loginId,
    body: formData,
    method: "POST",
  });
}

export function requestDoctorPasswordOtp({
  accessToken,
  loginId,
}: AuthenticatedOptions) {
  return apiFetch<{ message: string }>("/doctors/me/password/request-otp", {
    accessToken,
    loginId,
    method: "POST",
  });
}

export function changeDoctorPassword(
  payload: ChangeDoctorPasswordPayload,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<{ passwordChanged: boolean; sessionsRevoked: boolean }>(
    "/doctors/me/password",
    {
      accessToken,
      loginId,
      json: payload,
      method: "PATCH",
    },
  );
}

export function getDoctorStatistics(
  params: DoctorStatisticsParams | undefined,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<DoctorStatistics>("/doctors/me/statistics", {
    accessToken,
    loginId,
    params,
  });
}

export function getDoctorWeeklySchedule({
  accessToken,
  loginId,
}: AuthenticatedOptions) {
  return apiFetch<DoctorWeeklySchedule>("/doctor-schedule/weekly", {
    accessToken,
    loginId,
  });
}

export function updateDoctorWeeklySchedule(
  weeklySchedule: WeeklySchedule,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<DoctorWeeklySchedule>("/doctor-schedule/weekly", {
    accessToken,
    loginId,
    json: { weeklySchedule },
    method: "PUT",
  });
}

export function getDoctorScheduleCalendar(
  weekStart: string | undefined,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<DoctorScheduleCalendar>("/doctor-schedule/calendar", {
    accessToken,
    loginId,
    params: { weekStart },
  });
}

export function getDoctorScheduleOverrides(
  params: DoctorScheduleOverridesParams | undefined,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<DoctorScheduleOverrideList>("/doctor-schedule/overrides", {
    accessToken,
    loginId,
    params,
  });
}

export function createDoctorScheduleOverride(
  payload: CreateScheduleOverridePayload,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<CreateScheduleOverrideResult>("/doctor-schedule/overrides", {
    accessToken,
    loginId,
    json: payload,
    method: "POST",
  });
}

export function restoreDoctorScheduleOverrides(
  payload: RestoreScheduleOverridesPayload,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<RestoreScheduleOverridesResult>(
    "/doctor-schedule/overrides/restore",
    {
      accessToken,
      loginId,
      json: payload,
      method: "POST",
    },
  );
}

export function deleteDoctorScheduleOverride(
  overrideId: string,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<{ removed: true }>(
    `/doctor-schedule/overrides/${overrideId}`,
    {
      accessToken,
      loginId,
      method: "DELETE",
    },
  );
}

export function getDoctorOwnReviews(
  params: DoctorReviewListParams | undefined,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<
    PaginatedResponse<DoctorReview> & { summary?: DoctorRatingSummary }
  >("/doctor-reviews/me", {
    accessToken,
    loginId,
    params,
  });
}

export function replyDoctorReview(
  reviewId: string,
  payload: { content: string },
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<DoctorReview>(`/doctor-reviews/${reviewId}/reply`, {
    accessToken,
    loginId,
    json: payload,
    method: "POST",
  });
}

export function getDoctorPendingAppointments(
  params: Pick<DoctorAppointmentListParams, "limit" | "page"> | undefined,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<PaginatedResponse<Appointment>>(
    "/appointments/doctor/pending",
    {
      accessToken,
      loginId,
      params,
    },
  );
}

export function getDoctorUpcomingAppointments(
  params: Pick<DoctorAppointmentListParams, "limit" | "page"> | undefined,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<PaginatedResponse<Appointment>>(
    "/appointments/doctor/upcoming",
    {
      accessToken,
      loginId,
      params,
    },
  );
}

export function getDoctorHistoryAppointments(
  params: DoctorAppointmentListParams | undefined,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<PaginatedResponse<Appointment>>("/appointments/history", {
    accessToken,
    loginId,
    params,
  });
}

export function getDoctorAppointment(
  appointmentId: string,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<Appointment>(`/appointments/${appointmentId}`, {
    accessToken,
    loginId,
  });
}

export function confirmDoctorAppointment(
  appointmentId: string,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<Appointment>(`/appointments/${appointmentId}/confirm`, {
    accessToken,
    loginId,
    method: "POST",
  });
}

export function rejectDoctorAppointment(
  appointmentId: string,
  payload: RejectAppointmentPayload,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<Appointment>(`/appointments/${appointmentId}/reject`, {
    accessToken,
    loginId,
    json: payload,
    method: "POST",
  });
}

export function completeDoctorAppointment(
  appointmentId: string,
  { accessToken, loginId }: AuthenticatedOptions,
) {
  return apiFetch<Appointment>(`/appointments/${appointmentId}/complete`, {
    accessToken,
    loginId,
    method: "POST",
  });
}

export function cancelDoctorAppointment(
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
