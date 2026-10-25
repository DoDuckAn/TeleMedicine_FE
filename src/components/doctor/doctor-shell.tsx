"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getDoctorPendingAppointments,
  getDoctorUpcomingAppointments,
} from "@/lib/api/doctor";
import { RoleMenuNav, useRoleMenu } from "@/components/role-menu";

import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui/feedback";
import { getRoleHome, useAuthStore } from "@/lib/auth/session-store";
import { logoutCurrentSession } from "@/lib/auth/session-coordinator";
import { toast } from "sonner";

export function DoctorShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const auth = { accessToken: accessToken ?? "" };
  const enabled = Boolean(accessToken) && user?.role === "DOCTOR";
  const menuQuery = useRoleMenu(accessToken ?? "", user?.role);
  const pendingQuery = useQuery({
    queryKey: ["doctor", "appointments", "nav-pending", user?.id],
    queryFn: () => getDoctorPendingAppointments({ limit: 1, page: 1 }, auth),
    enabled,
    refetchInterval: 60_000,
  });
  const futureQuery = useQuery({
    queryKey: ["doctor", "appointments", "nav-future", user?.id],
    queryFn: () =>
      getDoctorUpcomingAppointments(
        {
          limit: 1,
          page: 1,
        },
        auth,
      ),
    enabled,
    refetchInterval: 60_000,
  });
  const counts: Record<string, number | undefined> = {
    PENDING_REQUESTS: pendingQuery.data?.pagination.total,
    UPCOMING_APPOINTMENTS: futureQuery.data?.pagination.total,
  };

  useEffect(() => {
    if (!accessToken || !user) {
      router.replace("/auth/staff");
      return;
    }

    if (user.role !== "DOCTOR") {
      router.replace(getRoleHome(user.role));
    }
  }, [accessToken, router, user]);

  if (!accessToken || !user || user.role !== "DOCTOR") {
    return <LoadingBlock className="min-h-screen rounded-none border-0" />;
  }

  async function logout() {
    try {
      if (await logoutCurrentSession()) router.push("/auth/staff");
    } catch {
      toast.error("Chưa thể đăng xuất an toàn. Vui lòng thử lại.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-blue-100 bg-white px-4 py-5 lg:block">
        <Link href="/doctor/dashboard">
          <BrandMark />
        </Link>

        <RoleMenuNav
          counts={counts}
          items={menuQuery.data?.items ?? []}
          pathname={pathname}
        />
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-blue-100 bg-white/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase text-primary">
                Bác sĩ
              </p>
              <h1 className="text-xl font-bold text-slate-900">{title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                className={buttonVariants({ size: "sm", variant: "outline" })}
                onClick={logout}
                type="button"
              >
                <LogOut aria-hidden="true" className="size-4" />
                Đăng xuất
              </button>
            </div>
          </div>
        </header>

        <div className="border-b border-blue-100 bg-white lg:hidden">
          <div className="overflow-x-auto px-4 py-3">
            <RoleMenuNav
              counts={counts}
              items={menuQuery.data?.items ?? []}
              mobile
              pathname={pathname}
            />
          </div>
        </div>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
