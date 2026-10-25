"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth/session-store";
import { startSessionSynchronization } from "@/lib/auth/session-coordinator";
import { LoadingBlock } from "@/components/ui/feedback";
import { Toaster } from "sonner";
import { RealtimeProvider } from "@/components/realtime-provider";
import { shouldRetryQuery, queryRetryDelay } from "@/lib/api/client";

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
    const unsubscribe = useAuthStore.subscribe((state, previous) => {
      if (state.loginId !== previous.loginId) queryClient.clear();
    });
    const stop = startSessionSynchronization();
    return () => {
      stop();
      unsubscribe();
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {hydrated && <RealtimeProvider />}
      {hydrated ? children : <LoadingBlock className="min-h-screen" />}
      <Toaster
        richColors
        closeButton
        toastOptions={{ closeButtonAriaLabel: "Đóng thông báo" }}
        position="top-right"
      />
    </QueryClientProvider>
  );
}
