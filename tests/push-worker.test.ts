import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import { createMessagingWorker } from "../src/lib/firebase/worker-source";
import type { PushBinding } from "../src/lib/firebase/push-storage";
import { GET } from "../src/app/firebase-messaging-sw.js/route";
import { deferred, indexedDatabase, lockManager } from "./push-test-helpers";

const binding: PushBinding = {
  id: "binding-A",
  userId: "user-A",
  loginId: "login-A",
  receiptSecret: "A".repeat(43),
  apiBaseUrl: "https://api.example.test/api/v1",
};
const data = { bindingId: binding.id, deliveryId: "delivery-1" };
const resolved = {
  title: "Generic update",
  body: "Open the app.",
  url: "/notifications",
  notificationId: "delivery-1",
};

function worker(options: { noLocks?: boolean } = {}) {
  const database = indexedDatabase();
  database.records.set("binding", { ...binding });
  const locks = lockManager();
  const listeners = new Map<string, ((event: never) => void)[]>();
  const shown: { title: string; options: NotificationOptions }[] = [];
  const requests: { url: string; init: RequestInit }[] = [];
  const opened: string[] = [];
  let background!: (payload: unknown) => Promise<void>;
  let resolveResponse = async () => ({
    ok: true,
    json: async () => ({ success: true, data: resolved }),
  });
  const addEventListener = (type: string, callback: (event: never) => void) => {
    listeners.set(type, [...(listeners.get(type) ?? []), callback]);
  };
  const registration = {
    getNotifications: async () => [],
    showNotification: async (title: string, options: NotificationOptions) => {
      shown.push({ title, options });
    },
  };
  const clients = {
    matchAll: async (): Promise<
      { url: string; focus: () => Promise<void> }[]
    > => [],
    openWindow: async (url: string) => {
      opened.push(url);
    },
    claim: async () => {},
  };
  vm.runInNewContext(
    createMessagingWorker({ projectId: "test-project" }, "12.18.0"),
    {
      self: {
        addEventListener,
        registration,
        navigator: { locks: options.noLocks ? undefined : locks },
        location: { origin: "https://app.example.test" },
        clients,
        skipWaiting: async () => {},
      },
      indexedDB: database.indexedDB,
      URL,
      AbortSignal,
      fetch: async (url: string, init: RequestInit) => {
        requests.push({ url, init });
        return resolveResponse();
      },
      firebase: {
        initializeApp() {},
        messaging: () => ({
          onBackgroundMessage: (callback: typeof background) => {
            background = callback;
          },
        }),
      },
      importScripts: (...urls: string[]) => {
        assert.equal(
          listeners.get("push")?.length,
          1,
          "raw push guard precedes SDK import",
        );
        assert.equal(
          listeners.get("notificationclick")?.length,
          1,
          "click guard precedes SDK import",
        );
        assert.ok(urls.every((url) => url.includes("/12.18.0/")));
        addEventListener("push", ((event: {
          data: { json: () => unknown };
          waitUntil: (p: Promise<void>) => void;
        }) => {
          const payload = event.data.json() as {
            notification?: { title: string };
          };
          if (payload.notification)
            shown.push({ title: payload.notification.title, options: {} });
          else event.waitUntil(background(payload));
        }) as never);
      },
    },
  );
  return {
    ...database,
    locks,
    shown,
    requests,
    opened,
    clients,
    background,
    resolveWith: (fn: typeof resolveResponse) => {
      resolveResponse = fn;
    },
    async activate() {
      const pending: Promise<void>[] = [];
      for (const listener of listeners.get("activate") ?? [])
        listener({
          waitUntil: (promise: Promise<void>) => {
            pending.push(promise);
          },
        } as never);
      await Promise.all(pending);
    },
    async push(payload: unknown) {
      let stopped = false;
      const pending: Promise<void>[] = [];
      const event = {
        data: { json: () => payload },
        stopImmediatePropagation: () => {
          stopped = true;
        },
        waitUntil: (promise: Promise<void>) => {
          pending.push(promise);
        },
      };
      for (const listener of listeners.get("push") ?? []) {
        listener(event as never);
        if (stopped) break;
      }
      await Promise.all(pending);
      return stopped;
    },
    async click(notification: object) {
      const pending: Promise<void>[] = [];
      for (const listener of listeners.get("notificationclick") ?? [])
        listener({
          notification,
          stopImmediatePropagation() {},
          waitUntil: (promise: Promise<void>) => {
            pending.push(promise);
          },
        } as never);
      await Promise.all(pending);
    },
  };
}

test("raw guard blocks legacy notification auto-display, malformed and PII payloads", async () => {
  const sw = worker();
  for (const payload of [
    null,
    {},
    { data: {} },
    { data: { bindingId: "binding-A" } },
    { data, notification: { title: "Old private title" } },
    { data, notification: {} },
    { data, title: "Private title" },
    { data, webpush: { notification: { body: "Private body" } } },
    { data: { ...data, body: "Private body" } },
  ])
    assert.equal(await sw.push(payload), true);
  assert.equal(sw.requests.length, 0);
  assert.equal(sw.shown.length, 0);
});

test("only known data-only bindings resolve, without bearer/cookies or transport text", async () => {
  const sw = worker();
  await sw.push({ data: { ...data, bindingId: "unknown" } });
  assert.equal(sw.requests.length, 0);
  await sw.push({ data });
  assert.equal(sw.shown.length, 1);
  assert.equal(sw.shown[0].title, resolved.title);
  const request = sw.requests[0];
  assert.equal(request.url, `${binding.apiBaseUrl}/notifications/push/resolve`);
  assert.deepEqual(JSON.parse(request.init.body as string), {
    ...data,
    receiptSecret: binding.receiptSecret,
  });
  assert.deepEqual(Object.keys(request.init.headers!), ["Content-Type"]);
  assert.equal(request.init.credentials, "omit");
  assert.equal(request.init.redirect, "error");
  assert.equal(request.init.cache, "no-store");
  assert.equal(sw.locks.names[0], "telemedicine-auth");
});

test("offline logout during pending resolve prevents display, including after worker restart", async () => {
  const sw = worker();
  const started = deferred<void>();
  const reply = deferred<{
    ok: boolean;
    json: () => Promise<{ success: boolean; data: typeof resolved }>;
  }>();
  sw.resolveWith(() => {
    started.resolve();
    return reply.promise;
  });
  const pending = sw.push({ data });
  await started.promise;
  await sw.locks.request("telemedicine-auth", async () => {
    sw.records.delete("binding");
  });
  reply.resolve({
    ok: true,
    json: async () => ({ success: true, data: resolved }),
  });
  await pending;
  assert.equal(sw.shown.length, 0);
  await sw.push({ data });
  assert.equal(sw.requests.length, 1);
  const restarted = worker();
  restarted.records.delete("binding");
  await restarted.push({ data });
  assert.equal(restarted.requests.length, 0);
});

test("account B and same-id capability changes invalidate A's in-flight resolve", async () => {
  for (const next of [
    { ...binding, id: "binding-B", loginId: "login-B", userId: "user-B" },
    { ...binding, receiptSecret: "B".repeat(43) },
    { ...binding, loginId: "new-login-A" },
  ]) {
    const sw = worker();
    const started = deferred<void>();
    const release = deferred<void>();
    sw.resolveWith(async () => {
      started.resolve();
      await release.promise;
      return {
        ok: true,
        json: async () => ({ success: true, data: resolved }),
      };
    });
    const pending = sw.push({ data });
    await started.promise;
    sw.records.set("binding", next);
    release.resolve();
    await pending;
    assert.equal(sw.shown.length, 0);
  }
});

test("a reply waiting on JSON parsing is reauthorized after parsing", async () => {
  const sw = worker();
  const parsing = deferred<void>();
  const release = deferred<void>();
  sw.resolveWith(async () => ({
    ok: true,
    json: async () => {
      parsing.resolve();
      await release.promise;
      return { success: true, data: resolved };
    },
  }));
  const pending = sw.push({ data });
  await parsing.promise;
  sw.records.delete("binding");
  release.resolve();
  await pending;
  assert.equal(sw.shown.length, 0);
});

test("network failures, bad capabilities, invalid replies and absent locks fail closed", async () => {
  const sw = worker();
  sw.resolveWith(async () => {
    throw new Error("Offline");
  });
  await sw.push({ data });
  sw.resolveWith(async () => ({
    ok: false,
    json: async () => ({ success: true, data: resolved }),
  }));
  await sw.push({ data });
  sw.resolveWith(async () => ({
    ok: true,
    json: async () => ({
      success: true,
      data: { ...resolved, url: "https://evil.test" },
    }),
  }));
  await sw.push({ data });
  assert.equal(sw.shown.length, 0);
  sw.records.set("binding", {
    ...binding,
    apiBaseUrl: "https://user:password@evil.test",
  });
  const count = sw.requests.length;
  await sw.push({ data });
  assert.equal(sw.requests.length, count);
  const noLocks = worker({ noLocks: true });
  await noLocks.push({ data });
  assert.equal(noLocks.shown.length, 0);
});

test("durable delivery claims suppress duplicate workers/tabs", async () => {
  const sw = worker();
  await Promise.all([sw.push({ data }), sw.push({ data }), sw.push({ data })]);
  assert.equal(sw.shown.length, 1);
  assert.equal((sw.records.get("deliveries") as string[]).length, 1);
});

test("notification clicks ignore supplied links and unknown account bindings", async () => {
  const sw = worker();
  let closed = 0;
  await sw.click({
    close: () => {
      closed++;
    },
    data: { bindingId: "binding-old", url: "https://evil.test" },
  });
  assert.deepEqual(sw.opened, []);
  await sw.click({
    close: () => {
      closed++;
    },
    data: { bindingId: binding.id, url: "https://evil.test" },
  });
  assert.deepEqual(sw.opened, ["https://app.example.test/notifications"]);
  assert.equal(closed, 2);
});

test("dynamic route serves pinned SDK worker with script, scope and no-cache headers", async () => {
  const response = GET();
  assert.match(
    response.headers.get("content-type")!,
    /application\/javascript/,
  );
  assert.match(response.headers.get("cache-control")!, /no-store/);
  assert.equal(response.headers.get("service-worker-allowed"), "/");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(await response.text(), /firebase-messaging-compat\.js/);
});

test("worker activation never waits on the auth lock held by getToken", async () => {
  const sw = worker();
  await sw.locks.request("telemedicine-auth", () => sw.activate());
  assert.deepEqual(sw.locks.names, ["telemedicine-auth"]);
});

test("worker ignores a suppressed capability left by an older partial cleanup", async () => {
  const sw = worker();
  sw.records.set(`suppressed:${binding.loginId}`, true);
  await sw.push({ data });
  assert.equal(sw.requests.length, 0);
  assert.equal(sw.shown.length, 0);
  await sw.click({ close() {}, data: { bindingId: binding.id } });
  assert.deepEqual(sw.opened, []);
});

test("worker rechecks durable suppression after a pending resolve", async () => {
  const sw = worker();
  const started = deferred<void>();
  const release = deferred<void>();
  sw.resolveWith(async () => {
    started.resolve();
    await release.promise;
    return { ok: true, json: async () => ({ success: true, data: resolved }) };
  });
  const pending = sw.push({ data });
  await started.promise;
  sw.records.set(`suppressed:${binding.loginId}`, true);
  release.resolve();
  await pending;
  assert.equal(sw.shown.length, 0);
});

test(
  "pending window lookup, focus or navigation never holds the auth lock",
  { timeout: 2_000 },
  async () => {
    for (const stage of ["lookup", "focus", "open"]) {
      const sw = worker();
      const started = deferred<void>();
      const release = deferred<void>();
      const wait = async () => {
        started.resolve();
        await release.promise;
      };
      if (stage === "lookup")
        sw.clients.matchAll = async () => {
          await wait();
          return [];
        };
      if (stage === "focus")
        sw.clients.matchAll = async () => [
          { url: "https://app.example.test/notifications", focus: wait },
        ];
      if (stage === "open")
        sw.clients.openWindow = async () => {
          await wait();
        };
      const pending = sw.click({ close() {}, data: { bindingId: binding.id } });
      await started.promise;
      await sw.locks.request("telemedicine-auth", async () => {
        sw.records.delete("binding");
      });
      release.resolve();
      await pending;
      assert.deepEqual(sw.opened, []);
    }
  },
);

test("click rechecks binding and suppression after window lookup before focus/navigation", async () => {
  for (const change of ["account", "suppression"]) {
    const sw = worker();
    const started = deferred<void>();
    const release = deferred<void>();
    let focused = false;
    sw.clients.matchAll = async () => {
      started.resolve();
      await release.promise;
      return [
        {
          url: "https://app.example.test/notifications",
          focus: async () => {
            focused = true;
          },
        },
      ];
    };
    const pending = sw.click({ close() {}, data: { bindingId: binding.id } });
    await started.promise;
    if (change === "account")
      sw.records.set("binding", {
        ...binding,
        id: "binding-B",
        loginId: "login-B",
      });
    else sw.records.set(`suppressed:${binding.loginId}`, true);
    release.resolve();
    await pending;
    assert.equal(focused, false);
    assert.deepEqual(sw.opened, []);
  }
});
