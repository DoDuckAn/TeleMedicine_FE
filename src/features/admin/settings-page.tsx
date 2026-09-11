"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, Loader2, Save, Settings } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { ErrorState, LoadingBlock } from "@/components/ui/feedback";
import {
  getScheduleSettings,
  updateScheduleSettings,
} from "@/lib/api/settings";
import { useAuthStore } from "@/lib/auth/session-store";
import { toMinutes } from "@/lib/doctor-schedule";

export function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const auth = { accessToken: accessToken ?? "" };
  const [draft, setDraft] = useState<{ end: string; start: string } | null>(
    null,
  );

  const settingsQuery = useQuery({
    queryFn: getScheduleSettings,
    queryKey: ["system", "schedule-settings"],
  });

  const values = draft ?? {
    end: settingsQuery.data?.workdayEndTime ?? "",
    start: settingsQuery.data?.workdayStartTime ?? "",
  };

  const updateMutation = useMutation({
    mutationFn: () =>
      updateScheduleSettings(
        {
          version: settingsQuery.data?.version ?? 0,
          workdayEndTime: values.end,
          workdayStartTime: values.start,
        },
        auth,
      ),
    onError: (error) => {
      console.error(error);
      toast.error("Không lưu được cài đặt.");
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["system", "schedule-settings"], data);
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["doctor", "schedule"] });
      queryClient.invalidateQueries({ queryKey: ["public", "doctor"] });
      toast.success("Đã cập nhật giờ làm việc.");
    },
  });

  function save() {
    if (
      !values.start ||
      !values.end ||
      toMinutes(values.end) <= toMinutes(values.start)
    ) {
      toast.error("Giờ kết thúc phải lớn hơn giờ bắt đầu.");
      return;
    }
    updateMutation.mutate();
  }

  const unchanged =
    values.start === settingsQuery.data?.workdayStartTime &&
    values.end === settingsQuery.data?.workdayEndTime;

  return (
    <AdminShell title="Cài đặt">
      <section className="grid gap-6">
        <header className="flex items-center gap-3">
          <Settings aria-hidden="true" className="size-8 text-primary" />
          <h1 className="text-3xl font-bold text-slate-900">
            Cài đặt hệ thống
          </h1>
        </header>

        {settingsQuery.isLoading ? (
          <LoadingBlock label="Đang tải cài đặt..." />
        ) : settingsQuery.isError || !settingsQuery.data ? (
          <ErrorState message="Chưa tải được cài đặt hệ thống." />
        ) : (
          <section className="border-t border-blue-100 pt-6">
            <div className="flex items-center gap-2">
              <Clock3 aria-hidden="true" className="size-5 text-primary" />
              <h2 className="text-xl font-bold text-slate-900">Giờ làm việc</h2>
            </div>

            <div className="mt-5 grid max-w-2xl gap-4 sm:grid-cols-2">
              <Field label="Giờ bắt đầu">
                <Input
                  onChange={(event) =>
                    setDraft({ ...values, start: event.target.value })
                  }
                  step={settingsQuery.data.slotDurationMinutes * 60}
                  type="time"
                  value={values.start}
                />
              </Field>
              <Field label="Giờ kết thúc">
                <Input
                  onChange={(event) =>
                    setDraft({ ...values, end: event.target.value })
                  }
                  step={settingsQuery.data.slotDurationMinutes * 60}
                  type="time"
                  value={values.end}
                />
              </Field>
            </div>

            <Button
              className="mt-6"
              disabled={unchanged || updateMutation.isPending}
              onClick={save}
            >
              {updateMutation.isPending ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Save aria-hidden="true" className="size-4" />
              )}
              Lưu thay đổi
            </Button>
          </section>
        )}
      </section>
    </AdminShell>
  );
}
