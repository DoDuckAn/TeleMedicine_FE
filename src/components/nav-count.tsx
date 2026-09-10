"use client";

import { useQuery } from "@tanstack/react-query";
import { getUnreadNotificationCount } from "@/lib/api/notifications";
import { useAuthStore } from "@/lib/auth/session-store";

export function NavCount({count,label}:{count?:number;label:string}) {
  if(!count)return null;
  return <span aria-label={`${count} ${label}`} title={`${count} ${label}`} className="ml-auto inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold tabular-nums text-white">{count>99?"99+":count}</span>;
}

export function NotificationNavCount() {
  const accessToken=useAuthStore((state)=>state.accessToken);
  const query=useQuery({
    queryKey:["notifications","unread-count"],
    queryFn:()=>getUnreadNotificationCount({accessToken:accessToken??""}),
    enabled:Boolean(accessToken),
    staleTime:30_000,
  });
  return <NavCount count={query.data?.count} label="thông báo chưa đọc"/>;
}
