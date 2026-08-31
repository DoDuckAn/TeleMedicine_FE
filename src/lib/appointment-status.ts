import type { AppointmentStatus } from "@/types/api";

export const appointmentStatusMeta: Record<
  AppointmentStatus,
  {
    label: string;
    tone: "amber" | "blue" | "green" | "red" | "slate" | "violet";
  }
> = {
  CANCELLED: {
    label: "Đã hủy",
    tone: "slate",
  },
  COMPLETED: {
    label: "Hoàn thành",
    tone: "green",
  },
  CONFIRMED: {
    label: "Đã xác nhận",
    tone: "blue",
  },
  EXPIRED: {
    label: "Hết hạn",
    tone: "slate",
  },
  NO_SHOW: {
    label: "Không tham gia",
    tone: "red",
  },
  PENDING_CONFIRMATION: {
    label: "Chờ xác nhận",
    tone: "amber",
  },
  REJECTED: {
    label: "Bị từ chối",
    tone: "red",
  },
};

export function canPatientCancelAppointment(
  status: AppointmentStatus,
  startAt: string,
) {
  if (status !== "PENDING_CONFIRMATION" && status !== "CONFIRMED") {
    return false;
  }

  const now = Date.now();
  const startsAt = new Date(startAt).getTime();

  return startsAt - now >= 30 * 60 * 1000;
}

export function canDoctorCancelAppointment(
  status: AppointmentStatus,
  startAt: string,
) {
  return canPatientCancelAppointment(status, startAt);
}

export function canDoctorCompleteAppointment(
  status: AppointmentStatus,
  startAt: string,
) {
  return status === "CONFIRMED" && Date.now() >= new Date(startAt).getTime();
}
