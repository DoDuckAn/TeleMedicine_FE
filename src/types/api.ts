export type Role = "PATIENT" | "DOCTOR" | "ADMIN";

export type UserStatus = "ACTIVE" | "DISABLED";

export type Gender = "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED";

export type AppointmentStatus =
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "COMPLETED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED"
  | "NO_SHOW";

export type SpecialtyStatus = "ACTIVE" | "DISABLED";

export type DoctorScheduleOverrideType = "AVAILABLE" | "UNAVAILABLE";

export type DoctorReviewStatus = "PUBLISHED" | "HIDDEN";

export type PushDevicePlatform = "WEB" | "ANDROID" | "IOS";

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginatedResponse<T> = {
  items: T[];
  pagination: Pagination;
};

