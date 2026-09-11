"use client";

import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { API_BASE_URL, refreshAccessToken } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/session-store";

export function RealtimeProvider() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const userId = useAuthStore((state) => state.user?.id);
  const role = useAuthStore((state) => state.user?.role);

  useEffect(() => {
    if (!accessToken || !userId) return;
    const socket = io(new URL(API_BASE_URL).origin, {
      auth: { token: accessToken },
      autoConnect: false,
      reconnectionDelayMax: 10_000,
    });
    let disposed = false;
    let refreshRunning = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const pending = new Map<string, QueryKey>();
    const enqueue = (...keys: QueryKey[]) => {
      if (disposed) return;
      for (const key of keys) pending.set(JSON.stringify(key), key);
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        for (const queryKey of pending.values())
          void queryClient.invalidateQueries({ queryKey });
        pending.clear();
      }, 150);
    };
    const appointmentsChanged = () =>
      enqueue(
        ["patient", "appointments"],
        ["patient", "history"],
        ["patient", "review-eligibility"],
        ["doctor", "appointments"],
        ["doctor", "statistics"],
        ["doctor", "schedule"],
        ["admin", "appointments"],
        ["admin", "dashboard"],
        ["admin", "doctors"],
      );
    const notificationsChanged = () => enqueue(["notifications"]);
    const sync = () => {
      appointmentsChanged();
      notificationsChanged();
      if (role !== "PATIENT") enqueue(["public", "doctor"]);
    };
    const retry = () => {
      if (disposed || retryTimer) return;
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        if (!disposed) socket.connect();
      }, 5000);
    };
    const sessionInvalid = async ({ code }: { code?: string }) => {
      if (disposed || useAuthStore.getState().accessToken !== accessToken)
        return;
      if (code === "SESSION_REVOKED" || code === "UNAUTHORIZED") {
        useAuthStore.getState().clearSession();
      } else if (code === "TOKEN_EXPIRED" && !refreshRunning) {
        refreshRunning = true;
        try {
          await refreshAccessToken();
        } catch {
          retry();
        } finally {
          refreshRunning = false;
        }
      } else if (code === "SERVER_UNAVAILABLE") retry();
    };
    socket.on("connect", sync);
    socket.on("appointments.changed", appointmentsChanged);
    socket.on("notifications.changed", notificationsChanged);
    socket.on("menus.changed", () => enqueue(["menus"], ["admin", "menus"]));
    socket.on("schedule.changed", (data: { doctorId?: string }) => {
      if (typeof data?.doctorId !== "string") return;
      if (role === "PATIENT") return;
      enqueue(["public", "doctor", data.doctorId, "schedule"]);
      if (userId === data.doctorId) enqueue(["doctor", "schedule"]);
      if (role === "ADMIN") enqueue(["admin", "doctors", data.doctorId]);
    });
    socket.on("session.invalid", sessionInvalid);
    socket.on(
      "connect_error",
      (error: Error & { data?: { code?: string } }) => {
        if (error.data?.code) void sessionInvalid(error.data);
      },
    );
    socket.on("disconnect", (reason) => {
      if (reason === "io server disconnect") retry();
    });
    const resume = () => {
      if (document.visibilityState === "visible") {
        sync();
        if (!socket.connected) socket.connect();
      }
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    // REST remains usable if a proxy or network blocks the socket connection.
    const fallback = setInterval(() => {
      if (!socket.connected && document.visibilityState === "visible") sync();
    }, 60_000);
    socket.connect();
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(retryTimer);
      clearInterval(fallback);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [accessToken, userId, role, queryClient]);

  return null;
}
