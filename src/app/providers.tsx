"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth/session-store";
import { LoadingBlock } from "@/components/ui/feedback";
import { Toaster } from "sonner";
import { RealtimeProvider } from "@/components/realtime-provider";
import { shouldRetryQuery, queryRetryDelay } from "@/lib/api/client";
import { PushNotificationProvider } from "@/components/push-notification-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthStore((state) => state.hydrated);
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
    Promise.resolve(useAuthStore.persist.rehydrate()).finally(() =>
      useAuthStore.getState().finishHydration(),
    );
    return useAuthStore.subscribe((state, previous) => {
      if (state.user?.id !== previous.user?.id) queryClient.clear();
    });
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {hydrated && <RealtimeProvider />}
      {hydrated ? <PushNotificationProvider>{children}</PushNotificationProvider> : <LoadingBlock className="min-h-screen" />}
      <Toaster
        richColors
        closeButton
        toastOptions={{ closeButtonAriaLabel: "Đóng thông báo" }}
        position="top-right"
      />
    </QueryClientProvider>
  );
}
