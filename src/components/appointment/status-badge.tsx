import { appointmentStatusMeta } from "@/lib/appointment-status";
import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/types/api";

const toneClass = {
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  blue: "border-blue-200 bg-blue-50 text-primary",
  green: "border-green-200 bg-green-50 text-green-700",
  red: "border-red-200 bg-red-50 text-red-700",
  slate: "border-slate-200 bg-slate-100 text-slate-600",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
};

export function StatusBadge({
  className,
  status,
}: {
  className?: string;
  status: AppointmentStatus;
}) {
  const meta = appointmentStatusMeta[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold",
        toneClass[meta.tone],
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
