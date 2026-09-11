"use client";

import { Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";

export function SettingsPasswordModal({
  isPending,
  onClose,
  onConfirm,
}: {
  isPending: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
}) {
  const [password, setPassword] = useState("");

  return (
    <Modal label="Xác nhận thay đổi cài đặt" onClose={onClose}>
      <section className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-lg bg-blue-50 text-primary">
            <ShieldCheck aria-hidden="true" className="size-5" />
          </span>
          <h2 className="text-xl font-bold text-slate-900">
            Xác nhận mật khẩu
          </h2>
        </div>

        <div className="mt-5">
          <Field label="Mật khẩu hiện tại">
            <Input
              autoComplete="current-password"
              autoFocus
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && password) onConfirm(password);
              }}
              type="password"
              value={password}
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button disabled={isPending} onClick={onClose} variant="outline">
            Hủy
          </Button>
          <Button
            disabled={isPending || !password}
            onClick={() => onConfirm(password)}
          >
            {isPending ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <ShieldCheck aria-hidden="true" className="size-4" />
            )}
            Xác nhận và lưu
          </Button>
        </div>
      </section>
    </Modal>
  );
}
