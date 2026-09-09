"use client";

import {
  Bell,
  Calendar,
  CalendarClock,
  ClipboardList,
  Home,
  LogOut,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";
import { getRoleHome, useAuthStore } from "@/lib/auth/session-store";

const navItems = [
  { href: "/patient/dashboard", icon: Home, label: "Tổng quan" },
  { href: "/patient/doctors", icon: Calendar, label: "Đặt lịch hẹn" },
  { href: "/patient/appointments", icon: CalendarClock, label: "Lịch hẹn" },
  { href: "/patient/history", icon: ClipboardList, label: "Lịch sử khám" },
  { href: "/notifications", icon: Bell, label: "Thông báo" },
  { href: "/patient/profile", icon: UserRound, label: "Hồ sơ" },
];

export function PatientShell({
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
      router.replace("/auth/patient");
      return;
    }

    if (user.role !== "PATIENT") {
      router.replace(getRoleHome(user.role));
    }
  }, [accessToken, router, user]);

  if (!accessToken || !user || user.role !== "PATIENT") {
    return <LoadingBlock className="min-h-screen rounded-none border-0" />;
  }

  function logout() {
    clearSession();
    router.push("/auth/patient");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-blue-100 bg-white px-4 py-5 lg:block">
        <Link href="/patient/dashboard">
          <BrandMark />
        </Link>

        <nav className="mt-8 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition",
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
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-blue-100 bg-white/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase text-primary">
                Bệnh nhân
              </p>
              <h1 className="text-xl font-bold text-slate-900">{title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link
                className={buttonVariants({ size: "sm", variant: "success" })}
                href="/patient/doctors"
              >
                <Calendar aria-hidden="true" className="size-4" />
                Đặt lịch hẹn
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

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
