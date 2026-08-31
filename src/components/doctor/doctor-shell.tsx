"use client";

import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  Home,
  LogOut,
  MessageSquareText,
  Settings,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui/feedback";
import { getRoleHome, useAuthStore } from "@/lib/auth/session-store";
import { cn } from "@/lib/utils";

const activeNavItems = [
  { href: "/doctor/dashboard", icon: Home, label: "Tổng quan" },
  { href: "/doctor/requests", icon: ClipboardList, label: "Yêu cầu khám" },
  { href: "/doctor/appointments", icon: CalendarClock, label: "Lịch tư vấn" },
  { href: "/doctor/schedule", icon: Settings, label: "Lịch làm việc" },
  { href: "/doctor/reviews", icon: MessageSquareText, label: "Đánh giá" },
  { href: "/doctor/statistics", icon: BarChart3, label: "Thống kê" },
  { href: "/doctor/profile", icon: UserRound, label: "Hồ sơ" },
];

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
  const clearSession = useAuthStore((state) => state.clearSession);
  const user = useAuthStore((state) => state.user);

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

  function logout() {
    clearSession();
    router.push("/auth/staff");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-blue-100 bg-white px-4 py-5 lg:block">
        <Link href="/doctor/dashboard">
          <BrandMark />
        </Link>

        <DoctorNav pathname={pathname} />
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
              <Link
                className={buttonVariants({ size: "sm", variant: "success" })}
                href="/doctor/requests"
              >
                <ClipboardList aria-hidden="true" className="size-4" />
                Yêu cầu khám
              </Link>
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
            <DoctorNav mobile pathname={pathname} />
          </div>
        </div>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function DoctorNav({
  mobile = false,
  pathname,
}: {
  mobile?: boolean;
  pathname: string;
}) {
  return (
    <nav className={mobile ? "flex min-w-max gap-2" : "mt-8 space-y-1"}>
      {activeNavItems.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            className={cn(
              "flex items-center gap-3 rounded-lg text-sm font-semibold transition",
              mobile ? "px-3 py-2" : "px-3 py-2.5",
              active
                ? "bg-blue-50 text-primary"
                : "text-slate-600 hover:bg-slate-100 hover:text-primary",
            )}
            href={item.href}
            key={item.href}
          >
            <Icon aria-hidden="true" className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
