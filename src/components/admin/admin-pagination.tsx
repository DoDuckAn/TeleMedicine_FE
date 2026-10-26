import { ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function AdminPagination({
  page,
  setPage,
  totalPages,
  disabled = false,
}: {
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-white p-3 shadow-sm">
      <Button
        aria-label="Trang trước"
        title="Trang trước"
        className="h-10 w-10 shrink-0 p-0 sm:w-auto sm:px-4"
        disabled={disabled || page <= 1}
        onClick={() => setPage(Math.max(1, page - 1))}
        variant="outline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">Trang trước</span>
      </Button>
      <p className="shrink-0 text-sm font-semibold text-slate-700">
        Trang {page} / {totalPages}
      </p>
      <Button
        aria-label="Trang sau"
        title="Trang sau"
        className="h-10 w-10 shrink-0 p-0 sm:w-auto sm:px-4"
        disabled={disabled || page >= totalPages}
        onClick={() => setPage(Math.min(totalPages, page + 1))}
        variant="outline"
      >
        <span className="hidden sm:inline">Trang sau</span>
        <ArrowRight aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );
}
