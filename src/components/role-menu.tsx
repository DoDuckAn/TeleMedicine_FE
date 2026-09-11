"use client";

import * as Icons from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getMyMenu, type MenuItem } from "@/lib/api/menus";
import { NavCount, NotificationNavCount } from "@/components/nav-count";
import { cn } from "@/lib/utils";

const iconMap: Record<string, typeof Icons.Home> = {
  Home: Icons.Home,
  Calendar: Icons.Calendar,
  CalendarClock: Icons.CalendarClock,
  ClipboardList: Icons.ClipboardList,
  Bell: Icons.Bell,
  UserRound: Icons.UserRound,
  Settings: Icons.Settings,
  MessageSquareText: Icons.MessageSquareText,
  BarChart3: Icons.BarChart3,
  LayoutDashboard: Icons.LayoutDashboard,
  Stethoscope: Icons.Stethoscope,
  UsersRound: Icons.UsersRound,
  Tags: Icons.Tags,
  ListTree: Icons.ListTree,
};

export function useRoleMenu(accessToken: string, role?: string) {
  return useQuery({
    queryKey: ["menus", role],
    queryFn: () => getMyMenu({ accessToken }),
    enabled: Boolean(accessToken && role),
    staleTime: 5 * 60_000,
  });
}

export function RoleMenuNav({
  items,
  pathname,
  mobile = false,
  counts = {},
}: {
  items: MenuItem[];
  pathname: string;
  mobile?: boolean;
  counts?: Record<string, number | undefined>;
}) {
  return (
    <nav
      aria-label="Menu chính"
      className={mobile ? "flex min-w-max gap-2" : "mt-8 space-y-1"}
    >
      {items.map((item) => {
        const Icon = iconMap[item.iconKey] ?? Icons.Circle;
        const active =
          pathname === item.path || pathname.startsWith(`${item.path}/`);
        return (
          <Link
            className={cn(
              "flex items-center gap-3 rounded-lg text-sm font-semibold transition",
              mobile ? "px-3 py-2" : "px-3 py-2.5",
              active
                ? "bg-blue-50 text-primary"
                : "text-slate-600 hover:bg-slate-100 hover:text-primary",
            )}
            href={item.path}
            key={item.id}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span>{item.label}</span>
            {item.badgeKey === "UNREAD_NOTIFICATIONS" ? (
              <NotificationNavCount />
            ) : item.badgeKey ? (
              <NavCount count={counts[item.badgeKey]} label="mục cần xử lý" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
