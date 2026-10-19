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

export function getDoctorMe({ accessToken }: AuthenticatedOptions) {
  return apiFetch<DoctorMe>("/doctors/me", { accessToken });
}

export function updateDoctorMe(
  payload: UpdateDoctorProfilePayload,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<Pick<DoctorMe, "doctorProfile" | "email">>("/doctors/me", {
    accessToken,
    json: payload,
    method: "PATCH",
  });
}

export function uploadDoctorAvatar(
  avatar: File,
  { accessToken }: AuthenticatedOptions,
) {
  const formData = new FormData();
  formData.append("avatar", avatar);

  return apiFetch<{ avatarUrl: string }>("/doctors/me/avatar", {
    accessToken,
    body: formData,
    method: "POST",
  });
}

export function requestDoctorPasswordOtp({
  accessToken,
}: AuthenticatedOptions) {
  return apiFetch<{ message: string }>("/doctors/me/password/request-otp", {
    accessToken,
    method: "POST",
  });
}

export function changeDoctorPassword(
  payload: ChangeDoctorPasswordPayload,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<{ passwordChanged: boolean; sessionsRevoked: boolean }>(
    "/doctors/me/password",
    {
      accessToken,
      json: payload,
      method: "PATCH",
    },
  );
}

export function getDoctorStatistics(
  params: DoctorStatisticsParams | undefined,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<DoctorStatistics>("/doctors/me/statistics", {
    accessToken,
    params,
  });
}

export function getDoctorWeeklySchedule({ accessToken }: AuthenticatedOptions) {
  return apiFetch<DoctorWeeklySchedule>("/doctor-schedule/weekly", {
    accessToken,
  });
}

export function updateDoctorWeeklySchedule(
  weeklySchedule: WeeklySchedule,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<DoctorWeeklySchedule>("/doctor-schedule/weekly", {
    accessToken,
    json: { weeklySchedule },
    method: "PUT",
  });
}

export function getDoctorScheduleCalendar(
  weekStart: string | undefined,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<DoctorScheduleCalendar>("/doctor-schedule/calendar", {
    accessToken,
    params: { weekStart },
  });
}

export function getDoctorScheduleOverrides(
  params: DoctorScheduleOverridesParams | undefined,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<DoctorScheduleOverrideList>("/doctor-schedule/overrides", {
    accessToken,
    params,
  });
}

export function createDoctorScheduleOverride(
  payload: CreateScheduleOverridePayload,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<CreateScheduleOverrideResult>("/doctor-schedule/overrides", {
    accessToken,
    json: payload,
    method: "POST",
  });
}

export function restoreDoctorScheduleOverrides(
  payload: RestoreScheduleOverridesPayload,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<RestoreScheduleOverridesResult>(
    "/doctor-schedule/overrides/restore",
    {
      accessToken,
      json: payload,
      method: "POST",
    },
  );
}

export function deleteDoctorScheduleOverride(
  overrideId: string,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<{ removed: true }>(
    `/doctor-schedule/overrides/${overrideId}`,
    {
      accessToken,
      method: "DELETE",
    },
  );
}

export function getDoctorOwnReviews(
  params: DoctorReviewListParams | undefined,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<
    PaginatedResponse<DoctorReview> & { summary?: DoctorRatingSummary }
  >("/doctor-reviews/me", {
    accessToken,
    params,
  });
}

export function replyDoctorReview(
  reviewId: string,
  payload: { content: string },
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<DoctorReview>(`/doctor-reviews/${reviewId}/reply`, {
    accessToken,
    json: payload,
    method: "POST",
  });
}

export function getDoctorPendingAppointments(
  params: Pick<DoctorAppointmentListParams, "limit" | "page"> | undefined,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<PaginatedResponse<Appointment>>(
    "/appointments/doctor/pending",
    {
      accessToken,
      params,
    },
  );
}

export function getDoctorUpcomingAppointments(
  params: Pick<DoctorAppointmentListParams, "limit" | "page"> | undefined,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<PaginatedResponse<Appointment>>(
    "/appointments/doctor/upcoming",
    {
      accessToken,
      params,
    },
  );
}

export function getDoctorHistoryAppointments(
  params: DoctorAppointmentListParams | undefined,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<PaginatedResponse<Appointment>>(
    "/appointments/history",
    {
      accessToken,
      params,
    },
  );
}

export function getDoctorAppointment(
  appointmentId: string,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<Appointment>(`/appointments/${appointmentId}`, {
    accessToken,
  });
}

export function confirmDoctorAppointment(
  appointmentId: string,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<Appointment>(`/appointments/${appointmentId}/confirm`, {
    accessToken,
    method: "POST",
  });
}

export function rejectDoctorAppointment(
  appointmentId: string,
  payload: RejectAppointmentPayload,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<Appointment>(`/appointments/${appointmentId}/reject`, {
    accessToken,
    json: payload,
    method: "POST",
  });
}

export function completeDoctorAppointment(
  appointmentId: string,
  { accessToken }: AuthenticatedOptions,
) {
  return apiFetch<Appointment>(`/appointments/${appointmentId}/complete`, {
    accessToken,
    method: "POST",
  });
}

export function cancelDoctorAppointment(
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
