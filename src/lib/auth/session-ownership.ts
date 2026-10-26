import { readStoredSession } from "./session-coordinator";

export function isCurrentLogin(loginId: string | null) {
  return !!loginId && readStoredSession()?.loginId === loginId;
}

export function assertCurrentLogin(loginId: string | null) {
  if (!isCurrentLogin(loginId))
    throw new Error("Authentication session changed");
}
