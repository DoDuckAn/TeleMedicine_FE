"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { AuthSessionResponse, AuthUser, Role } from "@/types/api";

type AuthState = {
  accessToken: string | null;
  clearSession: () => void;
  refreshToken: string | null;
  setSession: (session: AuthSessionResponse) => void;
  user: AuthUser | null;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      clearSession: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
        }),
      refreshToken: null,
      setSession: (session) =>
        set({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          user: session.user,
        }),
      user: null,
    }),
    {
      name: "khambenhtuxa-session",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export function getRoleHome(role: Role) {
  if (role === "ADMIN") {
    return "/admin/dashboard";
  }

  if (role === "DOCTOR") {
    return "/doctor/dashboard";
  }

  return "/patient/dashboard";
}
