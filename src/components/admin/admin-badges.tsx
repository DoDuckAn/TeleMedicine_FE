import type {
  DoctorReviewStatus,
  Gender,
  SpecialtyStatus,
  UserStatus,
} from "@/types/api";

export const genderLabels: Record<Gender, string> = {
  FEMALE: "Nữ",
  MALE: "Nam",
  OTHER: "Khác",
  UNSPECIFIED: "Chưa rõ",
};

export function UserStatusBadge({ status }: { status?: UserStatus }) {
  const active = status === "ACTIVE";

  return (
    <span
      className={
        active
          ? "rounded-md bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700"
          : "rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600"
      }
    >
      {active ? "Đang hoạt động" : "Đã khóa"}
    </span>
  );
}

export function SpecialtyStatusBadge({ status }: { status?: SpecialtyStatus }) {
  const active = status === "ACTIVE";

  return (
    <span
      className={
        active
          ? "rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-primary"
          : "rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600"
      }
    >
      {active ? "Đang hiển thị" : "Đã ẩn"}
    </span>
  );
}

export function ReviewStatusBadge({ status }: { status?: DoctorReviewStatus }) {
  const visible = status !== "HIDDEN";

  return (
    <span
      className={
        visible
          ? "rounded-md bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700"
          : "rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600"
      }
    >
      {visible ? "Đang hiển thị" : "Đã ẩn"}
    </span>
  );
}
