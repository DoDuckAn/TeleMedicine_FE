import { AlertCircle, Loader2, SearchX } from "lucide-react";

import { cn } from "@/lib/utils";

export function LoadingBlock({
  className,
  label = "Đang tải dữ liệu...",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-40 items-center justify-center rounded-lg border border-dashed border-border bg-white text-sm text-muted-foreground",
        className,
      )}
    >
      <Loader2
        aria-hidden="true"
        className="mr-2 size-4 animate-spin text-primary"
      />
      {label}
    </div>
  );
}

export function EmptyState({
  action,
  className,
  description,
  title,
}: {
  action?: React.ReactNode;
  className?: string;
  description: string;
  title: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-border bg-white p-8 text-center",
        className,
      )}
    >
      <SearchX aria-hidden="true" className="mx-auto size-10 text-blue-300" />
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  className,
  message = "Không thể tải dữ liệu. Vui lòng thử lại sau.",
}: {
  className?: string;
  message?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700",
        className,
      )}
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
