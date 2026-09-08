"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BellRing,
  CheckCheck,
  Mail,
  Settings,
  Smartphone,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/appointment/status-badge";
import { PatientShell } from "@/components/patient/patient-shell";
import { Modal } from "@/components/ui/modal";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/feedback";
import {
  getNotificationPreferences,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from "@/lib/api/notifications";
import { getPatientMe } from "@/lib/api/patient";
import { useAuthStore } from "@/lib/auth/session-store";
import { formatDateTime } from "@/lib/format";
import type { NotificationPreferences } from "@/types/api";

const eventLabels: Record<
  Exclude<keyof NotificationPreferences["events"], "doctorNoShow">,
  string
> = {
  appointmentCancelled: "Lịch hẹn bị hủy",
  appointmentCompleted: "Buổi khám hoàn thành",
  bookingCreated: "Đặt lịch thành công",
  reminder1Hour: "Nhắc lịch trước 1 giờ",
  reminder15Minutes: "Nhắc lịch trước 15 phút",
  requestConfirmed: "Bác sĩ xác nhận",
  requestCreated: "Yêu cầu khám mới",
  requestExpired: "Yêu cầu hết hạn",
  requestRejected: "Bác sĩ từ chối",
};

export function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const auth = { accessToken: accessToken ?? "" };
  const enabled = Boolean(accessToken);
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [showEmailRequiredModal, setShowEmailRequiredModal] = useState(false);

  const patientQuery = useQuery({
    enabled,
    queryFn: () => getPatientMe(auth),
    queryKey: ["patient", "me"],
  });

  const notificationsQuery = useQuery({
    enabled,
    queryFn: () => getNotifications({ limit: 10, page, unreadOnly }, auth),
    queryKey: ["notifications", "list", { page, unreadOnly }],
  });

  const unreadQuery = useQuery({
    enabled,
    queryFn: () => getUnreadNotificationCount(auth),
    queryKey: ["notifications", "unread-count"],
  });

  const preferencesQuery = useQuery({
    enabled,
    queryFn: () => getNotificationPreferences(auth),
    queryKey: ["notifications", "preferences"],
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      markNotificationRead(notificationId, auth),
    onError: (error) => {
      console.error(error);
      toast.error("Không đánh dấu đã đọc được thông báo.");
    },
    onSuccess: () => invalidateNotifications(queryClient),
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(auth),
    onError: (error) => {
      console.error(error);
      toast.error("Không đánh dấu tất cả thông báo.");
    },
    onSuccess: (result) => {
      toast.success(`Đã đánh dấu ${result.updatedCount} thông báo.`);
      invalidateNotifications(queryClient);
    },
  });

  const preferencesMutation = useMutation({
    mutationFn: (
      payload: Parameters<typeof updateNotificationPreferences>[0],
    ) => updateNotificationPreferences(payload, auth),
    onError: (error) => {
      console.error(error);
      toast.error("Không cập nhật được cài đặt thông báo.");
    },
    onSuccess: () => {
      toast.success("Đã cập nhật cài đặt thông báo.");
      invalidateNotifications(queryClient);
    },
  });

  const notifications = notificationsQuery.data?.items ?? [];
  const totalPages = notificationsQuery.data?.pagination.totalPages ?? 1;
  const preferences = preferencesQuery.data;

  return (
    <PatientShell title="Thông báo">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="grid gap-5">
          <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <p className="text-sm font-semibold uppercase text-primary">
                  Inbox
                </p>
                <h1 className="mt-1 text-3xl font-bold text-slate-900">
                  Thông báo trong app
                </h1>
                <p className="mt-2 leading-7 text-muted-foreground">
                  Theo dõi xác nhận lịch, từ chối, hủy lịch và nhắc lịch khám.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    setUnreadOnly((current) => !current);
                    setPage(1);
                  }}
                  variant={unreadOnly ? "primary" : "outline"}
                >
                  <BellRing aria-hidden="true" className="size-4" />
                  Chưa đọc ({unreadQuery.data?.count ?? 0})
                </Button>
                <Button
                  disabled={markAllMutation.isPending}
                  onClick={() => markAllMutation.mutate()}
                  variant="success"
                >
                  <CheckCheck aria-hidden="true" className="size-4" />
                  Đọc tất cả
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {notificationsQuery.isLoading ? (
              <LoadingBlock label="Đang tải thông báo..." />
            ) : notificationsQuery.isError ? (
              <ErrorState message="Chưa tải được danh sách thông báo." />
            ) : notifications.length ? (
              notifications.map((notification) => (
                <article
                  className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm"
                  key={notification.id}
                >
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-primary">
                          {notification.type}
                        </span>
                        {!notification.readAt ? (
                          <span className="rounded-md bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                            Chưa đọc
                          </span>
                        ) : null}
                      </div>
                      <h2 className="mt-3 text-lg font-bold text-slate-900">
                        {notification.title}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {notification.body}
                      </p>
                      <p className="mt-3 text-xs font-semibold text-muted-foreground">
                        {formatDateTime(notification.createdAt)}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                      {notification.appointment ? (
                        <Link
                          className={buttonVariants({
                            size: "sm",
                            variant: "outline",
                          })}
                          href={`/patient/appointments/${notification.appointment.id}`}
                        >
                          <StatusBadge
                            status={notification.appointment.status}
                          />
                        </Link>
                      ) : null}
                      {!notification.readAt ? (
                        <Button
                          disabled={markReadMutation.isPending}
                          onClick={() =>
                            markReadMutation.mutate(notification.id)
                          }
                          size="sm"
                          variant="primary"
                        >
                          Đã đọc
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState
                description="Thông báo lịch hẹn và nhắc lịch sẽ xuất hiện ở đây."
                title="Chưa có thông báo"
              />
            )}
          </div>

          {notifications.length ? (
            <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-white p-3 shadow-sm">
              <Button
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
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
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                variant="outline"
              >
                Trang sau
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
          ) : null}
        </section>

        <aside className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Settings aria-hidden="true" className="size-5 text-primary" />
            Cài đặt thông báo
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Email chỉ bật được khi hồ sơ bệnh nhân đã có email hợp lệ.
          </p>

          {preferencesQuery.isLoading ? (
            <LoadingBlock
              className="mt-5 min-h-32"
              label="Đang tải cài đặt..."
            />
          ) : preferencesQuery.isError || !preferences ? (
            <ErrorState
              className="mt-5"
              message="Chưa tải được cài đặt thông báo."
            />
          ) : (
            <div className="mt-5 space-y-5">
              <div className="grid gap-3">
                <PreferenceToggle
                  checked={preferences.channels.push}
                  icon={Smartphone}
                  label="Push notification"
                  onChange={(checked) =>
                    preferencesMutation.mutate({
                      channels: { push: checked },
                    })
                  }
                />
                <PreferenceToggle
                  checked={preferences.channels.email}
                  disabled={patientQuery.isLoading}
                  icon={Mail}
                  label="Email"
                  onChange={(checked) => {
                    if (
                      checked &&
                      patientQuery.isSuccess &&
                      !patientQuery.data.email?.trim()
                    ) {
                      setShowEmailRequiredModal(true);
                      return;
                    }

                    preferencesMutation.mutate({
                      channels: { email: checked },
                    });
                  }}
                />
              </div>

              <div className="border-t border-blue-100 pt-5">
                <p className="font-bold text-slate-900">Loại sự kiện</p>
                <div className="mt-3 space-y-2">
                  {Object.entries(eventLabels).map(([eventKey, label]) => (
                    <PreferenceToggle
                      checked={
                        preferences.events[
                          eventKey as keyof typeof eventLabels
                        ] ?? false
                      }
                      key={eventKey}
                      label={label}
                      onChange={(checked) =>
                        preferencesMutation.mutate({
                          events: {
                            [eventKey]: checked,
                          },
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {showEmailRequiredModal ? (
        <Modal
          label="Cần cập nhật email"
          onClose={() => setShowEmailRequiredModal(false)}
        >
          <section className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary">
                <UserRound aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2
                  className="text-xl font-bold text-slate-900"
                  id="email-required-title"
                >
                  Cần cập nhật email
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Vui lòng cập nhật email trong hồ sơ trước khi bật thông báo
                  qua email.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                onClick={() => setShowEmailRequiredModal(false)}
                variant="outline"
              >
                Hủy
              </Button>
              <Button
                onClick={() => {
                  setShowEmailRequiredModal(false);
                  router.push("/patient/profile");
                }}
                variant="primary"
              >
                Cập nhật email
              </Button>
            </div>
          </section>
        </Modal>
      ) : null}
    </PatientShell>
  );
}

function PreferenceToggle({
  checked,
  disabled = false,
  icon: Icon,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-blue-100 bg-slate-50 px-3 py-2.5 text-sm has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
      <span className="flex items-center gap-2 font-semibold text-slate-700">
        {Icon ? (
          <Icon aria-hidden="true" className="size-4 text-primary" />
        ) : null}
        {label}
      </span>
      <input
        checked={checked}
        className="size-5 rounded border-blue-200 text-primary focus:ring-blue-200"
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}

function invalidateNotifications(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  queryClient.invalidateQueries({ queryKey: ["notifications"] });
}
