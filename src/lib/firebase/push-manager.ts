"use client";

import { API_BASE_URL } from "@/lib/api/client";
import {
  registerPushDevice,
  removePushDevice,
  type ResolvedPush,
} from "@/lib/api/notifications";
import {
  readStoredSession,
  registerSessionCleanup,
  withSessionLock,
} from "@/lib/auth/session-coordinator";
import type { StoredSession } from "@/lib/auth/session-core";

import { getFirebaseApp, isFirebaseConfigured } from "./client";
import { parsePushReceipt, resolvePushReceipt } from "./push-receipt";
import { PushSuppressedError } from "./push-state";
import {
  claimPushDelivery,
  clearPushBinding,
  createReceiptSecret,
  getInstallationId,
  invalidatePushAttempt,
  readPushAttempt,
  readPushBinding,
  readPushFlag,
  sameBinding,
  startPushAttempt,
  writePushBinding,
  writePushFlag,
  type PushBinding,
} from "./push-storage";

const WORKER_PATH = "/firebase-messaging-sw.js";
const WORKER_SCOPE = "/firebase-cloud-messaging-push-scope";
export const PUSH_TRANSPORT_LOCK = "telemedicine-push-transport";
export const PUSH_REGISTRATION_TIMEOUT_MS = 20_000;

function currentSession(expected: StoredSession) {
  const current = readStoredSession();
  return (
    current?.loginId === expected.loginId &&
    current.user.id === expected.user.id &&
    current.user.status === "ACTIVE" &&
    current.version === expected.version &&
    current.accessToken === expected.accessToken &&
    current.refreshToken === expected.refreshToken
  );
}

function assertCurrent(expected: StoredSession) {
  if (!currentSession(expected)) throw new Error("Push session changed.");
}

async function checked<T>(
  expected: StoredSession,
  operation: () => Promise<T>,
) {
  assertCurrent(expected);
  const value = await operation();
  assertCurrent(expected);
  return value;
}

export function hasPushPrerequisites() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "locks" in navigator &&
    "indexedDB" in window &&
    isFirebaseConfigured() &&
    Boolean(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) &&
    Boolean(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY)
  );
}

async function messagingRuntime() {
  const sdk = await import("firebase/messaging");
  if (!(await sdk.isSupported())) throw new Error("Push is not supported.");
  return { sdk, messaging: sdk.getMessaging(getFirebaseApp()) };
}

async function workerRegistrations() {
  if (!("serviceWorker" in navigator)) return [];
  return (await navigator.serviceWorker.getRegistrations()).filter(
    (registration) =>
      [registration.active, registration.waiting, registration.installing].some(
        (worker) =>
          worker && new URL(worker.scriptURL).pathname === WORKER_PATH,
      ),
  );
}

async function closePushNotifications(bindingId?: string) {
  for (const registration of await workerRegistrations()) {
    for (const notification of await registration.getNotifications()) {
      // Legacy SDK notifications have no capability tag and must be closed too.
      if (
        !bindingId ||
        !notification.data?.bindingId ||
        notification.data.bindingId === bindingId
      ) {
        notification.close();
      }
    }
  }
}

async function deleteTransportLocked() {
  try {
    const { sdk, messaging } = await messagingRuntime();
    await sdk.deleteToken(messaging);
  } catch {
    /* The capability was already removed; network failure cannot expose it. */
  }
}

async function unregisterWorkersLocked() {
  for (const registration of await workerRegistrations())
    await registration.unregister();
}

// Coordinator invokes this BEFORE publishing local logout, already holding its
// lock. Never invoke withSessionLock or an auto-refreshing API from this hook.
export async function cleanupPushSessionLocked(suppress = false) {
  const session = readStoredSession();
  if (!session || typeof indexedDB === "undefined") return;
  const binding = await readPushBinding();
  if (binding && binding.loginId !== session.loginId) return;
  if (!suppress) await invalidatePushAttempt(session.loginId);
  const cleared = await clearPushBinding(session.loginId, suppress);
  await closePushNotifications(cleared?.binding.id);
  if (currentSession(session)) await unregisterWorkersLocked();
  if (cleared?.token && currentSession(session) && navigator.onLine) {
    try {
      await removePushDevice(
        { token: cleared.token, refreshToken: session.refreshToken },
        session,
      );
    } catch {
      /* Local privacy is independent of backend availability. */
    }
  }
  // SDK teardown is deferred to the transport lock; auth never waits for it.
}

let cleanupInstalled = false;
export function installPushSessionCleanup() {
  if (cleanupInstalled) return;
  cleanupInstalled = true;
  registerSessionCleanup(cleanupPushSessionLocked);
}

// Await before auth synchronization publishes hydrated UI. A legacy/invalid
// localStorage session cannot vouch for a capability left in IndexedDB.
export async function preparePushSession() {
  installPushSessionCleanup();
  if (typeof navigator === "undefined" || !navigator.locks) {
    // The worker and registration path both reject unlocked delivery. Do not
    // block ordinary auth hydration in a browser that cannot support push.
    return {
      supported: false,
      message: "Secure notifications require browser Web Locks and HTTPS.",
    };
  }
  await withSessionLock(async () => {
    const session = readStoredSession();
    const binding =
      typeof indexedDB === "undefined" ? null : await readPushBinding();
    const attempt =
      typeof indexedDB === "undefined" ? null : await readPushAttempt();
    if (
      binding &&
      session?.user.status === "ACTIVE" &&
      binding.loginId === session.loginId &&
      binding.userId === session.user.id
    )
      return;
    if (
      !binding &&
      session?.user.status === "ACTIVE" &&
      attempt?.loginId === session.loginId
    )
      return;
    if (attempt) await invalidatePushAttempt(attempt.loginId);
    if (binding) await clearPushBinding(binding.loginId);
    await closePushNotifications(binding?.id);
    await unregisterWorkersLocked();
  });
  return { supported: true, message: null };
}

export async function disableCurrentPush(expected: StoredSession) {
  return withSessionLock(async () => {
    assertCurrent(expected);
    await cleanupPushSessionLocked(true);
    assertCurrent(expected);
  });
}

export async function registerCurrentPush(
  expected: StoredSession,
  explicit = false,
) {
  if (!hasPushPrerequisites() || Notification.permission !== "granted") {
    throw new Error("Push permission is not granted.");
  }
  const attempt = await withSessionLock(async () => {
    assertCurrent(expected);
    if (
      !explicit &&
      (await checked(expected, () =>
        readPushFlag(`suppressed:${expected.loginId}`),
      ))
    ) {
      throw new PushSuppressedError();
    }
    let binding = await checked(expected, readPushBinding);
    if (
      binding &&
      (binding.loginId !== expected.loginId ||
        binding.userId !== expected.user.id)
    ) {
      const orphan = binding;
      await checked(expected, () => clearPushBinding(orphan.loginId));
      await checked(expected, () => closePushNotifications(orphan.id));
      await checked(expected, unregisterWorkersLocked);
      binding = null;
    }
    // Keep suppression set until a fresh capability is committed atomically.
    if (explicit) await checked(expected, () => cleanupPushSessionLocked(true));
    return checked(expected, () => startPushAttempt(expected.loginId));
  });

  let cancelled = false;
  const assertAttempt = async () => {
    const before = readStoredSession();
    if (cancelled || !samePushLogin(before, expected))
      throw new Error("Push session changed.");
    const owner = await readPushAttempt();
    if (
      cancelled ||
      !samePushLogin(readStoredSession(), expected) ||
      owner?.id !== attempt.id ||
      owner.loginId !== attempt.loginId
    ) {
      throw new Error("Push session changed.");
    }
  };
  const transportChecked = async <T>(operation: () => Promise<T>) => {
    await assertAttempt();
    const value = await operation();
    await assertAttempt();
    return value;
  };

  // Never release this lock while an SDK call is unresolved: late deleteToken
  // must not unsubscribe a newer account's transport. It never holds auth.
  const operation = navigator.locks.request(PUSH_TRANSPORT_LOCK, async () => {
    const { sdk, messaging } = await transportChecked(messagingRuntime);
    if (await transportChecked(() => readPushFlag("resetTransport"))) {
      await transportChecked(deleteTransportLocked);
    }
    const registration = await transportChecked(() =>
      navigator.serviceWorker.register(WORKER_PATH, {
        scope: WORKER_SCOPE,
        updateViaCache: "none",
      }),
    );
    const token = await transportChecked(() => {
      // No await may separate this check from the SDK's implicit prompt path.
      if (Notification.permission !== "granted")
        throw new Error("Push permission is not granted.");
      return sdk.getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration,
      });
    });
    if (!token) throw new Error("No push token was issued.");

    return withSessionLock(async () => {
      await assertAttempt();
      const current = readStoredSession()!;
      if (
        !explicit &&
        (await checked(current, () =>
          readPushFlag(`suppressed:${current.loginId}`),
        ))
      ) {
        throw new PushSuppressedError();
      }
      const installationId = await checked(current, getInstallationId);
      const binding = await checked(current, readPushBinding);
      const receiptSecret =
        binding?.loginId === current.loginId
          ? binding.receiptSecret
          : createReceiptSecret();
      const result = await checked(current, () =>
        registerPushDevice(
          {
            token,
            platform: "WEB",
            refreshToken: current.refreshToken,
            installationId,
            receiptSecret,
          },
          current,
        ),
      );
      await assertAttempt();
      if (!result?.id || result.platform !== "WEB")
        throw new Error("Invalid push binding response.");
      const next: PushBinding = {
        id: result.id,
        receiptSecret,
        userId: current.user.id,
        loginId: current.loginId,
        apiBaseUrl: API_BASE_URL,
      };
      if (binding && binding.id !== next.id) {
        await checked(current, () => closePushNotifications(binding.id));
      }
      try {
        await checked(current, () => writePushFlag("resetTransport", false));
        await assertAttempt();
        await checked(current, () => writePushBinding(next, token, explicit));
        await assertAttempt();
      } catch (error) {
        const persisted = await readPushBinding();
        if (sameBinding(persisted, next)) {
          await clearPushBinding(next.loginId);
          await closePushNotifications(next.id);
        }
        throw error;
      }
      return next;
    });
  });

  // Bound the caller's UI wait without releasing the SDK lock. A timed-out task
  // remains serialized and cannot commit, even if its SDK promise later resolves.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      cancelled = true;
      reject(new Error("Push registration timed out."));
    }, PUSH_REGISTRATION_TIMEOUT_MS);
  });
  try {
    return await Promise.race([operation, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

function samePushLogin(current: StoredSession | null, expected: StoredSession) {
  return (
    current?.loginId === expected.loginId &&
    current.user.id === expected.user.id &&
    current.user.status === "ACTIVE"
  );
}

export async function isCurrentPushEnabled(expected: StoredSession) {
  if (
    !hasPushPrerequisites() ||
    Notification.permission !== "granted" ||
    !currentSession(expected)
  )
    return false;
  const binding = await readPushBinding();
  const suppressed = await readPushFlag(`suppressed:${expected.loginId}`);
  return (
    currentSession(expected) &&
    binding?.loginId === expected.loginId &&
    binding.userId === expected.user.id &&
    !suppressed
  );
}

export async function listenForForegroundPush(
  onNotification: (notification: ResolvedPush) => void,
) {
  if (!hasPushPrerequisites()) return () => {};
  const { sdk, messaging } = await messagingRuntime();
  return sdk.onMessage(messaging, async (payload) => {
    try {
      if (document.visibilityState !== "visible") return;
      const receipt = parsePushReceipt(payload);
      const session = readStoredSession();
      if (!receipt || !session || !currentSession(session)) return;
      const binding = await readPushBinding();
      if (
        !binding ||
        binding.id !== receipt.bindingId ||
        binding.loginId !== session.loginId ||
        binding.userId !== session.user.id ||
        !currentSession(session) ||
        (await readPushFlag(`suppressed:${session.loginId}`))
      )
        return;
      const notification = await resolvePushReceipt(binding, receipt);
      if (!notification) return;
      await withSessionLock(async () => {
        if (
          !currentSession(session) ||
          !sameBinding(binding, await readPushBinding()) ||
          (await readPushFlag(`suppressed:${session.loginId}`))
        )
          return;
        if (!(await claimPushDelivery(binding.id, receipt.deliveryId))) return;
        assertCurrent(session);
        onNotification(notification);
      });
    } catch {
      /* Never render transport data or authorization failures. */
    }
  });
}
