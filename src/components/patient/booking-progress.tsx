import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function BookingProgress({ step }: { step: 1 | 2 | 3 }) {
  return (
    <nav
      aria-label="Tiến độ đặt lịch"
      className="mb-6 border-y border-slate-200 bg-white px-3 py-6 sm:px-8"
    >
      <ol className="mx-auto grid max-w-3xl grid-cols-3">
        {["Chọn bác sĩ", "Chọn ngày, giờ", "Hoàn tất"].map((label, index) => {
          const number = index + 1;
          return (
            <li
              key={label}
              aria-current={step === number ? "step" : undefined}
              className={cn(
                "relative flex flex-col items-center gap-3 px-1 text-center text-sm font-semibold",
                number <= step ? "text-green-700" : "text-slate-500",
              )}
            >
              {number < 3 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-1/2 top-[18px] h-0.5 w-full",
                    number < step ? "bg-green-600" : "bg-slate-200",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white",
                  number <= step
                    ? "bg-green-600 text-white"
                    : "bg-slate-200 text-slate-600",
                )}
              >
                {number < step ? (
                  <Check aria-hidden="true" className="size-4" />
                ) : (
                  number
                )}
              </span>
              {label}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
