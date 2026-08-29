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

export type AuthUser = {
  id: string;
  role: Role;
  status: UserStatus;
  phone?: string | null;
  email?: string | null;
  createdAt?: string;
};

export type AuthSessionResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type Specialty = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status?: SpecialtyStatus;
  doctors?: DoctorSummary[];
};

export type DoctorSummary = {
  userID: string;
  fullName: string;
  yearsOfExperience?: number | null;
  qualifications?: string[];
  avatarUrl?: string | null;
  bio?: string | null;
  specialties?: Specialty[];
  ratingAverage?: number | null;
  reviewCount?: number;
};

export type DoctorDetail = DoctorSummary & {
  email?: string | null;
  reviews?: DoctorReview[];
  ratingSummary?: DoctorRatingSummary;
};

export type DoctorRatingSummary = {
  ratingAverage?: number | null;
  reviewCount?: number;
  counts?: Record<number, number>;
};

export type DoctorAvailabilitySlot = {
  startAt: string;
  endAt: string;
};

export type DoctorAvailabilityDay = {
  date: string;
  slots: DoctorAvailabilitySlot[];
};

export type DoctorAvailability = {
  doctorId: string;
  timezone: string;
  fromDate: string;
  toDate: string;
  slotDurationMinutes: number;
  days: DoctorAvailabilityDay[];
};

export type DoctorReview = {
  id: string;
  rating: number;
  comment?: string | null;
  status?: DoctorReviewStatus;
  createdAt?: string;
  patientDisplayName?: string;
  doctorReply?: {
    content: string;
    createdAt?: string;
  } | null;
};
