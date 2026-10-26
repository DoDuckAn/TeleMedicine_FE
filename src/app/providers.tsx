"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Fragment, useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth/session-store";
import { startSessionSynchronization } from "@/lib/auth/session-coordinator";
import { LoadingBlock } from "@/components/ui/feedback";
import { Toaster } from "sonner";
import { RealtimeProvider } from "@/components/realtime-provider";
import { shouldRetryQuery, queryRetryDelay } from "@/lib/api/client";
import { PushNotificationProvider } from "@/components/push-notification-provider";
import { preparePushSession } from "@/lib/firebase/push-manager";

export function Providers({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthStore((state) => state.hydrated);
  const loginId = useAuthStore((state) => state.loginId);
  const [bootstrapFailed, setBootstrapFailed] = useState(false);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          mutations: { retry: false },
          queries: {
            retry: shouldRetryQuery,
            retryDelay: queryRetryDelay,
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    let disposed = false;
    let stop = () => {};
    const unsubscribe = useAuthStore.subscribe((state, previous) => {
      if (state.loginId !== previous.loginId) queryClient.clear();
    });
    void preparePushSession()
      .then(() => {
        if (!disposed) stop = startSessionSynchronization();
      })
      .catch(() => {
        if (!disposed) setBootstrapFailed(true);
      });
    return () => {
      disposed = true;
      stop();
      unsubscribe();
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {bootstrapFailed ? (
        <div role="alert" className="p-6 text-center text-sm text-red-700">
          Không thể khởi tạo phiên an toàn. Vui lòng dùng trình duyệt hỗ trợ Web
          Locks qua HTTPS hoặc localhost và cho phép lưu dữ liệu trang web.
        </div>
      ) : (
        <PushNotificationProvider>
          <Fragment key={loginId ?? "anonymous"}>
            {hydrated && <RealtimeProvider />}
            {hydrated ? children : <LoadingBlock className="min-h-screen" />}
          </Fragment>
        </PushNotificationProvider>
      )}
      <Toaster
        richColors
        closeButton
        toastOptions={{ closeButtonAriaLabel: "Đóng thông báo" }}
        position="top-right"
      />
    </QueryClientProvider>
  );
}
