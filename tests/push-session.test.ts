import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  createSessionCoordinator,
  type StoredSession,
} from "../src/lib/auth/session-core";
import type * as Manager from "../src/lib/firebase/push-manager";
import type * as Storage from "../src/lib/firebase/push-storage";
import type * as Receipt from "../src/lib/firebase/push-receipt";
import {
  PushSuppressedError,
  pushDisableFailure,
  pushRestoreFailure,
} from "../src/lib/firebase/push-state";
import {
  deferred,
  indexedDatabase,
  loadTypeScript,
  lockManager,
} from "./push-test-helpers";

function session(user = "A"): StoredSession {
  return {
    accessToken: `access-${user}`,
    refreshToken: `refresh-${user}`,
    loginId: randomUUID(),
    version: 1,
    user: { id: user, role: "PATIENT", status: "ACTIVE" },
  };
}

function browser() {
  const database = indexedDatabase();
  const locks = lockManager();
  const initial = session();
  let disk: StoredSession | null = initial;
  let tokenCalls = 0;
  let deleteTokenCalls = 0;
  let registrations = 0;
  let online = false;
  let permission = "granted";
  const events: string[] = [];
  const deviceRequests: Record<string, unknown>[] = [];
  const foregroundCallbacks: ((payload: unknown) => Promise<void>)[] = [];
  const displayed = [
    {
      data: { bindingId: "binding-A" },
      close: () => {
        events.push("close-notification");
      },
    },
  ];
  const registration = {
    active: { scriptURL: "https://app.test/firebase-messaging-sw.js" },
    getNotifications: async () => displayed,
    unregister: async () => {
      events.push("unregister-worker");
      return true;
    },
  };
  const coordinator = createSessionCoordinator({
    lock: (callback) => locks.request("telemedicine-auth", callback),
    read: () => disk,
    write: (value) => {
      if (!value) {
        assert.equal(
          database.records.get("binding"),
          undefined,
          "durable binding cleared before local UI clear",
        );
        assert.ok(
          events.includes("close-notification"),
          "displayed notification closed before local UI clear",
        );
        events.push("clear-session");
      }
      disk = value;
    },
    publish: () => {},
    readQueue: () => [],
    writeQueue: () => {},
    revoke: async () => {
      events.push("revoke-refresh");
    },
    refresh: async () => ({
      accessToken: "rotated-access",
      refreshToken: "rotated-refresh",
    }),
    isAuthFailure: () => false,
    randomUUID,
  });
  let getToken = async () => "fcm-token";
  let deleteToken = async () => {};
  const timers = new Map<number, () => void>();
  let timerId = 0;
  let register = async () => ({
    id: "binding-A",
    platform: "WEB",
    lastRegisteredAt: new Date().toISOString(),
  });
  let resolve = async () => ({
    ok: true,
    json: async () => ({
      success: true,
      data: {
        title: "Generic update",
        body: "Open the app.",
        url: "/notifications",
        notificationId: "delivery-1",
      },
    }),
  });
  const navigator = {
    locks,
    get onLine() {
      return online;
    },
    serviceWorker: {
      getRegistrations: async () => [registration],
      register: async () => {
        registrations++;
        return registration;
      },
    },
  };
  const globals = {
    indexedDB: database.indexedDB,
    window: {
      isSecureContext: true,
      indexedDB: database.indexedDB,
      Notification: {},
    },
    navigator,
    Notification: {
      get permission() {
        return permission;
      },
    },
    document: { visibilityState: "visible" },
    process: {
      env: {
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "test-sender",
        NEXT_PUBLIC_FIREBASE_VAPID_KEY: "test-vapid",
      },
    },
    fetch: async () => resolve(),
    setTimeout: (callback: () => void) => {
      timers.set(++timerId, callback);
      return timerId;
    },
    clearTimeout: (id: number) => {
      timers.delete(id);
    },
  };
  const storage = loadTypeScript<typeof Storage>(
    "src/lib/firebase/push-storage.ts",
    {},
    globals,
  );
  const receipt = loadTypeScript<typeof Receipt>(
    "src/lib/firebase/push-receipt.ts",
    { "./push-storage": storage },
    globals,
  );
  const manager = loadTypeScript<typeof Manager>(
    "src/lib/firebase/push-manager.ts",
    {
      "@/lib/api/client": { API_BASE_URL: "https://api.test/api/v1" },
      "@/lib/api/notifications": {
        registerPushDevice: async (
          payload: Record<string, unknown>,
          auth: StoredSession,
        ) => {
          assert.equal(auth.refreshToken, disk?.refreshToken);
          assert.equal(payload.refreshToken, disk?.refreshToken);
          deviceRequests.push(payload);
          return register();
        },
        removePushDevice: async () => {
          events.push("delete-device");
        },
      },
      "@/lib/auth/session-coordinator": coordinator,
      "./client": {
        isFirebaseConfigured: () => true,
        getFirebaseApp: () => ({}),
      },
      "./push-storage": storage,
      "./push-receipt": receipt,
      "./push-state": { PushSuppressedError },
      "firebase/messaging": {
        isSupported: async () => true,
        getMessaging: () => ({}),
        getToken: async () => {
          tokenCalls++;
          return getToken();
        },
        deleteToken: async () => {
          deleteTokenCalls++;
          events.push("delete-firebase-token");
          await deleteToken();
        },
        onMessage: (
          _messaging: unknown,
          callback: (payload: unknown) => Promise<void>,
        ) => {
          foregroundCallbacks.push(callback);
          return () => {};
        },
      },
    },
    globals,
  );
  manager.installPushSessionCleanup();
  return {
    ...database,
    initial,
    manager,
    storage,
    coordinator,
    events,
    deviceRequests,
    navigator,
    current: () => disk!,
    writeSession: (value: StoredSession | null) => {
      disk = value;
    },
    tokenCalls: () => tokenCalls,
    deleteTokenCalls: () => deleteTokenCalls,
    registrations: () => registrations,
    permission: (value: string) => {
      permission = value;
    },
    online: () => {
      online = true;
    },
    getToken: (callback: typeof getToken) => {
      getToken = callback;
    },
    deleteToken: (callback: typeof deleteToken) => {
      deleteToken = callback;
    },
    expireRequests: () => {
      [...timers.values()].forEach((callback) => callback());
    },
    register: (callback: typeof register) => {
      register = callback;
    },
    resolveWith: (callback: typeof resolve) => {
      resolve = callback;
    },
    deliver: async (payload: unknown) => {
      await Promise.all(
        foregroundCallbacks.map((callback) => callback(payload)),
      );
    },
  };
}

test("registration stores only capability fields, stable installation, and current rotated refresh FK", async () => {
  const app = browser();
  const first = await app.manager.registerCurrentPush(app.initial);
  assert.equal(first.loginId, app.initial.loginId);
  assert.equal(first.receiptSecret.length, 43);
  assert.deepEqual(Object.keys(app.records.get("binding") as object).sort(), [
    "apiBaseUrl",
    "id",
    "loginId",
    "receiptSecret",
    "userId",
  ]);
  assert.ok(!JSON.stringify(app.records.get("binding")).includes("refresh-A"));
  assert.ok(!JSON.stringify(app.records.get("binding")).includes("access-A"));
  await app.coordinator.refreshSession(app.initial);
  const second = await app.manager.registerCurrentPush(app.current());
  assert.equal(second.id, first.id);
  assert.equal(second.receiptSecret, first.receiptSecret);
  assert.equal(app.deviceRequests[1].refreshToken, "rotated-refresh");
  assert.equal(
    app.deviceRequests[1].installationId,
    app.deviceRequests[0].installationId,
  );
  assert.match(
    app.deviceRequests[0].installationId as string,
    /^[0-9a-f-]{36}$/,
  );
  assert.ok(!("loginId" in app.deviceRequests[0]));
  assert.ok(!("sessionId" in app.deviceRequests[0]));
});

test("offline coordinator logout closes notifications and unbinds durably before UI clear", async () => {
  const app = browser();
  await app.manager.registerCurrentPush(app.initial);
  await app.coordinator.logoutCurrentSession(app.initial.loginId);
  assert.deepEqual(app.events, [
    "close-notification",
    "unregister-worker",
    "clear-session",
    "revoke-refresh",
  ]);
  assert.equal(await app.storage.readPushBinding(), null);
  assert.equal(app.records.get("resetTransport"), true);
  assert.equal(
    app.deleteTokenCalls(),
    0,
    "no unbounded Firebase fetch blocks local logout",
  );
});

test("new login resets Firebase transport under lock and cannot reuse A's capability", async () => {
  const app = browser();
  const first = await app.manager.registerCurrentPush(app.initial);
  await app.coordinator.logoutCurrentSession(app.initial.loginId);
  const next = await app.coordinator.replaceLoginSession(session("B"));
  app.register(async () => ({
    id: "binding-B",
    platform: "WEB",
    lastRegisteredAt: "now",
  }));
  const second = await app.manager.registerCurrentPush(next);
  assert.equal(second.id, "binding-B");
  assert.equal(second.userId, "B");
  assert.notEqual(first.receiptSecret, second.receiptSecret);
  assert.equal(app.deleteTokenCalls(), 1);
  assert.equal(app.records.get("resetTransport"), undefined);
  assert.ok(
    app.navigator.locks.names.every(
      (name) =>
        name === "telemedicine-auth" ||
        name === app.manager.PUSH_TRANSPORT_LOCK,
    ),
  );
});

test("queued A registration cannot run after B has taken the auth lock", async () => {
  const app = browser();
  const locked = deferred<void>();
  const release = deferred<void>();
  const change = app.navigator.locks.request("telemedicine-auth", async () => {
    locked.resolve();
    await release.promise;
    app.writeSession(session("B"));
  });
  await locked.promise;
  const stale = app.manager.registerCurrentPush(app.initial);
  release.resolve();
  await change;
  await assert.rejects(stale, /session changed/i);
  assert.equal(app.tokenCalls(), 0);
  assert.equal(app.deviceRequests.length, 0);
});

test("getToken completion must reread persisted auth before the device POST", async () => {
  const app = browser();
  const started = deferred<void>();
  const reply = deferred<string>();
  app.getToken(() => {
    started.resolve();
    return reply.promise;
  });
  const pending = app.manager.registerCurrentPush(app.initial);
  await started.promise;
  app.writeSession(session("B"));
  reply.resolve("fcm-token");
  await assert.rejects(pending, /session changed/i);
  assert.equal(app.deviceRequests.length, 0);
  assert.equal(await app.storage.readPushBinding(), null);
});

test("device POST completion must reread persisted auth before durable write", async () => {
  const app = browser();
  const started = deferred<void>();
  const reply = deferred<{
    id: string;
    platform: string;
    lastRegisteredAt: string;
  }>();
  app.register(() => {
    started.resolve();
    return reply.promise;
  });
  const pending = app.manager.registerCurrentPush(app.initial);
  await started.promise;
  app.writeSession(session("B"));
  reply.resolve({ id: "obsolete-A", platform: "WEB", lastRegisteredAt: "now" });
  await assert.rejects(pending, /session changed/i);
  assert.equal(await app.storage.readPushBinding(), null);
});

test("durable write completion rechecks auth and removes its obsolete capability", async () => {
  const app = browser();
  const write = app.storage.writePushBinding;
  Reflect.set(
    app.storage,
    "writePushBinding",
    async (...args: Parameters<typeof write>) => {
      await write(...args);
      app.writeSession(session("B"));
    },
  );
  await assert.rejects(
    app.manager.registerCurrentPush(app.initial),
    /session changed/i,
  );
  assert.equal(await app.storage.readPushBinding(), null);
  assert.deepEqual(app.events, ["close-notification"]);
});

test("stale logout and compare-delete cannot clear B's newer binding", async () => {
  const app = browser();
  await app.manager.registerCurrentPush(app.initial);
  const b = session("B");
  app.writeSession(b);
  const bindingB = {
    id: "binding-B",
    receiptSecret: "B".repeat(43),
    userId: "B",
    loginId: b.loginId,
    apiBaseUrl: "https://api.test/api/v1",
  };
  await app.storage.writePushBinding(bindingB, "token-B");
  assert.equal(await app.storage.clearPushBinding(app.initial.loginId), null);
  assert.equal(
    await app.coordinator.logoutCurrentSession(app.initial.loginId),
    false,
  );
  assert.equal((await app.storage.readPushBinding())?.id, "binding-B");
  assert.deepEqual(app.events, []);
});

test("logout does not publish local clear when durable invalidation fails", async () => {
  const app = browser();
  await app.manager.registerCurrentPush(app.initial);
  app.failWrites(true);
  await assert.rejects(
    app.coordinator.logoutCurrentSession(app.initial.loginId),
  );
  assert.equal(app.current().loginId, app.initial.loginId);
  assert.equal(app.events.includes("clear-session"), false);
  assert.equal((await app.storage.readPushBinding())?.id, "binding-A");
});

test("no permission or no Web Locks never registers or prompts automatically", async () => {
  const app = browser();
  app.permission("default");
  await assert.rejects(
    app.manager.registerCurrentPush(app.initial),
    /permission/,
  );
  app.permission("granted");
  Reflect.deleteProperty(app.navigator, "locks");
  await assert.rejects(
    app.manager.registerCurrentPush(app.initial),
    /permission/,
  );
  assert.equal(app.registrations(), 0);
  assert.equal(app.tokenCalls(), 0);
});

test("foreground resolve rechecks durable binding and suppresses duplicate tab toasts", async () => {
  const app = browser();
  const binding = await app.manager.registerCurrentPush(app.initial);
  let toasts = 0;
  await app.manager.listenForForegroundPush(() => {
    toasts++;
  });
  await app.manager.listenForForegroundPush(() => {
    toasts++;
  });
  await app.deliver({
    data: { bindingId: binding.id, deliveryId: "delivery-1" },
  });
  assert.equal(toasts, 1);
  const started = deferred<void>();
  const release = deferred<void>();
  app.resolveWith(async () => {
    started.resolve();
    await release.promise;
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: {
          title: "Generic update",
          body: "Open the app.",
          url: "/notifications",
          notificationId: "delivery-2",
        },
      }),
    };
  });
  const pending = app.deliver({
    data: { bindingId: binding.id, deliveryId: "delivery-2" },
  });
  await started.promise;
  await app.coordinator.logoutCurrentSession(app.initial.loginId);
  release.resolve();
  await pending;
  assert.equal(toasts, 1);
});

test("explicit local disable remains fail-closed despite stale enabled preferences", async () => {
  const app = browser();
  await app.manager.registerCurrentPush(app.initial);
  await app.manager.disableCurrentPush(app.initial);
  assert.equal(await app.storage.readPushBinding(), null);
  await assert.rejects(
    app.manager.registerCurrentPush(app.initial),
    /disabled/,
  );
  await app.manager.registerCurrentPush(app.initial, true);
  assert.equal((await app.storage.readPushBinding())?.id, "binding-A");
});

test("installation id is transactionally stable across concurrent tab initializations", async () => {
  const app = browser();
  const ids = await Promise.all(
    Array.from({ length: 6 }, () => app.storage.getInstallationId()),
  );
  assert.equal(new Set(ids).size, 1);
  assert.match(ids[0], /^[0-9a-f-]{36}$/);
  const secret = app.storage.createReceiptSecret();
  assert.equal(secret.length, 43);
  assert.match(secret, /^[A-Za-z0-9_-]+$/);
});

test("startup clears orphaned capabilities before hydration but preserves the current login", async () => {
  const app = browser();
  await app.manager.registerCurrentPush(app.initial);
  await app.manager.preparePushSession();
  assert.equal((await app.storage.readPushBinding())?.id, "binding-A");
  assert.deepEqual(app.events, []);
  app.writeSession(null); // Includes legacy localStorage rejected by auth validation.
  await app.manager.preparePushSession();
  assert.equal(await app.storage.readPushBinding(), null);
  assert.deepEqual(app.events, ["close-notification", "unregister-worker"]);
});

test("startup privacy failure is surfaced instead of silently publishing hydrated UI", async () => {
  const app = browser();
  await app.manager.registerCurrentPush(app.initial);
  app.writeSession(session("B"));
  app.failWrites(true);
  await assert.rejects(app.manager.preparePushSession());
  assert.equal((await app.storage.readPushBinding())?.id, "binding-A");
  Reflect.deleteProperty(app.navigator, "locks");
  const unsupported = await app.manager.preparePushSession();
  assert.equal(unsupported.supported, false);
  assert.match(unsupported.message!, /Web Locks/);
});

test(
  "offline logout completes while getToken is unresolved and rejects its late result",
  { timeout: 2_000 },
  async () => {
    const app = browser();
    const started = deferred<void>();
    const reply = deferred<string>();
    app.getToken(() => {
      started.resolve();
      return reply.promise;
    });
    const pending = app.manager.registerCurrentPush(app.initial);
    const rejected = assert.rejects(pending, /session changed/i);
    await started.promise;
    await app.coordinator.logoutCurrentSession(app.initial.loginId);
    assert.equal(app.current(), null);
    assert.equal(await app.storage.readPushBinding(), null);
    assert.equal(await app.storage.readPushAttempt(), null);
    assert.ok(app.events.includes("clear-session"));
    reply.resolve("late-A-token");
    await rejected;
    assert.equal(app.deviceRequests.length, 0);
    assert.equal(await app.storage.readPushBinding(), null);
  },
);

test(
  "pending deleteToken cannot block logout or run concurrently with a new account SDK",
  { timeout: 2_000 },
  async () => {
    const app = browser();
    await app.manager.registerCurrentPush(app.initial);
    await app.coordinator.logoutCurrentSession(app.initial.loginId);
    const b = await app.coordinator.replaceLoginSession(session("B"));
    const started = deferred<void>();
    const release = deferred<void>();
    app.deleteToken(() => {
      started.resolve();
      return release.promise;
    });
    const old = app.manager.registerCurrentPush(b);
    const rejected = assert.rejects(old, /session changed/i);
    await started.promise;
    await app.coordinator.logoutCurrentSession(b.loginId);
    const c = await app.coordinator.replaceLoginSession(session("C"));
    app.register(async () => ({
      id: "binding-C",
      platform: "WEB",
      lastRegisteredAt: "now",
    }));
    const next = app.manager.registerCurrentPush(c);
    await app.navigator.locks.request("telemedicine-auth", async () => {});
    assert.equal(
      app.tokenCalls(),
      1,
      "C must not touch SDK state while B's deleteToken is pending",
    );
    assert.equal(app.deleteTokenCalls(), 1);
    release.resolve();
    await rejected;
    const bindingC = await next;
    assert.equal(bindingC.id, "binding-C");
    assert.equal(bindingC.loginId, c.loginId);
    assert.equal(app.tokenCalls(), 2);
    assert.equal(
      app.deleteTokenCalls(),
      2,
      "C resets the old transport after the late B operation settles",
    );
    assert.equal((await app.storage.readPushBinding())?.id, "binding-C");
    assert.equal(
      app.deviceRequests.length,
      2,
      "only A and C commit, never stale B",
    );
  },
);

test(
  "disable and re-enable invalidate an earlier attempt within the same login",
  { timeout: 2_000 },
  async () => {
    const app = browser();
    const started = deferred<void>();
    const reply = deferred<string>();
    app.getToken(() => {
      started.resolve();
      return reply.promise;
    });
    const old = app.manager.registerCurrentPush(app.initial);
    const rejected = assert.rejects(old, /session changed/i);
    await started.promise;
    await app.manager.disableCurrentPush(app.initial);
    assert.equal(await app.storage.readPushAttempt(), null);
    const next = app.manager.registerCurrentPush(app.initial, true);
    await app.navigator.locks.request("telemedicine-auth", async () => {});
    assert.equal(app.tokenCalls(), 1);
    app.getToken(async () => "new-token");
    reply.resolve("old-token");
    await rejected;
    await next;
    assert.equal(app.deviceRequests.length, 1);
    assert.equal(app.deviceRequests[0].token, "new-token");
  },
);

test(
  "SDK caller timeout does not release serialization or allow a late binding commit",
  { timeout: 2_000 },
  async () => {
    const app = browser();
    const started = deferred<void>();
    const reply = deferred<string>();
    app.getToken(() => {
      started.resolve();
      return reply.promise;
    });
    const old = app.manager.registerCurrentPush(app.initial);
    const rejected = assert.rejects(old, /timed out/i);
    await started.promise;
    app.expireRequests();
    await rejected;
    await app.coordinator.logoutCurrentSession(app.initial.loginId);
    const b = await app.coordinator.replaceLoginSession(session("B"));
    const next = app.manager.registerCurrentPush(b);
    await app.navigator.locks.request("telemedicine-auth", async () => {});
    assert.equal(app.tokenCalls(), 1);
    app.getToken(async () => "new-B-token");
    reply.resolve("late-A-token");
    await next;
    assert.equal(app.deviceRequests.length, 1);
    assert.equal(app.deviceRequests[0].token, "new-B-token");
    assert.equal((await app.storage.readPushBinding())?.loginId, b.loginId);
  },
);

test(
  "refresh can rotate during SDK preparation and the commit uses the latest owned refresh",
  { timeout: 2_000 },
  async () => {
    const app = browser();
    const started = deferred<void>();
    const reply = deferred<string>();
    app.getToken(() => {
      started.resolve();
      return reply.promise;
    });
    const pending = app.manager.registerCurrentPush(app.initial);
    await started.promise;
    await app.coordinator.refreshSession(app.initial);
    reply.resolve("token");
    await pending;
    assert.equal(app.deviceRequests[0].refreshToken, "rotated-refresh");
    assert.equal(
      (await app.storage.readPushBinding())?.loginId,
      app.initial.loginId,
    );
  },
);

test(
  "another tab's startup preserves a current-login SDK attempt without holding auth",
  { timeout: 2_000 },
  async () => {
    const app = browser();
    const started = deferred<void>();
    const reply = deferred<string>();
    app.getToken(() => {
      started.resolve();
      return reply.promise;
    });
    const pending = app.manager.registerCurrentPush(app.initial);
    await started.promise;
    const attempt = await app.storage.readPushAttempt();
    await app.manager.preparePushSession();
    assert.equal((await app.storage.readPushAttempt())?.id, attempt?.id);
    assert.deepEqual(app.events, []);
    reply.resolve("token");
    await pending;
  },
);

test("permission lost during SDK preparation never reaches the SDK implicit prompt", async () => {
  const app = browser();
  const register = app.navigator.serviceWorker.register;
  Reflect.set(app.navigator.serviceWorker, "register", async () => {
    const registration = await register();
    app.permission("default");
    return registration;
  });
  await assert.rejects(
    app.manager.registerCurrentPush(app.initial),
    /permission/,
  );
  assert.equal(app.tokenCalls(), 0);
  assert.equal(app.deviceRequests.length, 0);
});

test("disable is atomic even when storage fails after suppression was written", async () => {
  for (let writes = 0; writes < 5; writes++) {
    const app = browser();
    await app.manager.registerCurrentPush(app.initial);
    const attempt = await app.storage.readPushAttempt();
    app.failWriteAfter(writes);
    await assert.rejects(app.manager.disableCurrentPush(app.initial));
    assert.equal((await app.storage.readPushBinding())?.id, "binding-A");
    assert.equal(
      app.records.get(`suppressed:${app.initial.loginId}`),
      undefined,
    );
    assert.equal((await app.storage.readPushAttempt())?.id, attempt?.id);
    assert.equal(app.events.includes("close-notification"), false);
  }
});

test("cleanup failure propagates after atomic disable and never claims confirmed off", async () => {
  const app = browser();
  await app.manager.registerCurrentPush(app.initial);
  Reflect.set(app.navigator.serviceWorker, "getRegistrations", async () => {
    throw new Error("Cannot close notifications");
  });
  await assert.rejects(
    app.manager.disableCurrentPush(app.initial),
    /Cannot close/,
  );
  assert.equal(await app.storage.readPushBinding(), null);
  assert.equal(app.records.get(`suppressed:${app.initial.loginId}`), true);
  assert.equal(
    pushDisableFailure(false).message,
    "Chưa thể xác nhận đã tắt thông báo. Vui lòng thử lại.",
  );
  assert.notEqual(
    pushDisableFailure(false).message,
    pushDisableFailure(true).message,
  );
});

test("foreground ignores a lingering suppressed capability before and after resolve", async () => {
  const app = browser();
  const binding = await app.manager.registerCurrentPush(app.initial);
  let toasts = 0;
  let resolves = 0;
  await app.manager.listenForForegroundPush(() => {
    toasts++;
  });
  app.records.set(`suppressed:${app.initial.loginId}`, true);
  app.resolveWith(async () => {
    resolves++;
    throw new Error("Should not resolve");
  });
  await app.deliver({
    data: { bindingId: binding.id, deliveryId: "suppressed-1" },
  });
  assert.equal(resolves, 0);
  assert.equal(toasts, 0);
  app.records.delete(`suppressed:${app.initial.loginId}`);
  const started = deferred<void>();
  const release = deferred<void>();
  app.resolveWith(async () => {
    started.resolve();
    await release.promise;
    return {
      ok: true,
      json: async () => ({
        success: true,
        data: {
          title: "Generic update",
          body: "Open app",
          url: "/notifications",
          notificationId: "suppressed-2",
        },
      }),
    };
  });
  const pending = app.deliver({
    data: { bindingId: binding.id, deliveryId: "suppressed-2" },
  });
  await started.promise;
  app.records.set(`suppressed:${app.initial.loginId}`, true);
  release.resolve();
  await pending;
  assert.equal(toasts, 0);
});

test("explicit re-enable revokes the old capability before SDK work and stays suppressed on failure", async () => {
  const app = browser();
  const old = await app.manager.registerCurrentPush(app.initial);
  const started = deferred<void>();
  const reply = deferred<string>();
  app.getToken(() => {
    started.resolve();
    return reply.promise;
  });
  const pending = app.manager.registerCurrentPush(app.initial, true);
  const rejected = assert.rejects(pending, /No push token/);
  await started.promise;
  assert.equal(await app.storage.readPushBinding(), null);
  assert.equal(app.records.get(`suppressed:${app.initial.loginId}`), true);
  reply.resolve("");
  await rejected;
  assert.equal(await app.storage.readPushBinding(), null);
  assert.equal(app.records.get(`suppressed:${app.initial.loginId}`), true);
  app.getToken(async () => "fresh-token");
  const fresh = await app.manager.registerCurrentPush(app.initial, true);
  assert.notEqual(fresh.receiptSecret, old.receiptSecret);
  assert.equal(app.records.get(`suppressed:${app.initial.loginId}`), undefined);
});

test("intentional suppression is idle while real restore failures are errors", async () => {
  const app = browser();
  await app.manager.disableCurrentPush(app.initial);
  let failure: unknown;
  try {
    await app.manager.registerCurrentPush(app.initial);
  } catch (error) {
    failure = error;
  }
  assert.ok(failure instanceof PushSuppressedError);
  assert.deepEqual(pushRestoreFailure(failure), {
    status: "idle",
    message: null,
  });
  assert.equal(pushRestoreFailure(new Error("Network")).status, "error");
});
