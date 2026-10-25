import type { AuthSessionResponse } from "../../types/api";

export const SESSION_STORAGE_KEY = "khambenhtuxa-session";
export const PENDING_LOGOUTS_KEY = "khambenhtuxa-pending-logouts";
export const SESSION_LOCK_NAME = "telemedicine-auth";
export const MAX_PENDING_LOGOUTS = 64;

// Browser-only identity, never a backend session id or an access-token claim.
export type StoredSession = AuthSessionResponse & {
  loginId: string;
  version: number;
};

export type PendingLogout = { loginId: string; refreshToken: string };
type Tokens = Pick<AuthSessionResponse, "accessToken" | "refreshToken">;

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function validateSession(value: unknown): StoredSession | null {
  if (!record(value)) return null;
  const { accessToken, refreshToken, loginId, version, user } = value;
  if (
    typeof accessToken !== "string" ||
    !accessToken ||
    typeof refreshToken !== "string" ||
    !refreshToken ||
    typeof loginId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      loginId,
    ) ||
    !Number.isSafeInteger(version) ||
    (version as number) < 1 ||
    !record(user) ||
    typeof user.id !== "string" ||
    !user.id ||
    !["PATIENT", "DOCTOR", "ADMIN"].includes(user.role as string) ||
    !["ACTIVE", "DISABLED"].includes(user.status as string) ||
    [user.email, user.phone].some(
      (field) => field != null && typeof field !== "string",
    ) ||
    (user.createdAt !== undefined && typeof user.createdAt !== "string")
  )
    return null;
  return {
    accessToken,
    refreshToken,
    loginId,
    version: version as number,
    user: {
      id: user.id,
      role: user.role as StoredSession["user"]["role"],
      status: user.status as StoredSession["user"]["status"],
      email: user.email as string | null | undefined,
      phone: user.phone as string | null | undefined,
      createdAt: user.createdAt as string | undefined,
    },
  };
}

export function sameLogin(
  a: { loginId: string } | null,
  b: { loginId: string } | null,
) {
  return !!a && !!b && a.loginId === b.loginId;
}

export function sameVersion(a: StoredSession | null, b: StoredSession | null) {
  return (
    sameLogin(a, b) &&
    a?.version === b?.version &&
    a?.refreshToken === b?.refreshToken
  );
}

export type SessionDependencies = {
  lock: <T>(fn: () => Promise<T>) => Promise<T>;
  read: () => StoredSession | null;
  write: (session: StoredSession | null) => void;
  publish: (session: StoredSession | null) => void;
  readQueue: () => PendingLogout[];
  writeQueue: (queue: PendingLogout[]) => void;
  revoke: (refreshToken: string) => Promise<void>;
  refresh: (refreshToken: string) => Promise<Tokens>;
  isAuthFailure: (error: unknown) => boolean;
  randomUUID: () => string;
};

export function createSessionCoordinator(deps: SessionDependencies) {
  const cleanups = new Set<() => Promise<void>>();

  function syncSessionFromStorage() {
    const session = deps.read();
    deps.publish(session);
    return session;
  }

  function enqueue(session: StoredSession) {
    const queue = deps
      .readQueue()
      .filter((item) => item.loginId !== session.loginId);
    queue.push({
      loginId: session.loginId,
      refreshToken: session.refreshToken,
    });
    deps.writeQueue(queue.slice(-MAX_PENDING_LOGOUTS));
  }

  async function revokePending(item: PendingLogout) {
    try {
      await deps.revoke(item.refreshToken);
      deps.writeQueue(
        deps.readQueue().filter((entry) => entry.loginId !== item.loginId),
      );
    } catch {
      // Durable retry only. Never log refresh tokens or block local logout on the network.
    }
  }

  async function endSessionLocked(session: StoredSession) {
    // Fail closed on cleanup failure: do not bind a new account to old worker state.
    for (const cleanup of cleanups) await cleanup();
    if (!sameLogin(deps.read(), session)) return;
    enqueue(session);
    deps.write(null);
    deps.publish(null);
    await revokePending(session);
  }

  return {
    withSessionLock: deps.lock,
    readStoredSession: deps.read,
    syncSessionFromStorage,
    registerSessionCleanup(fn: () => Promise<void>) {
      cleanups.add(fn);
      return () => {
        cleanups.delete(fn);
      };
    },
    logoutCurrentSession(loginId: string | null) {
      return deps.lock(async () => {
        const current = deps.read();
        if (!current || current.loginId !== loginId) {
          syncSessionFromStorage();
          return false;
        }
        await endSessionLocked(current);
        return true;
      });
    },
    replaceLoginSession(session: AuthSessionResponse) {
      return deps.lock(async () => {
        const next = validateSession({
          ...session,
          loginId: deps.randomUUID(),
          version: 1,
        });
        if (!next) throw new Error("Invalid login response");
        const current = deps.read();
        if (current) await endSessionLocked(current);
        // Cleanup or a non-cooperating writer must never be allowed to overwrite B.
        if (deps.read())
          throw new Error("Session changed during account replacement");
        deps.write(next);
        deps.publish(next);
        return next;
      });
    },
    retryPendingLogouts() {
      return deps.lock(async () => {
        for (const item of deps.readQueue()) {
          // Even corrupt queue state must not revoke the active login.
          if (deps.read()?.loginId !== item.loginId) await revokePending(item);
        }
      });
    },
    refreshSession(expected: StoredSession) {
      return deps.lock(async () => {
        const current = syncSessionFromStorage();
        if (!current || !sameLogin(current, expected)) return null;
        // Another tab already rotated while this caller was waiting for the lock.
        if (!sameVersion(current, expected)) return current.accessToken;
        let tokens: Tokens;
        try {
          tokens = await deps.refresh(current.refreshToken);
        } catch (error) {
          if (sameVersion(deps.read(), current) && deps.isAuthFailure(error)) {
            await endSessionLocked(current);
          }
          throw error;
        }
        if (!sameVersion(deps.read(), current)) {
          syncSessionFromStorage();
          return null;
        }
        const next = validateSession({
          ...current,
          ...tokens,
          version: current.version + 1,
        });
        if (!next) throw new Error("Invalid refresh response");
        deps.write(next);
        deps.publish(next);
        return next.accessToken;
      });
    },
  };
}
