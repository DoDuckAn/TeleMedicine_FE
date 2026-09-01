import { ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function AdminPagination({
  page,
  setPage,
  totalPages,
}: {
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-white p-3 shadow-sm">
      <Button
        disabled={page <= 1}
        onClick={() => setPage(Math.max(1, page - 1))}
        variant="outline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Trang trước
      </Button>
      <p className="text-sm font-semibold text-slate-700">
        Trang {page} / {totalPages}
      </p>
      <Button
        disabled={page >= totalPages}
        onClick={() => setPage(Math.min(totalPages, page + 1))}
        variant="outline"
      >
        Trang sau
        <ArrowRight aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );
}
