"use client";

import {
  createSessionCoordinator,
  MAX_PENDING_LOGOUTS,
  PENDING_LOGOUTS_KEY,
  SESSION_LOCK_NAME,
  SESSION_STORAGE_KEY,
  validateSession,
  type PendingLogout,
  type StoredSession,
} from "./session-core";
import { applyStoredSession, useAuthStore } from "./session-store";
import {
  AuthTransportError,
  revokeRefreshToken,
  rotateRefreshToken,
} from "./session-transport";

export type { StoredSession } from "./session-core";

export async function withSessionLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks) {
    // An in-memory/localStorage mutex cannot protect rotating tokens across tabs.
    throw new Error("Vui lòng dùng trình duyệt hỗ trợ Web Locks qua HTTPS hoặc localhost để đăng nhập an toàn.");
  }
  return navigator.locks.request(SESSION_LOCK_NAME, fn);
}

export function readStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const persisted: unknown = JSON.parse(
      localStorage.getItem(SESSION_STORAGE_KEY) ?? "null",
    );
    if (!persisted || typeof persisted !== "object" || !("state" in persisted))
      return null;
    return validateSession(persisted.state);
  } catch {
    return null;
  }
}

function readQueue(): PendingLogout[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(PENDING_LOGOUTS_KEY) ?? "[]",
    );
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item): item is PendingLogout =>
          !!item &&
          typeof item === "object" &&
          typeof item.loginId === "string" &&
          !!item.loginId &&
          typeof item.refreshToken === "string" &&
          !!item.refreshToken,
      )
      .slice(-MAX_PENDING_LOGOUTS);
  } catch {
    return [];
  }
}

const coordinator = createSessionCoordinator({
  lock: withSessionLock,
  read: readStoredSession,
  write: (session) => {
    if (session) {
      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ state: session, version: 1 }),
      );
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  },
  publish: applyStoredSession,
  readQueue,
  writeQueue: (queue) =>
    localStorage.setItem(PENDING_LOGOUTS_KEY, JSON.stringify(queue)),
  revoke: revokeRefreshToken,
  refresh: rotateRefreshToken,
  isAuthFailure: (error) =>
    error instanceof AuthTransportError && [401, 403].includes(error.status),
  randomUUID: () => crypto.randomUUID(),
});

/** Cleanup runs under telemedicine-auth; callbacks must not reacquire that lock. */
export const registerSessionCleanup = coordinator.registerSessionCleanup;
export const replaceLoginSession = coordinator.replaceLoginSession;
export const retryPendingLogouts = coordinator.retryPendingLogouts;
export const refreshSession = coordinator.refreshSession;
export const syncSessionFromStorage = coordinator.syncSessionFromStorage;

/** Capture before waiting: a queued A logout must not log out a subsequent B. */
export function logoutCurrentSession(
  loginId = useAuthStore.getState().loginId,
) {
  return coordinator.logoutCurrentSession(loginId);
}

export function startSessionSynchronization() {
  const sync = () => {
    syncSessionFromStorage();
  };
  const retry = () => {
    void retryPendingLogouts().catch(() => {});
  };
  const storage = (event: StorageEvent) => {
    // Read disk, not event.newValue: events themselves may already be stale.
    if (event.key === SESSION_STORAGE_KEY || event.key === null) sync();
  };
  window.addEventListener("storage", storage);
  window.addEventListener("focus", sync);
  window.addEventListener("pageshow", sync);
  window.addEventListener("online", retry);
  sync();
  useAuthStore.getState().finishHydration();
  retry();
  return () => {
    window.removeEventListener("storage", storage);
    window.removeEventListener("focus", sync);
    window.removeEventListener("pageshow", sync);
    window.removeEventListener("online", retry);
  };
}
