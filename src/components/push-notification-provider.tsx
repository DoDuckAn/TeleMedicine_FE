"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/api/notifications";
import {
  readStoredSession,
  registerSessionCleanup,
} from "@/lib/auth/session-coordinator";
import { useAuthStore } from "@/lib/auth/session-store";
import {
  pushDisableFailure,
  pushRestoreFailure,
} from "@/lib/firebase/push-state";
import {
  disableCurrentPush,
  hasPushPrerequisites,
  installPushSessionCleanup,
  listenForForegroundPush,
  registerCurrentPush,
} from "@/lib/firebase/push-manager";

type PushStatus =
  "idle" | "enabling" | "enabled" | "denied" | "unsupported" | "error";
type PushContextValue = {
  status: PushStatus;
  message: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
};

const PushContext = createContext<PushContextValue>({
  status: "unsupported",
  message: "Thông báo trên trình duyệt chưa sẵn sàng.",
  enable: async () => {},
  disable: async () => {},
});

function ownedSession(loginId: string) {
  const session = readStoredSession();
  if (
    !session ||
    session.loginId !== loginId ||
    session.user.status !== "ACTIVE"
  ) {
    throw new Error("Phiên đăng nhập đã thay đổi.");
  }
  return session;
}

export function PushNotificationProvider({
  children,
}: {
  children?: ReactNode;
}) {
  // Register on first client render, before a login/logout interaction can occur.
  if (typeof window !== "undefined") installPushSessionCleanup();
  const queryClient = useQueryClient();
  const router = useRouter();
  const hydrated = useAuthStore((state) => state.hydrated);
  const loginId = useAuthStore((state) => state.loginId);
  const version = useAuthStore((state) => state.version);
  const userId = useAuthStore((state) => state.user?.id);
  const [state, setState] = useState<{
    loginId: string | null;
    status: PushStatus;
    message: string | null;
  }>({
    loginId: null,
    status: "idle",
    message: null,
  });
  const busy = useRef<string | null>(null);
  const [restoreTick, setRestoreTick] = useState(0);
  const toastIds = useRef(new Set<string | number>());
  const preferences = useQuery({
    enabled: hydrated && Boolean(loginId),
    queryKey: ["notifications", "preferences", loginId],
    queryFn: () => getNotificationPreferences(ownedSession(loginId!)),
  });
  const refetchPreferences = preferences.refetch;

  const publish = useCallback(
    (owner: string, status: PushStatus, message: string | null = null) => {
      if (readStoredSession()?.loginId === owner)
        setState({ loginId: owner, status, message });
    },
    [],
  );

  useEffect(() => {
    const dismiss = () => {
      toastIds.current.forEach((id) => toast.dismiss(id));
      toastIds.current.clear();
    };
    const unregister = registerSessionCleanup(async () => {
      dismiss();
    });
    return () => {
      unregister();
      dismiss();
    };
  }, [loginId]);

  useEffect(() => {
    if (!hydrated || !loginId || busy.current === loginId) return;
    let disposed = false;
    const owner = loginId;
    const restore = async () => {
      if (!hasPushPrerequisites()) {
        publish(
          owner,
          "unsupported",
          "Trình duyệt cần HTTPS, Web Locks và cấu hình thông báo hợp lệ.",
        );
        return;
      }
      if (Notification.permission !== "granted") {
        publish(
          owner,
          Notification.permission === "denied" ? "denied" : "idle",
          Notification.permission === "denied"
            ? "Thông báo đang bị chặn trong cài đặt trình duyệt."
            : null,
        );
        // Permission revocation invalidates the durable capability too.
        await disableCurrentPush(ownedSession(owner));
        return;
      }
      if (!preferences.isSuccess) return;
      if (!preferences.data.channels.push) {
        await disableCurrentPush(ownedSession(owner));
        if (!disposed) publish(owner, "idle");
        return;
      }
      publish(owner, "enabling");
      await registerCurrentPush(ownedSession(owner));
      if (!disposed) publish(owner, "enabled");
    };
    void restore().catch((error) => {
      if (!disposed) {
        const failure = pushRestoreFailure(error);
        publish(owner, failure.status, failure.message);
      }
    });
    return () => {
      disposed = true;
    };
  }, [
    hydrated,
    loginId,
    version,
    preferences.isSuccess,
    preferences.data?.channels.push,
    publish,
    restoreTick,
  ]);

  useEffect(() => {
    if (!loginId) return;
    let disposed = false;
    let stop = () => {};
    void listenForForegroundPush((notification) => {
      if (readStoredSession()?.loginId !== loginId) return;
      const id = toast(notification.title, {
        description: notification.body,
        action: {
          label: "Xem",
          onClick: () => {
            if (readStoredSession()?.loginId === loginId)
              router.push("/notifications");
          },
        },
        onDismiss: (item) => {
          toastIds.current.delete(item.id);
        },
        onAutoClose: (item) => {
          toastIds.current.delete(item.id);
        },
      });
      toastIds.current.add(id);
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    })
      .then((unsubscribe) => {
        if (disposed) unsubscribe();
        else stop = unsubscribe;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      stop();
    };
  }, [loginId, userId, queryClient, router]);

  useEffect(() => {
    if (!loginId) return;
    const check = () => {
      const session = readStoredSession();
      if (!session || session.loginId !== loginId || busy.current === loginId)
        return;
      setRestoreTick((value) => value + 1);
      void refetchPreferences();
    };
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    return () => {
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
    };
  }, [loginId, refetchPreferences]);

  const enable = async () => {
    if (!loginId || busy.current === loginId) return;
    if (!hasPushPrerequisites()) {
      publish(
        loginId,
        "unsupported",
        "Trình duyệt cần HTTPS, Web Locks và cấu hình thông báo hợp lệ.",
      );
      return;
    }
    // Request synchronously in the click call stack, before any await.
    const permission =
      Notification.permission === "default"
        ? Notification.requestPermission()
        : Promise.resolve(Notification.permission);
    busy.current = loginId;
    const owner = loginId;
    publish(owner, "enabling");
    try {
      if ((await permission) !== "granted") {
        publish(
          owner,
          "denied",
          "Chưa được cấp quyền thông báo trong trình duyệt.",
        );
        return;
      }
      const result = await updateNotificationPreferences(
        { channels: { push: true } },
        ownedSession(owner),
      );
      ownedSession(owner);
      queryClient.setQueryData(["notifications", "preferences", owner], result);
      await registerCurrentPush(ownedSession(owner), true);
      publish(owner, "enabled");
    } catch {
      publish(owner, "error", "Chưa bật được thông báo. Vui lòng thử lại.");
    } finally {
      if (busy.current === owner) busy.current = null;
    }
  };

  const disable = async () => {
    if (!loginId || busy.current === loginId) return;
    busy.current = loginId;
    const owner = loginId;
    publish(owner, "enabling");
    let localCleanupComplete = false;
    try {
      await disableCurrentPush(ownedSession(owner));
      localCleanupComplete = true;
      publish(owner, "idle");
      const result = await updateNotificationPreferences(
        { channels: { push: false } },
        ownedSession(owner),
      );
      ownedSession(owner);
      queryClient.setQueryData(["notifications", "preferences", owner], result);
    } catch {
      const failure = pushDisableFailure(localCleanupComplete);
      publish(owner, failure.status, failure.message);
    } finally {
      if (busy.current === owner) busy.current = null;
    }
  };

  const status = state.loginId === loginId ? state.status : "idle";
  return (
    <PushContext.Provider
      value={{
        status,
        message: state.loginId === loginId ? state.message : null,
        enable,
        disable,
      }}
    >
      {children}
    </PushContext.Provider>
  );
}

export function usePushNotifications() {
  return useContext(PushContext);
}
