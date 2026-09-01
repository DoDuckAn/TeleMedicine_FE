"use client";

import { Loader2, ShieldAlert } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { nextUserStatus, statusActionLabel } from "@/lib/admin-format";
import type { UserStatus } from "@/types/api";

export function StatusChangeModal({
  currentStatus,
  isPending,
  onClose,
  onSubmit,
  targetName,
}: {
  currentStatus: UserStatus;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (payload: { reason: string; status: UserStatus }) => void;
  targetName: string;
}) {
  const [reason, setReason] = useState("");
  const nextStatus = nextUserStatus(currentStatus);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/35 px-4">
      <section className="w-full max-w-lg rounded-lg bg-white p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary">
            <ShieldAlert aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {statusActionLabel(currentStatus)}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {targetName} sẽ chuyển sang trạng thái{" "}
              {nextStatus === "ACTIVE" ? "đang hoạt động" : "đã khóa"}.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <Field label="Lý do">
            <Textarea
              onChange={(event) => setReason(event.target.value)}
              placeholder="Nhập lý do thay đổi trạng thái..."
              value={reason}
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button disabled={isPending} onClick={onClose} variant="outline">
            Hủy
          </Button>
          <Button
            disabled={isPending || reason.trim().length < 3}
            onClick={() =>
              onSubmit({ reason: reason.trim(), status: nextStatus })
            }
            variant={nextStatus === "ACTIVE" ? "success" : "destructive"}
          >
            {isPending ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : null}
            Xác nhận
          </Button>
        </div>
      </section>
    </div>
  );
}
