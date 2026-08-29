import type {
  DoctorAvailability,
  DoctorDetail,
  DoctorReview,
  DoctorSummary,
  PaginatedResponse,
  Specialty,
} from "@/types/api";

import { apiFetch } from "./client";

export type DoctorListParams = {
  limit?: number;
  order?: "asc" | "desc";
  page?: number;
  q?: string;
  sortBy?: "name" | "rating";
  specialtyId?: string;
};

export type DoctorReviewParams = {
  limit?: number;
  order?: "asc" | "desc";
  page?: number;
  rating?: number;
  sortBy?: "createdAt" | "rating";
};

export function getSpecialties() {
  return apiFetch<Specialty[]>("/specialties");
}

export function getDoctors(params?: DoctorListParams) {
  return apiFetch<PaginatedResponse<DoctorSummary>>("/doctors", { params });
}

export function getDoctor(doctorId: string) {
  return apiFetch<DoctorDetail>(`/doctors/${doctorId}`);
}

export function getDoctorSchedule(doctorId: string) {
  return apiFetch<DoctorAvailability>(`/doctors/${doctorId}/schedule`);
}

export function getDoctorReviews(
  doctorId: string,
  params?: DoctorReviewParams,
) {
  return apiFetch<
    PaginatedResponse<DoctorReview> & {
      summary?: DoctorDetail["ratingSummary"];
    }
  >(`/doctors/${doctorId}/reviews`, { params });
}
