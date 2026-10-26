import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import { MutationCache, QueryClient } from "@tanstack/react-query";
import {
  guardSessionMutationCallbacks,
  guardSessionMutationOptions,
} from "../src/lib/auth/session-mutation";
import { getPatientMe } from "../src/lib/api/patient";
import { registerPushDevice } from "../src/lib/api/notifications";

import { apiFetch, ApiError } from "../src/lib/api/client";
import {
  logoutCurrentSession,
  readStoredSession,
  replaceLoginSession,
  retryPendingLogouts,
  startSessionSynchronization,
  syncSessionFromStorage,
} from "../src/lib/auth/session-coordinator";
import {
  PENDING_LOGOUTS_KEY,
  SESSION_LOCK_NAME,
  SESSION_STORAGE_KEY,
  type StoredSession,
} from "../src/lib/auth/session-core";
import {
  applyStoredSession,
  useAuthStore,
} from "../src/lib/auth/session-store";

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

class MemoryStorage implements Storage {
  values = new Map<string, string>();
  writes = 0;
  get length() {
    return this.values.size;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  clear() {
    this.writes++;
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.writes++;
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.writes++;
    this.values.delete(key);
  }
}

const originalFetch = globalThis.fetch;
const globals = ["window", "navigator", "localStorage"] as const;
const originals = new Map(
  globals.map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ]),
);
let storage: MemoryStorage;
let lockTail: Promise<unknown>;

beforeEach(() => {
  storage = new MemoryStorage();
  lockTail = Promise.resolve();
  const locks = {
    request: <T>(name: string, fn: () => Promise<T>) => {
      assert.equal(name, SESSION_LOCK_NAME);
      const result = lockTail.then(fn);
      lockTail = result.catch(() => {});
      return result;
    },
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { locks },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: new EventTarget(),
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
  applyStoredSession(null);
});

afterEach(async () => {
  await lockTail;
  globalThis.fetch = originalFetch;
  for (const name of globals) {
    const original = originals.get(name);
    if (original) Object.defineProperty(globalThis, name, original);
    else Reflect.deleteProperty(globalThis, name);
  }
  applyStoredSession(null);
});

function store(next: StoredSession) {
  storage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({ state: next, version: 1 }),
  );
  syncSessionFromStorage();
}

function envelope(status = 200, data: unknown = { ok: true }) {
  return new Response(
    JSON.stringify(
      status === 401
        ? {
            success: false,
            error: { code: "UNAUTHORIZED", message: "Expired" },
          }
        : { success: true, data },
    ),
    { status },
  );
}

function changed(error: unknown) {
  return error instanceof ApiError && error.code === "SESSION_CHANGED";
}

test("old A 401 after switch to B never retries with B's bearer", async () => {
  const old = session();
  store(old);
  const response = deferred<Response>();
  const sent: string[] = [];
  globalThis.fetch = async (_input, init) => {
    sent.push(new Headers(init?.headers).get("Authorization") ?? "none");
    return response.promise;
  };
  const request = apiFetch("/private", {
    accessToken: old.accessToken,
    loginId: old.loginId,
  });
  const next = session("B");
  store(next);
  response.resolve(envelope(401));
  await assert.rejects(request, changed);
  assert.deepEqual(sent, [`Bearer ${old.accessToken}`]);
  assert.equal(readStoredSession()?.loginId, next.loginId);
});

test("successful A response cannot populate B's query cache", async () => {
  const old = session();
  store(old);
  const response = deferred<Response>();
  globalThis.fetch = async () => response.promise;
  const request = apiFetch("/private", {
    accessToken: old.accessToken,
    loginId: old.loginId,
  });
  store(session("B"));
  response.resolve(envelope(200, { privateData: "A" }));
  await assert.rejects(request, changed);
});

test("account change during JSON parsing also discards old response", async () => {
  const old = session();
  store(old);
  const reading = deferred<void>();
  const parsed = deferred<unknown>();
  const response = envelope();
  response.json = () => {
    reading.resolve();
    return parsed.promise;
  };
  globalThis.fetch = async () => response;
  const request = apiFetch("/private", {
    accessToken: old.accessToken,
    loginId: old.loginId,
  });
  await reading.promise;
  store(session()); // Same user, different actual login.
  parsed.resolve({ success: true, data: { privateData: "A" } });
  await assert.rejects(request, changed);
});

test("concurrent HTTP 401s rotate once under Web Locks and both reuse rotated access", async () => {
  const old = session();
  store(old);
  let refreshCalls = 0;
  const authorizations: string[] = [];
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith("/auth/refresh")) {
      refreshCalls++;
      assert.deepEqual(JSON.parse(init!.body as string), {
        refreshToken: old.refreshToken,
      });
      return envelope(200, {
        accessToken: "test-rotated-access",
        refreshToken: "test-rotated-refresh",
      });
    }
    const authorization = new Headers(init?.headers).get("Authorization")!;
    authorizations.push(authorization);
    return authorization === `Bearer ${old.accessToken}`
      ? envelope(401)
      : envelope();
  };
  const responses = await Promise.all([
    apiFetch("/private/one", {
      accessToken: old.accessToken,
      loginId: old.loginId,
    }),
    apiFetch("/private/two", {
      accessToken: old.accessToken,
      loginId: old.loginId,
    }),
  ]);
  assert.equal(responses.length, 2);
  assert.equal(refreshCalls, 1);
  assert.deepEqual(authorizations, [
    `Bearer ${old.accessToken}`,
    `Bearer ${old.accessToken}`,
    "Bearer test-rotated-access",
    "Bearer test-rotated-access",
  ]);
  assert.equal(readStoredSession()?.loginId, old.loginId);
  assert.equal(readStoredSession()?.version, 2);
});

test("stale callback carrying A bearer after B login is rejected before fetch", async () => {
  const old = session();
  store(old);
  store(session("B"));
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return envelope();
  };
  await assert.rejects(
    apiFetch("/private", {
      accessToken: old.accessToken,
      loginId: old.loginId,
    }),
    changed,
  );
  assert.equal(requests, 0);
});

test("browser startup, storage, focus and pageshow read disk without stale writeback", async () => {
  const old = session();
  store(old);
  const stop = startSessionSynchronization();
  try {
    storage.removeItem(SESSION_STORAGE_KEY);
    const writes = storage.writes;
    window.dispatchEvent(
      Object.assign(new Event("storage"), {
        key: SESSION_STORAGE_KEY,
        newValue: JSON.stringify({ state: old }),
      }),
    );
    assert.equal(useAuthStore.getState().loginId, null);
    assert.equal(storage.writes, writes);
    const next = session("B");
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ state: next }));
    const nextWrites = storage.writes;
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("pageshow"));
    assert.equal(useAuthStore.getState().loginId, next.loginId);
    assert.equal(storage.writes, nextWrites);
    assert.equal(useAuthStore.getState().hydrated, true);
  } finally {
    stop();
  }
});

test("browser offline logout persists refresh; online retry cannot clear B", async () => {
  const old = session();
  store(old);
  globalThis.fetch = async () => {
    throw new Error("offline");
  };
  assert.equal(await logoutCurrentSession(), true);
  assert.equal(readStoredSession(), null);
  assert.equal(useAuthStore.getState().loginId, null);
  assert.deepEqual(JSON.parse(storage.getItem(PENDING_LOGOUTS_KEY)!), [
    { loginId: old.loginId, refreshToken: old.refreshToken },
  ]);
  const next = await replaceLoginSession(session("B"));
  const revoked: string[] = [];
  globalThis.fetch = async (input, init) => {
    assert.ok(String(input).endsWith("/auth/logout"));
    revoked.push(JSON.parse(init!.body as string).refreshToken);
    return envelope();
  };
  await retryPendingLogouts();
  assert.deepEqual(revoked, [old.refreshToken]);
  assert.equal(readStoredSession()?.loginId, next.loginId);
  assert.equal(JSON.parse(storage.getItem(PENDING_LOGOUTS_KEY)!).length, 0);
});

test("persisted legacy/corrupt sessions fail validation instead of gaining a new loginId", () => {
  storage.setItem(SESSION_STORAGE_KEY, "{broken");
  assert.equal(readStoredSession(), null);
  const legacy = { ...session(), loginId: undefined };
  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ state: legacy }));
  syncSessionFromStorage();
  assert.equal(useAuthStore.getState().loginId, null);
  assert.equal(readStoredSession(), null);
});

test("retained logout callback owns its rendered login, never the new account", async () => {
  const old = session();
  store(old);
  const retainedLogout = () => logoutCurrentSession(old.loginId);
  const next = session("B");
  store(next);
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return envelope();
  };
  assert.equal(await retainedLogout(), false);
  assert.equal(readStoredSession()?.loginId, next.loginId);
  assert.equal(requests, 0);
});

test("duplicate bearer strings never let an old login callback adopt a new loginId", async () => {
  const old = session();
  const next = { ...session(), accessToken: old.accessToken };
  store(old);
  const retainedQuery = () => getPatientMe(old);
  store(next);
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return envelope();
  };
  await assert.rejects(retainedQuery(), changed);
  assert.equal(requests, 0);
  assert.equal(readStoredSession()?.loginId, next.loginId);
});

test("retained same-login old bearer uses latest disk token, including an unsynced other-tab refresh", async () => {
  const old = session();
  store(old);
  const retainedQuery = () => getPatientMe(old);
  const rotated = {
    ...old,
    version: 2,
    accessToken: "test-current-access",
    refreshToken: "test-current-refresh",
  };
  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ state: rotated }));
  const sent: string[] = [];
  globalThis.fetch = async (_input, init) => {
    sent.push(new Headers(init?.headers).get("Authorization")!);
    return envelope(200, { id: "A" });
  };
  assert.deepEqual(await retainedQuery(), { id: "A" });
  assert.deepEqual(sent, ["Bearer test-current-access"]);
  assert.equal(useAuthStore.getState().version, 2);
});

test("matching bearer without a captured loginId fails closed", async () => {
  const old = session();
  store(old);
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return envelope();
  };
  await assert.rejects(
    apiFetch("/private", { accessToken: old.accessToken, loginId: null }),
    changed,
  );
  assert.equal(requests, 0);
});

test("mutation success after the HTTP guard cannot repopulate B cache, even without an observer", async () => {
  const old = session();
  const next = session("B");
  store(old);
  const callbacks: string[] = [];
  const cache = new MutationCache({
    onSuccess: () => {
      // The switch happens after mutationFn returned, before local onSuccess.
      store(next);
      client.clear();
    },
  });
  const client = new QueryClient({ mutationCache: cache });
  globalThis.fetch = async () => envelope(200, { owner: "A" });
  const mutation = cache.build(
    client,
    guardSessionMutationOptions(old.loginId, {
      mutationFn: () => apiFetch<{ owner: string }>("/private", old),
      onSuccess: (data) => {
        callbacks.push("success");
        client.setQueryData(["admin", "system-settings"], data);
      },
      onSettled: () => {
        callbacks.push("settled");
      },
    }),
  );
  await mutation.execute(undefined);
  assert.equal(readStoredSession()?.loginId, next.loginId);
  assert.equal(client.getQueryData(["admin", "system-settings"]), undefined);
  assert.deepEqual(callbacks, []);
});

test("old mutation errors and settled callbacks are suppressed after switch", async () => {
  const old = session();
  store(old);
  const callbacks: string[] = [];
  const cache = new MutationCache({
    onError: () => {
      store(session("B"));
    },
  });
  const client = new QueryClient({ mutationCache: cache });
  const mutation = cache.build(
    client,
    guardSessionMutationOptions(old.loginId, {
      mutationFn: async () => {
        throw new Error("test failure");
      },
      onError: () => {
        callbacks.push("error");
      },
      onSettled: () => {
        callbacks.push("settled");
      },
    }),
  );
  await assert.rejects(mutation.execute(undefined), /test failure/);
  assert.deepEqual(callbacks, []);
});

test("retained mutation cannot start for a replaced login with the same bearer", async () => {
  const old = session();
  store(old);
  let executions = 0;
  const options = guardSessionMutationOptions(old.loginId, {
    mutationFn: async () => {
      executions++;
    },
  });
  store({ ...session(), accessToken: old.accessToken });
  const client = new QueryClient();
  const mutation = client.getMutationCache().build(client, options);
  await assert.rejects(mutation.execute(undefined), /session changed/i);
  assert.equal(executions, 0);
});

test("same-login rotation preserves mutation context and success callbacks", async () => {
  const old = session();
  store(old);
  const callbacks: string[] = [];
  const client = new QueryClient();
  const mutation = client.getMutationCache().build(
    client,
    guardSessionMutationOptions(old.loginId, {
      onMutate: () => ({ owner: "A" }),
      mutationFn: async () => {
        store({
          ...old,
          version: 2,
          accessToken: "test-rotated",
          refreshToken: "test-rotated-refresh",
        });
        return "saved";
      },
      onSuccess: (data, _variables, context) => {
        callbacks.push(`${context.owner}:${data}`);
      },
      onSettled: () => {
        callbacks.push("settled");
      },
    }),
  );
  assert.equal(await mutation.execute(undefined), "saved");
  assert.deepEqual(callbacks, ["A:saved", "settled"]);
});

test("per-call mutation callbacks also retain their originating loginId", () => {
  const old = session();
  store(old);
  const seen: string[] = [];
  const callbacks = guardSessionMutationCallbacks<void, Error, void>(
    old.loginId,
    {
      onSuccess: () => {
        seen.push("success");
      },
      onError: () => {
        seen.push("error");
      },
      onSettled: () => {
        seen.push("settled");
      },
    },
  );
  const context = {
    client: new QueryClient(),
    meta: undefined,
    mutationKey: undefined,
  };
  store(session("B"));
  callbacks.onSuccess?.(undefined, undefined, undefined, context);
  callbacks.onError?.(new Error("test failure"), undefined, undefined, context);
  callbacks.onSettled?.(undefined, null, undefined, undefined, context);
  assert.deepEqual(seen, []);
});

test("raw push registration rejects stale loginId even with duplicate bearers", async () => {
  const old = session();
  store(old);
  const payload = {
    token: "test-fcm",
    platform: "WEB" as const,
    refreshToken: old.refreshToken,
    installationId: "test-installation",
    receiptSecret: "s".repeat(43),
  };
  store({ ...session(), accessToken: old.accessToken });
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    return envelope();
  };
  await assert.rejects(registerPushDevice(payload, old), /session changed/i);
  assert.equal(requests, 0);
});

test("raw push registration rejects stale refresh body and late account switch without retry", async () => {
  const old = session();
  store(old);
  const payload = {
    token: "test-fcm",
    platform: "WEB" as const,
    refreshToken: old.refreshToken,
    installationId: "test-installation",
    receiptSecret: "s".repeat(43),
  };
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    const result = envelope();
    result.json = async () => {
      store(session("B"));
      return { success: true, data: {} };
    };
    return result;
  };
  const rotated = { ...old, version: 2, refreshToken: "test-latest-refresh" };
  store(rotated);
  await assert.rejects(registerPushDevice(payload, old), /session changed/i);
  assert.equal(requests, 0);
  store(old);
  await assert.rejects(registerPushDevice(payload, old), /session changed/i);
  assert.equal(requests, 1);
});
