"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth/session-store";
import { getNotificationPreferences } from "@/lib/api/notifications";
import { connectPushDevice, disconnectPushDevice } from "@/lib/firebase/push";
import type { MessagePayload } from "firebase/messaging";
import type { NotificationPreferences } from "@/types/api";

type PushStatus = { phase: "idle" | "connecting" | "ready" | "blocked" | "error"; error?: string };
const PushContext = createContext<PushStatus & { enable: () => Promise<void> }>({ phase: "idle", enable: async () => {} });

export function usePushNotifications() {
  return useContext(PushContext);
}

export function PushNotificationProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const userId = useAuthStore(state => state.user?.id);
  const role = useAuthStore(state => state.user?.role);
  const accessToken = useAuthStore(state => state.accessToken);
  const eligible = Boolean(accessToken && (role === "PATIENT" || role === "DOCTOR"));
  const [status, setStatus] = useState<PushStatus & { userId?: string }>({ phase: "idle" });
  const preferences = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: () => getNotificationPreferences({ accessToken: accessToken ?? "" }),
    enabled: eligible,
  });
  const pushEnabled = preferences.data?.channels.push;

  const connect = useCallback(async () => {
    const session = useAuthStore.getState();
    if (!session.user || !session.accessToken) throw new Error("Vui lòng đăng nhập lại.");
    const id = session.user.id;
    const isCurrent = () => useAuthStore.getState().user?.id === id;
    setStatus({ phase: "connecting", userId: id });
    try {
      const ready = await connectPushDevice({ userId: id, accessToken: session.accessToken }, isCurrent, (payload: MessagePayload) => {
        const preference = queryClient.getQueryData<NotificationPreferences>(["notifications", "preferences"]);
        if (!preference?.channels.push) return;
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        toast(payload.notification?.title ?? "Thông báo mới", { description: payload.notification?.body });
      });
      if (isCurrent()) setStatus({ phase: ready ? "ready" : "idle", userId: id });
      return ready;
    } catch (error) {
      const message = error instanceof Error && error.name !== "FirebaseError" && error.name !== "TypeError" && error.name !== "SecurityError"
        ? error.message
        : "Không đăng ký được thông báo. Vui lòng kiểm tra kết nối và cấu hình Firebase/VAPID rồi thử lại.";
      if (isCurrent()) setStatus({ phase: "error", userId: id, error: message });
      throw new Error(message);
    }
  }, [queryClient]);

  useEffect(() => useAuthStore.subscribe((state, previous) => {
    if (state.user?.id === previous.user?.id || !previous.user || !previous.accessToken) return;
    void disconnectPushDevice({ userId: previous.user.id, accessToken: previous.accessToken }).catch(error => {
      toast.error(error instanceof Error ? error.message : "Không gỡ được thông báo của phiên trước.");
    });
  }), []);

  useEffect(() => {
    if (!eligible || !userId || pushEnabled === undefined) return;
    if (!pushEnabled) {
      const session = useAuthStore.getState();
      if (session.accessToken) void disconnectPushDevice({ userId, accessToken: session.accessToken }).catch(error => {
        toast.error(error instanceof Error ? error.message : "Không tắt được thông báo thiết bị.");
      });
      return;
    }
    let active = true;
    const sync = () => {
      if (active && document.visibilityState === "visible" && "Notification" in window && Notification.permission === "granted") {
        void connect().catch(() => {});
      }
    };
    void Promise.resolve().then(sync);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("online", sync);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("online", sync);
    };
  }, [eligible, userId, pushEnabled, connect]);

  async function enable() {
    if (!("Notification" in window)) throw new Error("Trình duyệt này không hỗ trợ thông báo thiết bị.");
    // Request permission directly from the user gesture, before asynchronous SDK work.
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      const error = permission === "denied"
        ? "Thông báo đã bị chặn. Vui lòng cho phép thông báo trong cài đặt trang web của trình duyệt."
        : "Bạn chưa cho phép nhận thông báo trên thiết bị này.";
      setStatus({ phase: "blocked", userId, error });
      throw new Error(error);
    }
    if (!(await connect())) throw new Error("Phiên đăng nhập hoặc quyền thông báo đã thay đổi. Vui lòng thử lại.");
  }

  const currentStatus: PushStatus = status.userId === userId ? status : { phase: "idle" };
  return <PushContext.Provider value={{ ...currentStatus, enable }}>{children}</PushContext.Provider>;
}
