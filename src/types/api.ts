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

export type Weekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type WeeklyScheduleRange = {
  endTime: string;
  startTime: string;
};

export type WeeklySchedule = Record<Weekday, WeeklyScheduleRange[]>;

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

export type UserStatusHistory = {
  changedBy?: {
    email?: string | null;
    id?: string;
    phone?: string | null;
  } | null;
  createdAt: string;
  fromStatus?: UserStatus | null;
  id: string;
  reason?: string | null;
  toStatus: UserStatus;
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
  createdAt?: string;
  deletedAt?: string | null;
  doctors?: DoctorSummary[];
  updatedAt?: string;
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
  createdAt?: string;
  updatedAt?: string;
};

export type DoctorProfile = DoctorSummary & {
  weeklySchedule?: WeeklySchedule;
};

export type DoctorDetail = DoctorSummary & {
  email?: string | null;
  reviews?: DoctorReview[];
  ratingSummary?: DoctorRatingSummary;
};

export type DoctorMe = {
  id: string;
  email: string;
  doctorProfile: DoctorProfile;
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

export type DoctorWeeklySchedule = {
  doctorId: string;
  slotDurationMinutes: number;
  timezone: string;
  updatedAt?: string;
  weeklySchedule: WeeklySchedule;
};

export type DoctorScheduleOverride = {
  createdAt?: string;
  endAt: string;
  id: string;
  reason?: string | null;
  startAt: string;
  type: DoctorScheduleOverrideType;
  updatedAt?: string;
};

export type DoctorScheduleOverrideRange = {
  endAt: string;
  startAt: string;
};

export type DoctorScheduleOverrideList = {
  from: string;
  items: DoctorScheduleOverride[];
  to: string;
};

export type CreateScheduleOverrideResult = {
  cancelledAppointmentCount: number;
  cancelledAppointmentIds: string[];
  createdOverrideCount: number;
  overrides: DoctorScheduleOverride[];
};

export type RestoreScheduleOverridesResult = {
  removedOverrideCount: number;
  removedOverrideIds: string[];
  replacementOverrideCount: number;
  replacementOverrides: DoctorScheduleOverride[];
  restoredRanges: DoctorScheduleOverrideRange[];
};

export type DoctorReview = {
  id: string;
  doctorID?: string;
  rating: number;
  comment?: string | null;
  status?: DoctorReviewStatus;
  createdAt?: string;
  hiddenReason?: string | null;
  patient?: {
    fullName?: string;
    userID?: string;
  } | null;
  patientDisplayName?: string;
  doctorReply?:
    | {
        content: string;
        createdAt?: string;
      }
    | string
    | null;
  repliedAt?: string | null;
  updatedAt?: string;
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
  actor?: Role | "SYSTEM" | null;
  id?: string;
  fromStatus?: AppointmentStatus | null;
  note?: string | null;
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

export type DoctorScheduleCalendarAppointment = Pick<
  Appointment,
  | "confirmationDueAt"
  | "endAt"
  | "id"
  | "meetingUrl"
  | "startAt"
  | "status"
  | "visitReason"
> & {
  patient?: {
    avatar?: string | null;
    dateOfBirth?: string | null;
    fullName?: string;
    gender?: Gender;
    userID?: string;
  } | null;
};

export type DoctorScheduleCalendarSlot = {
  appointment?: DoctorScheduleCalendarAppointment | null;
  endAt: string;
  isBookable: boolean;
  override?: Pick<DoctorScheduleOverride, "id" | "reason"> | null;
  startAt: string;
  status: AppointmentStatus | "AVAILABLE" | "UNAVAILABLE";
};

export type DoctorScheduleCalendarDay = {
  date: string;
  overrides: DoctorScheduleOverride[];
  slots: DoctorScheduleCalendarSlot[];
  weekday: Weekday;
};

export type DoctorScheduleCalendar = {
  days: DoctorScheduleCalendarDay[];
  doctorId: string;
  slotDurationMinutes: number;
  timezone: string;
  weekEnd: string;
  weekStart: string;
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
        doctor: Pick<DoctorSummary, "avatarUrl" | "fullName"> & {
          id?: string;
          status?: UserStatus;
          userID?: string;
        };
        type: "DOCTOR";
      };
  statusBreakdown: Record<AppointmentStatus, number>;
  summary: StatisticsSummary;
};

export type AdminTopDoctor = {
  avatarUrl?: string | null;
  completedAppointments: number;
  fullName: string;
  id: string;
  status: UserStatus;
  totalAppointments: number;
};

export type AdminDashboardStatistics = DoctorStatistics & {
  system?: {
    activeDoctors: number;
    activePatients: number;
    newPatients: number;
    topDoctors: AdminTopDoctor[];
    totalPatients: number;
  };
};

export type AdminDoctor = DoctorProfile & {
  _count?: {
    appointments: number;
    reviews: number;
    scheduleOverrides?: number;
  };
  averageRating?: number | null;
  createdAt?: string;
  user: {
    createdAt?: string;
    email?: string | null;
    lastLoginAt?: string | null;
    status: UserStatus;
    statusHistory?: UserStatusHistory[];
    updatedAt?: string;
  };
};

export type AdminDoctorDetail = AdminDoctor & {
  weeklySchedule?: WeeklySchedule;
};

export type AdminPatient = {
  _count?: {
    appointments: number;
    doctorReviews: number;
  };
  address?: string | null;
  avatar?: string | null;
  createdAt?: string;
  dateOfBirth?: string;
  fullName: string;
  gender: Gender;
  user: {
    createdAt?: string;
    email?: string | null;
    lastLoginAt?: string | null;
    phone?: string | null;
    status: UserStatus;
    statusHistory?: UserStatusHistory[];
    updatedAt?: string;
  };
  userID: string;
  updatedAt?: string;
};

export type AdminPatientDetail = AdminPatient & {
  drugAllergies?: string | null;
  medicalHistory?: string | null;
};

export type AdminReview = DoctorReview & {
  doctor?: Pick<DoctorSummary, "fullName" | "userID"> | null;
  moderatedAt?: string | null;
  moderatedBy?: {
    email?: string | null;
    id?: string;
    phone?: string | null;
  } | null;
  patient?: {
    fullName?: string;
    userID?: string;
  } | null;
};
