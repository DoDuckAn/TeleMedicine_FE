import {
  PUSH_BINDING_KEY,
  PUSH_DB_NAME,
  PUSH_DB_VERSION,
  PUSH_STORE,
} from "./push-storage";

type WorkerFirebaseConfig = {
  apiKey?: string;
  appId?: string;
  authDomain?: string;
  messagingSenderId?: string;
  projectId?: string;
  storageBucket?: string;
};

export function createMessagingWorker(
  config: WorkerFirebaseConfig,
  sdkVersion: string,
) {
  return `"use strict";
const DB_NAME = ${JSON.stringify(PUSH_DB_NAME)};
const DB_VERSION = ${PUSH_DB_VERSION};
const STORE = ${JSON.stringify(PUSH_STORE)};
const BINDING_KEY = ${JSON.stringify(PUSH_BINDING_KEY)};

function receipt(payload) {
  if (!payload || typeof payload !== 'object' || 'notification' in payload ||
      'title' in payload || 'body' in payload ||
      (payload.webpush && 'notification' in payload.webpush)) return null;
  const data = payload.data;
  if (!data || typeof data !== 'object' ||
      Object.keys(data).some(key => key !== 'bindingId' && key !== 'deliveryId') ||
      typeof data.bindingId !== 'string' || !data.bindingId ||
      typeof data.deliveryId !== 'string' || !data.deliveryId ||
      data.bindingId.length > 256 || data.deliveryId.length > 256) return null;
  return data;
}

// This MUST precede Firebase's push listener: the SDK otherwise auto-displays
// notification payloads before the application can authorize them.
self.addEventListener('push', event => {
  try { if (receipt(event.data && event.data.json())) return; } catch (_) {}
  event.stopImmediatePropagation();
});

function state(mode, operation) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Push storage blocked'));
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(STORE, mode);
      let value;
      tx.oncomplete = () => { db.close(); resolve(value); };
      tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
      try { operation(tx.objectStore(STORE), next => { value = next; }); }
      catch (error) { tx.abort(); reject(error); }
    };
  });
}

function readBinding() {
  return state('readonly', (store, result) => {
    const request = store.get(BINDING_KEY);
    request.onsuccess = () => {
      const b = request.result;
      if (!b || !['id', 'userId', 'loginId', 'apiBaseUrl'].every(k =>
          typeof b[k] === 'string' && b[k]) ||
          typeof b.receiptSecret !== 'string' || b.receiptSecret.length < 43 || b.receiptSecret.length > 128) {
        result(null); return;
      }
      try {
        const url = new URL(b.apiBaseUrl);
        if (url.username || url.password || url.search || url.hash ||
            !(url.protocol === 'https:' || (url.protocol === 'http:' &&
              ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
          result(null); return;
        }
      } catch (_) { result(null); return; }
      const suppressed = store.get('suppressed:' + b.loginId);
      suppressed.onsuccess = () => result(suppressed.result === true ? null : b);
    };
  });
}

function sameBinding(a, b) {
  return a && b && ['id', 'userId', 'loginId', 'receiptSecret', 'apiBaseUrl']
    .every(k => a[k] === b[k]);
}

function claimDelivery(bindingId, deliveryId) {
  return state('readwrite', (store, result) => {
    const request = store.get('deliveries');
    request.onsuccess = () => {
      const key = bindingId + ':' + deliveryId;
      const recent = Array.isArray(request.result) ? request.result : [];
      if (recent.includes(key)) { result(false); return; }
      store.put([...recent.slice(-99), key], 'deliveries');
      result(true);
    };
  });
}

function locked(callback) {
  // No unlocked fallback: logout and display must be mutually exclusive.
  if (!self.navigator.locks) return Promise.resolve();
  return self.navigator.locks.request('telemedicine-auth', callback);
}

self.addEventListener('notificationclick', event => {
  event.stopImmediatePropagation();
  event.notification.close();
  event.waitUntil((async () => {
    const binding = await locked(async () => {
      const current = await readBinding();
      return current && event.notification.data?.bindingId === current.id ? current : null;
    });
    if (!binding) return;
    const target = new URL('/notifications', self.location.origin).href;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (!sameBinding(binding, await readBinding())) return;
    const client = windows.find(item => item.url === target);
    if (client) await client.focus();
    else await self.clients.openWindow(target);
  })().catch(() => {}));
});

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
// Activation must never wait on either coordination lock.
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

importScripts(
  'https://www.gstatic.com/firebasejs/${sdkVersion}/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/${sdkVersion}/firebase-messaging-compat.js'
);
firebase.initializeApp(${JSON.stringify(config).replace(/</g, "\\u003c")});
firebase.messaging().onBackgroundMessage(async payload => {
  try {
    const data = receipt(payload);
    if (!data) return;
    const binding = await readBinding();
    if (!binding || binding.id !== data.bindingId) return;
    const response = await fetch(binding.apiBaseUrl.replace(/\\/$/, '') + '/notifications/push/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, receiptSecret: binding.receiptSecret }),
      credentials: 'omit', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return;
    const envelope = await response.json();
    const resolved = envelope?.success === true ? envelope.data : envelope;
    if (!resolved || typeof resolved.title !== 'string' || !resolved.title ||
        typeof resolved.body !== 'string' || resolved.url !== '/notifications' ||
        typeof resolved.notificationId !== 'string' || !resolved.notificationId) return;
    await locked(async () => {
      if (!sameBinding(binding, await readBinding())) return;
      if (!await claimDelivery(binding.id, data.deliveryId)) return;
      await self.registration.showNotification(resolved.title, {
        body: resolved.body,
        tag: 'telemedicine:' + binding.id + ':' + data.deliveryId,
        data: { bindingId: binding.id, deliveryId: data.deliveryId }
      });
    });
  } catch (_) { /* Storage, network and authorization failures display nothing. */ }
});
`;
}
