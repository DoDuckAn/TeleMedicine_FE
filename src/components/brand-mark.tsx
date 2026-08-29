import { Stethoscope } from "lucide-react";

import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  compact?: boolean;
  inverse?: boolean;
};

export function BrandMark({ className, compact, inverse }: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-lg border bg-white shadow-sm",
          inverse
            ? "border-white/40 text-primary"
            : "border-blue-100 text-primary",
        )}
      >
        <Stethoscope aria-hidden="true" className="size-6" />
      </span>
      {!compact ? (
        <span className="leading-tight">
          <span
            className={cn(
              "block text-xl font-bold",
              inverse ? "text-white" : "text-foreground",
            )}
          >
            Khám Bệnh Từ Xa
          </span>
          <span
            className={cn(
              "block text-sm font-medium",
              inverse ? "text-blue-100" : "text-muted-foreground",
            )}
          >
            Tư vấn video cùng bác sĩ
          </span>
        </span>
      ) : null}
    </div>
  );
}
