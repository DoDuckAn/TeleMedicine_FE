"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui/feedback";
import { getRoleHome, useAuthStore } from "@/lib/auth/session-store";
import { RoleMenuNav, useRoleMenu } from "@/components/role-menu";

export function AdminShell({
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
  const menuQuery = useRoleMenu(accessToken ?? "", user?.role);

  useEffect(() => {
    if (!accessToken || !user) {
      router.replace("/auth/staff");
      return;
    }

    if (user.role !== "ADMIN") {
      router.replace(getRoleHome(user.role));
    }
  }, [accessToken, router, user]);

  if (!accessToken || !user || user.role !== "ADMIN") {
    return <LoadingBlock className="min-h-screen rounded-none border-0" />;
  }

  function logout() {
    clearSession();
    router.push("/auth/staff");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-blue-100 bg-white px-4 py-5 lg:block">
        <Link href="/admin/dashboard">
          <BrandMark />
        </Link>

        <RoleMenuNav items={menuQuery.data?.items ?? []} pathname={pathname} />
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-blue-100 bg-white/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase text-primary">
                Quản trị hệ thống
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
