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

export type DoctorMe = {
  id: string;
  email: string;
  doctorProfile: DoctorSummary;
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

export type PatientProfile = {
  fullName: string;
  dateOfBirth: string;
  gender: Gender;
  address?: string | null;
  medicalHistory?: string | null;
  drugAllergies?: string | null;
  avatar?: string | null;
};

export type PatientMe = {
  id: string;
  phone: string;
  email?: string | null;
  patientProfile: PatientProfile;
};

export type PatientSummary = {
  userID?: string;
  fullName?: string;
  phone?: string | null;
  email?: string | null;
  patientProfile?: PatientProfile;
};

export type AppointmentStatusHistory = {
  id?: string;
  fromStatus?: AppointmentStatus | null;
  toStatus: AppointmentStatus;
  reason?: string | null;
  actorRole?: Role | "SYSTEM" | null;
  createdAt: string;
};

export type Appointment = {
  id: string;
  doctorID: string;
  patientID: string;
  startAt: string;
  endAt: string;
  visitReason: string;
  status: AppointmentStatus;
  confirmationDueAt?: string | null;
  rejectionReason?: string | null;
  cancellationReason?: string | null;
  cancelledBy?: Role | "SYSTEM" | null;
  respondedAt?: string | null;
  cancelledAt?: string | null;
  completedAt?: string | null;
  noShowAt?: string | null;
  meetingUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  doctor?: DoctorSummary;
  patient?: PatientSummary;
  statusHistory?: AppointmentStatusHistory[];
  review?: DoctorReview | null;
};

export type ReviewEligibility = {
  hasCompletedAppointment: boolean;
  canReview: boolean;
  reason: "ALREADY_REVIEWED" | "NO_COMPLETED_APPOINTMENT" | null;
  review?: DoctorReview | null;
};

export type NotificationAppointment = {
  id: string;
  startAt: string;
  status: AppointmentStatus;
  doctor?: Pick<DoctorSummary, "fullName" | "userID">;
  patient?: Pick<PatientSummary, "fullName" | "userID">;
};

export type NotificationItem = {
  id: string;
  type: string;
  scheduledAt?: string | null;
  readAt?: string | null;
  createdAt: string;
  title: string;
  body: string;
  appointment?: NotificationAppointment | null;
};

export type NotificationPreferences = {
  channels: {
    email: boolean;
    push: boolean;
  };
  events: {
    appointmentCancelled: boolean;
    appointmentCompleted: boolean;
    bookingCreated: boolean;
    doctorNoShow?: boolean;
    reminder1Hour: boolean;
    reminder15Minutes: boolean;
    requestConfirmed: boolean;
    requestCreated: boolean;
    requestExpired: boolean;
    requestRejected: boolean;
  };
};

export type StatisticsSummary = {
  completedAppointments: number;
  completionRate: number;
  resolvedAppointments: number;
  totalAppointments: number;
  uniquePatients: number;
};

export type AppointmentsByPeriod = {
  completed: number;
  period: string;
  total: number;
};

export type DoctorStatistics = {
  appointmentsByPeriod: AppointmentsByPeriod[];
  range: {
    from: string;
    groupBy: "day" | "week" | "month";
    timezone: string;
    to: string;
  };
  scope:
    | {
        type: "SYSTEM";
      }
    | {
        doctor: Pick<DoctorSummary, "avatarUrl" | "fullName" | "userID"> & {
          status?: UserStatus;
        };
        type: "DOCTOR";
      };
  statusBreakdown: Record<AppointmentStatus, number>;
  summary: StatisticsSummary;
};
