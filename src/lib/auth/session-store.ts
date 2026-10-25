"use client";

import { create } from "zustand";
import type { Role } from "@/types/api";
import type { StoredSession } from "./session-core";

type AuthState = {
  hydrated: boolean;
  finishHydration: () => void;
  accessToken: string | null;
  clearSession: () => Promise<void>;
  refreshToken: string | null;
  loginId: string | null;
  version: number;
  user: StoredSession["user"] | null;
};

// Only the coordinator writes disk. Hydration and subscriptions never persist state.
export const useAuthStore = create<AuthState>()((set, get) => ({
  hydrated: false,
  finishHydration: () => set({ hydrated: true }),
  accessToken: null,
  refreshToken: null,
  loginId: null,
  version: 0,
  user: null,
  clearSession: async () => {
    const loginId = get().loginId;
    const { logoutCurrentSession } = await import("./session-coordinator");
    await logoutCurrentSession(loginId);
  },
}));

export function applyStoredSession(session: StoredSession | null) {
  const previous = useAuthStore.getState();
  if (
    previous.loginId === (session?.loginId ?? null) &&
    previous.version === (session?.version ?? 0) &&
    previous.accessToken === (session?.accessToken ?? null) &&
    previous.refreshToken === (session?.refreshToken ?? null)
  )
    return;
  useAuthStore.setState({
    accessToken: session?.accessToken ?? null,
    refreshToken: session?.refreshToken ?? null,
    loginId: session?.loginId ?? null,
    version: session?.version ?? 0,
    user: session?.user ?? null,
  });
}

export function getRoleHome(role: Role) {
  if (role === "ADMIN") {
    return "/admin/dashboard";
  }

  if (role === "DOCTOR") {
    return "/doctor/dashboard";
  }

  return "/patient/dashboard";
}
