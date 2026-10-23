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
import { DoctorShell } from "@/components/doctor/doctor-shell";
import { getDoctorMe } from "@/lib/api/doctor";
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
import { usePushNotifications } from "@/components/push-notification-provider";

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

const notificationLabels: Record<string, string> = {
  BOOKING_CREATED: "Đặt lịch",
  REQUEST_CREATED: "Yêu cầu khám",
  REQUEST_CONFIRMED: "Xác nhận lịch",
  REQUEST_REJECTED: "Từ chối lịch",
  REQUEST_EXPIRED: "Hết hạn yêu cầu",
  APPOINTMENT_CANCELLED: "Hủy lịch",
  APPOINTMENT_COMPLETED: "Hoàn thành buổi khám",
  REMINDER_1_HOUR: "Nhắc lịch trước 1 giờ",
  REMINDER_15_MINUTES: "Nhắc lịch trước 15 phút",
  DOCTOR_NO_SHOW: "Buổi khám không diễn ra",
};

export function NotificationsPage() {
  const push = usePushNotifications();
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const role=useAuthStore((state)=>state.user?.role);
  const isDoctor=role==="DOCTOR";
  const Shell=isDoctor?DoctorShell:PatientShell;
  const auth = { accessToken: accessToken ?? "" };
  const enabled = Boolean(accessToken);
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [showEmailRequiredModal, setShowEmailRequiredModal] = useState(false);

  const patientQuery = useQuery({
    enabled,
    queryFn: async () => isDoctor?await getDoctorMe(auth):await getPatientMe(auth),
    queryKey: [isDoctor?"doctor":"patient", "me"],
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

  async function changePush(checked: boolean) {
    try {
      if (checked) await push.enable();
      await preferencesMutation.mutateAsync({ channels: { push: checked } });
    } catch (error) {
      if (!(error instanceof Error)) return;
      toast.error(error.message);
    }
  }

  return (
    <Shell title="Thông báo">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="grid gap-5">
          <div className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <p className="text-sm font-semibold uppercase text-primary">
                  Hộp thư
                </p>
                <h1 className="mt-1 text-3xl font-bold text-slate-900">
                  Thông báo
                </h1>
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
                          {notificationLabels[notification.type] ?? "Thông báo"}
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
                          href={`/${isDoctor?"doctor":"patient"}/appointments/${notification.appointment.id}`}
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
            Email chỉ bật được khi hồ sơ đã có email hợp lệ.
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
                  label="Thông báo trên thiết bị"
                  disabled={preferencesMutation.isPending || push.phase === "connecting"}
                  onChange={(checked) => void changePush(checked)}
                />
                {preferences.channels.push ? (
                  <div className="space-y-2 text-sm">
                    <p role="status" className={push.error ? "text-red-700" : "text-slate-600"}>
                      {push.error ?? (push.phase === "ready" ? "Đã đăng ký thông báo trên trình duyệt này." : push.phase === "connecting" ? "Đang đăng ký thông báo..." : "Trình duyệt này chưa được đăng ký nhận thông báo.")}
                    </p>
                    {push.phase !== "ready" ? (
                      <Button disabled={push.phase === "connecting"} onClick={() => void changePush(true)} variant="outline">
                        <BellRing aria-hidden="true" className="size-4" />
                        Cho phép thông báo
                      </Button>
                    ) : null}
                  </div>
                ) : null}
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
                  router.push(isDoctor?"/doctor/profile":"/patient/profile");
                }}
                variant="primary"
              >
                Cập nhật email
              </Button>
            </div>
          </section>
        </Modal>
      ) : null}
    </Shell>
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
