import type {
  Appointment,
  AppointmentStatus,
  DoctorMe,
  DoctorStatistics,
  PaginatedResponse,
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

export type RejectAppointmentPayload = {
  reason: string;
};

export type CancelAppointmentPayload = {
  reason: string;
};

export function getDoctorMe({ accessToken }: AuthenticatedOptions) {
  return apiFetch<DoctorMe>("/doctors/me", { accessToken });
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
    "/appointments/doctor/history",
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
