"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock3,
  KeyRound,
  Loader2,
  RotateCcw,
  Save,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SettingsPasswordModal } from "@/components/admin/settings-password-modal";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ErrorState, LoadingBlock } from "@/components/ui/feedback";
import { ApiError } from "@/lib/api/client";
import {
  getAdminSystemSettings,
  saveAdminSystemSettings,
} from "@/lib/api/settings";
import { useAuthStore } from "@/lib/auth/session-store";
import { toMinutes } from "@/lib/doctor-schedule";
import { cn } from "@/lib/utils";
import type { IntegrationSecretKey } from "@/types/api";

type CredentialField = {
  key: IntegrationSecretKey;
  label: string;
  multiline?: boolean;
};

const integrationGroups: Array<{
  fields: CredentialField[];
  name: string;
}> = [
  {
    name: "Cloudinary",
    fields: [
      { key: "CLOUDINARY_CLOUD_NAME", label: "Cloud name" },
      { key: "CLOUDINARY_API_KEY", label: "API key" },
      { key: "CLOUDINARY_API_SECRET", label: "API secret" },
    ],
  },
  {
    name: "Firebase",
    fields: [
      { key: "FIREBASE_PROJECT_ID", label: "Project ID" },
      { key: "FIREBASE_CLIENT_EMAIL", label: "Client email" },
      { key: "FIREBASE_PRIVATE_KEY", label: "Private key", multiline: true },
    ],
  },
  {
    name: "Google Meet",
    fields: [
      { key: "GOOGLE_CLIENT_ID", label: "Client ID" },
      { key: "GOOGLE_CLIENT_SECRET", label: "Client secret" },
      { key: "GOOGLE_REFRESH_TOKEN", label: "Refresh token" },
    ],
  },
  {
    name: "Email SMTP",
    fields: [
      { key: "SMTP_HOST", label: "Máy chủ SMTP" },
      { key: "SMTP_PORT", label: "Cổng SMTP" },
      { key: "SMTP_SECURE", label: "Kết nối bảo mật (true/false)" },
      { key: "SMTP_USER", label: "Tài khoản SMTP" },
      { key: "SMTP_PASSWORD", label: "Mật khẩu SMTP" },
      { key: "EMAIL_FROM", label: "Địa chỉ gửi" },
    ],
  },
];

export function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const auth = { accessToken: accessToken ?? "" };
  const [scheduleDraft, setScheduleDraft] = useState<{
    end: string;
    start: string;
  } | null>(null);
  const [credentialDraft, setCredentialDraft] = useState<
    Partial<Record<IntegrationSecretKey, string>>
  >({});
  const [useEnvironment, setUseEnvironment] = useState<
    Set<IntegrationSecretKey>
  >(new Set());
  const [confirming, setConfirming] = useState(false);

  const settingsQuery = useQuery({
    enabled: Boolean(accessToken),
    queryFn: () => getAdminSystemSettings(auth),
    queryKey: ["admin", "system-settings"],
  });

  const schedule = scheduleDraft ?? {
    end: settingsQuery.data?.workdayEndTime ?? "",
    start: settingsQuery.data?.workdayStartTime ?? "",
  };
  const scheduleChanged =
    schedule.start !== settingsQuery.data?.workdayStartTime ||
    schedule.end !== settingsQuery.data?.workdayEndTime;
  const hasCredentialChanges =
    Object.keys(credentialDraft).length > 0 || useEnvironment.size > 0;
  const hasChanges = scheduleChanged || hasCredentialChanges;

  const saveMutation = useMutation({
    mutationFn: (currentPassword: string) => {
      const credentials = Object.fromEntries([
        ...Object.entries(credentialDraft).filter(([, value]) =>
          Boolean(value),
        ),
        ...Array.from(useEnvironment, (key) => [key, null]),
      ]) as Partial<Record<IntegrationSecretKey, string | null>>;

      return saveAdminSystemSettings(
        {
          currentPassword,
          version: settingsQuery.data?.version ?? 0,
          ...(scheduleChanged
            ? {
                schedule: {
                  workdayEndTime: schedule.end,
                  workdayStartTime: schedule.start,
                },
              }
            : {}),
          ...(hasCredentialChanges ? { credentials } : {}),
        },
        auth,
      );
    },
    onError: (error) => {
      console.error(error);
      if (
        error instanceof ApiError &&
        error.code === "INVALID_CURRENT_PASSWORD"
      ) {
        toast.error("Mật khẩu hiện tại không đúng.");
        return;
      }
      if (
        error instanceof ApiError &&
        error.code === "SETTINGS_VERSION_CONFLICT"
      ) {
        setConfirming(false);
        settingsQuery.refetch();
        toast.error("Cài đặt đã thay đổi ở nơi khác. Vui lòng kiểm tra lại.");
        return;
      }
      toast.error("Không lưu được cài đặt.");
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["admin", "system-settings"], data);
      queryClient.setQueryData(["system", "schedule-settings"], {
        slotDurationMinutes: data.slotDurationMinutes,
        timezone: data.timezone,
        version: data.version,
        workdayEndTime: data.workdayEndTime,
        workdayStartTime: data.workdayStartTime,
      });
      setScheduleDraft(null);
      setCredentialDraft({});
      setUseEnvironment(new Set());
      setConfirming(false);
      queryClient.invalidateQueries({ queryKey: ["doctor", "schedule"] });
      queryClient.invalidateQueries({ queryKey: ["public", "doctor"] });
      toast.success("Đã cập nhật cài đặt hệ thống.");
    },
  });

  function requestSave() {
    if (
      !schedule.start ||
      !schedule.end ||
      toMinutes(schedule.end) <= toMinutes(schedule.start)
    ) {
      toast.error("Giờ kết thúc phải lớn hơn giờ bắt đầu.");
      return;
    }
    setConfirming(true);
  }

  function updateCredential(key: IntegrationSecretKey, value: string) {
    setCredentialDraft((current) => {
      const next = { ...current };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
    setUseEnvironment((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }

  function markUseEnvironment(key: IntegrationSecretKey) {
    setCredentialDraft((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setUseEnvironment((current) => new Set(current).add(key));
  }

  return (
    <AdminShell title="Cài đặt">
      <section className="grid gap-7">
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
          <>
            <section className="border-t border-blue-100 pt-6">
              <div className="flex items-center gap-2">
                <Clock3 aria-hidden="true" className="size-5 text-primary" />
                <h2 className="text-xl font-bold text-slate-900">
                  Giờ làm việc
                </h2>
              </div>
              <div className="mt-5 grid max-w-2xl gap-4 sm:grid-cols-2">
                <Field label="Giờ bắt đầu">
                  <Input
                    onChange={(event) =>
                      setScheduleDraft({
                        ...schedule,
                        start: event.target.value,
                      })
                    }
                    step={settingsQuery.data.slotDurationMinutes * 60}
                    type="time"
                    value={schedule.start}
                  />
                </Field>
                <Field label="Giờ kết thúc">
                  <Input
                    onChange={(event) =>
                      setScheduleDraft({ ...schedule, end: event.target.value })
                    }
                    step={settingsQuery.data.slotDurationMinutes * 60}
                    type="time"
                    value={schedule.end}
                  />
                </Field>
              </div>
            </section>

            <section className="border-t border-blue-100 pt-6">
              <div className="flex items-center gap-2">
                <KeyRound aria-hidden="true" className="size-5 text-primary" />
                <h2 className="text-xl font-bold text-slate-900">
                  Kết nối dịch vụ
                </h2>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {integrationGroups.map((group) => (
                  <article
                    className="rounded-lg border border-blue-100 p-4"
                    key={group.name}
                  >
                    <h3 className="font-bold text-slate-900">{group.name}</h3>
                    <div className="mt-4 grid gap-4">
                      {group.fields.map((field) => {
                        const status =
                          settingsQuery.data.integrations[field.key];
                        const reverting = useEnvironment.has(field.key);
                        return (
                          <div key={field.key}>
                            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-slate-800">
                                {field.label}
                              </span>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-xs font-semibold",
                                  status.configured
                                    ? "text-green-700"
                                    : "text-slate-500",
                                )}
                              >
                                {status.configured ? (
                                  <CheckCircle2
                                    aria-hidden="true"
                                    className="size-3.5"
                                  />
                                ) : null}
                                {reverting
                                  ? status.environmentConfigured
                                    ? "Sẽ dùng env"
                                    : "Sẽ xóa khỏi DB"
                                  : status.source === "DATABASE"
                                    ? "Đã lưu trong DB"
                                    : status.source === "ENVIRONMENT"
                                      ? "Đang dùng env"
                                      : "Chưa cấu hình"}
                              </span>
                            </div>
                            <div className="flex items-start gap-2">
                              {field.multiline ? (
                                <Textarea
                                  className="min-h-24"
                                  onChange={(event) =>
                                    updateCredential(
                                      field.key,
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Nhập giá trị mới"
                                  value={credentialDraft[field.key] ?? ""}
                                />
                              ) : (
                                <Input
                                  autoComplete="new-password"
                                  onChange={(event) =>
                                    updateCredential(
                                      field.key,
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Nhập giá trị mới"
                                  type="password"
                                  value={credentialDraft[field.key] ?? ""}
                                />
                              )}
                              {status.source === "DATABASE" ? (
                                <Button
                                  aria-label={`Dùng lại env cho ${field.label}`}
                                  className="shrink-0"
                                  disabled={reverting}
                                  onClick={() => markUseEnvironment(field.key)}
                                  size="sm"
                                  title="Dùng lại env"
                                  variant="outline"
                                >
                                  <RotateCcw
                                    aria-hidden="true"
                                    className="size-4"
                                  />
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <div className="flex justify-end border-t border-blue-100 pt-6">
              <Button
                disabled={!hasChanges || saveMutation.isPending}
                onClick={requestSave}
              >
                {saveMutation.isPending ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Save aria-hidden="true" className="size-4" />
                )}
                Lưu thay đổi
              </Button>
            </div>
          </>
        )}
      </section>

      {confirming ? (
        <SettingsPasswordModal
          isPending={saveMutation.isPending}
          onClose={() => setConfirming(false)}
          onConfirm={(password) => saveMutation.mutate(password)}
        />
      ) : null}
    </AdminShell>
  );
}
