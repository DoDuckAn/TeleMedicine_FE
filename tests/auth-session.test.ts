import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  createSessionCoordinator,
  MAX_PENDING_LOGOUTS,
  sameLogin,
  validateSession,
  type PendingLogout,
  type SessionDependencies,
  type StoredSession,
} from "../src/lib/auth/session-core";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function session(user = "A"): StoredSession {
  return {
    loginId: randomUUID(),
    version: 1,
    accessToken: `test-access-${user}`,
    refreshToken: `test-refresh-${user}`,
    user: { id: user, role: "PATIENT", status: "ACTIVE" },
  };
}

function browser(initial: StoredSession | null = session()) {
  let disk = initial;
  let queue: PendingLogout[] = [];
  let tail: Promise<unknown> = Promise.resolve();
  let refreshCalls = 0;
  let writes = 0;
  const events: string[] = [];
  const revoked: string[] = [];
  const dependencies: SessionDependencies = {
    lock: <T>(fn: () => Promise<T>) => {
      const result = tail.then(fn);
      tail = result.catch(() => {});
      return result;
    },
    read: () => disk,
    write: (next) => {
      disk = next;
      writes++;
      events.push(next ? "store-login" : "clear-login");
    },
    publish: () => {},
    readQueue: () => queue,
    writeQueue: (next) => {
      queue = next;
    },
    refresh: async () => {
      refreshCalls++;
      return {
        accessToken: "test-rotated-access",
        refreshToken: "test-rotated-refresh",
      };
    },
    revoke: async (token) => {
      revoked.push(token);
      events.push("revoke");
    },
    isAuthFailure: (error) =>
      error instanceof Error && error.message === "unauthorized",
    randomUUID,
  };
  return {
    dependencies,
    events,
    revoked,
    tab: () => createSessionCoordinator({ ...dependencies }),
    get disk() {
      return disk;
    },
    set disk(value) {
      disk = value;
    },
    get queue() {
      return queue;
    },
    set queue(value) {
      queue = value;
    },
    get refreshCalls() {
      return refreshCalls;
    },
    get writes() {
      return writes;
    },
  };
}

test("persisted sessions require frontend identity, valid user, and integer version", () => {
  const valid = session();
  assert.equal(validateSession(valid)?.loginId, valid.loginId);
  for (const invalid of [
    null,
    {},
    { ...valid, loginId: undefined },
    { ...valid, loginId: "backend-session-id" },
    { ...valid, version: 0 },
    { ...valid, version: 1.5 },
    { ...valid, refreshToken: "" },
    { ...valid, user: { ...valid.user, role: "ROOT" } },
    { ...valid, user: { ...valid.user, status: "unknown" } },
  ]) {
    assert.equal(validateSession(invalid), null);
  }
});

test("two tabs sharing a login rotate exactly once and preserve loginId", async () => {
  const browserState = browser();
  const before = browserState.disk!;
  const [first, second] = await Promise.all([
    browserState.tab().refreshSession(before),
    browserState.tab().refreshSession(before),
  ]);
  assert.equal(first, "test-rotated-access");
  assert.equal(second, first);
  assert.equal(browserState.refreshCalls, 1);
  assert.equal(browserState.disk?.loginId, before.loginId);
  assert.equal(browserState.disk?.version, 2);
});

test("logout waits for cleanup, then clears locally before revocation completes", async () => {
  const state = browser();
  const tab = state.tab();
  const cleanupStarted = deferred<void>();
  const cleanup = deferred<void>();
  const network = deferred<void>();
  const networkStarted = deferred<void>();
  state.dependencies.revoke = async () => {
    networkStarted.resolve();
    await network.promise;
  };
  const networkTab = state.tab();
  networkTab.registerSessionCleanup(async () => {
    cleanupStarted.resolve();
    await cleanup.promise;
    state.events.push("cleanup");
  });
  const logout = networkTab.logoutCurrentSession(state.disk!.loginId);
  await cleanupStarted.promise;
  assert.ok(state.disk);
  cleanup.resolve();
  await networkStarted.promise;
  assert.equal(state.disk, null);
  assert.equal(state.queue.length, 1);
  network.resolve();
  assert.equal(await logout, true);
  assert.deepEqual(state.events, ["cleanup", "clear-login"]);
  assert.equal(state.queue.length, 0);
  assert.equal(tab.readStoredSession(), null);
});

test("account switch cleans and revokes A before storing B", async () => {
  const state = browser();
  const old = state.disk!;
  const tab = state.tab();
  tab.registerSessionCleanup(async () => {
    state.events.push("cleanup");
  });
  const next = await tab.replaceLoginSession(session("B"));
  assert.deepEqual(state.events, [
    "cleanup",
    "clear-login",
    "revoke",
    "store-login",
  ]);
  assert.equal(state.disk?.user.id, "B");
  assert.notEqual(next.loginId, old.loginId);
  assert.deepEqual(state.revoked, [old.refreshToken]);
});

test("same user re-login still gets a new loginId for cache isolation", async () => {
  const state = browser();
  const old = state.disk!;
  const next = await state.tab().replaceLoginSession(old);
  assert.equal(next.user.id, old.user.id);
  assert.notEqual(next.loginId, old.loginId);
  assert.equal(next.version, 1);
  assert.equal(sameLogin(old, next), false);
});

test("offline logout persists a bounded queue and a fresh startup retries only A", async () => {
  const state = browser();
  const old = state.disk!;
  state.dependencies.revoke = async () => {
    throw new Error("offline");
  };
  await state.tab().logoutCurrentSession(old.loginId);
  assert.equal(state.disk, null);
  assert.deepEqual(state.queue, [
    { loginId: old.loginId, refreshToken: old.refreshToken },
  ]);
  state.disk = session("B");
  state.dependencies.revoke = async (token) => {
    state.revoked.push(token);
  };
  await state.tab().retryPendingLogouts();
  assert.deepEqual(state.revoked, [old.refreshToken]);
  assert.equal(state.queue.length, 0);
  assert.equal(state.disk.user.id, "B");
});

test("old A logout and old A refresh queued after B never clear or use B", async () => {
  const state = browser();
  const old = state.disk!;
  const switched = state.tab().replaceLoginSession(session("B"));
  const logout = state.tab().logoutCurrentSession(old.loginId);
  const refresh = state.tab().refreshSession(old);
  const next = await switched;
  assert.equal(await logout, false);
  assert.equal(await refresh, null);
  assert.equal(state.disk?.loginId, next.loginId);
  assert.equal(state.refreshCalls, 0);
});

test("refresh in flight then logout cannot resurrect the session", async () => {
  const state = browser();
  const old = state.disk!;
  const started = deferred<void>();
  const result = deferred<{ accessToken: string; refreshToken: string }>();
  state.dependencies.refresh = async () => {
    started.resolve();
    return result.promise;
  };
  const refreshing = state.tab().refreshSession(old);
  await started.promise;
  const logout = state.tab().logoutCurrentSession(old.loginId);
  result.resolve({
    accessToken: "test-next-access",
    refreshToken: "test-next-refresh",
  });
  await refreshing;
  await logout;
  assert.equal(state.disk, null);
  assert.deepEqual(state.revoked, ["test-next-refresh"]);
});

test("late refresh ignores non-cooperating account replacement, removal, or version change", async () => {
  for (const replacement of [null, session("B"), "version"] as const) {
    const state = browser();
    const old = state.disk!;
    const started = deferred<void>();
    const result = deferred<{ accessToken: string; refreshToken: string }>();
    state.dependencies.refresh = async () => {
      started.resolve();
      return result.promise;
    };
    const refreshing = state.tab().refreshSession(old);
    await started.promise;
    const next =
      replacement === "version"
        ? { ...old, version: old.version + 1 }
        : replacement;
    state.disk = next;
    result.resolve({
      accessToken: "test-late-access",
      refreshToken: "test-late-refresh",
    });
    assert.equal(await refreshing, null);
    assert.equal(state.disk, next);
    assert.equal(state.writes, 0);
  }
});

test("late unauthorized refresh from A cannot clear B", async () => {
  const state = browser();
  const next = session("B");
  state.dependencies.refresh = async () => {
    state.disk = next;
    throw new Error("unauthorized");
  };
  await assert.rejects(state.tab().refreshSession(state.disk!), /unauthorized/);
  assert.equal(state.disk, next);
  assert.equal(state.writes, 0);
});

test("offline refresh keeps login; terminal refresh failure awaits cleanup and clears it", async () => {
  const state = browser();
  const old = state.disk!;
  state.dependencies.refresh = async () => {
    throw new Error("offline");
  };
  await assert.rejects(state.tab().refreshSession(old), /offline/);
  assert.equal(state.disk, old);
  state.dependencies.refresh = async () => {
    throw new Error("unauthorized");
  };
  const tab = state.tab();
  tab.registerSessionCleanup(async () => {
    state.events.push("cleanup");
  });
  await assert.rejects(tab.refreshSession(old), /unauthorized/);
  assert.equal(state.disk, null);
  assert.equal(state.events[0], "cleanup");
});

test("cleanup failure aborts account switch; unregister permits it afterward", async () => {
  const state = browser();
  const old = state.disk!;
  const tab = state.tab();
  const unregister = tab.registerSessionCleanup(async () => {
    throw new Error("cleanup failed");
  });
  await assert.rejects(tab.replaceLoginSession(session("B")), /cleanup failed/);
  assert.equal(state.disk, old);
  unregister();
  await tab.replaceLoginSession(session("B"));
  assert.equal(state.disk?.user.id, "B");
});

test("focus/storage hydration only publishes latest disk and never writes stale state", () => {
  const state = browser();
  const observed: (StoredSession | null)[] = [];
  state.dependencies.publish = (next) => {
    observed.push(next);
  };
  const tab = state.tab();
  tab.syncSessionFromStorage();
  state.disk = null;
  tab.syncSessionFromStorage();
  state.disk = session("B");
  tab.syncSessionFromStorage();
  assert.equal(observed[1], null);
  assert.equal(observed[2]?.user.id, "B");
  assert.equal(state.writes, 0);
});

test("queue keeps newest 64 logins and does not retry active login", async () => {
  const state = browser();
  const active = state.disk!;
  state.queue = Array.from({ length: MAX_PENDING_LOGOUTS }, () => {
    const item = session();
    return { loginId: item.loginId, refreshToken: item.refreshToken };
  });
  state.dependencies.revoke = async () => {
    throw new Error("offline");
  };
  await state.tab().logoutCurrentSession(active.loginId);
  assert.equal(state.queue.length, MAX_PENDING_LOGOUTS);
  assert.equal(state.queue.at(-1)?.loginId, active.loginId);
  state.disk = active;
  let retriedActive = false;
  state.dependencies.revoke = async (token) => {
    if (token === active.refreshToken) retriedActive = true;
  };
  // Use unique tokens to distinguish synthetic queue entries.
  state.queue = [
    { loginId: active.loginId, refreshToken: active.refreshToken },
  ];
  await state.tab().retryPendingLogouts();
  assert.equal(retriedActive, false);
  assert.equal(state.queue.length, 1);
});
