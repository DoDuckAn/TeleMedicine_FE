export const PUSH_DB_NAME = "telemedicine-push";
export const PUSH_DB_VERSION = 1;
export const PUSH_STORE = "state";
export const PUSH_BINDING_KEY = "binding";

export type PushBinding = {
  id: string;
  receiptSecret: string;
  userId: string;
  loginId: string;
  apiBaseUrl: string;
};

export type PushAttempt = { id: string; loginId: string };

export function readPushAttempt(): Promise<PushAttempt | null> {
  return transaction("readonly", (store, result) => {
    const request = store.get("attempt");
    request.onsuccess = () => result(request.result ?? null);
  });
}

export function startPushAttempt(loginId: string): Promise<PushAttempt> {
  return transaction("readwrite", (store, result) => {
    const attempt = { id: crypto.randomUUID(), loginId };
    store.put(attempt, "attempt");
    result(attempt);
  });
}

export function invalidatePushAttempt(loginId: string): Promise<void> {
  return transaction("readwrite", (store, result) => {
    const request = store.get("attempt");
    request.onsuccess = () => {
      if (request.result && request.result.loginId !== loginId) {
        result(undefined);
        return;
      }
      store.delete("attempt");
      store.put(true, "resetTransport");
      result(undefined);
    };
  });
}

export function sameBinding(a: PushBinding | null, b: PushBinding | null) {
  return Boolean(
    a &&
    b &&
    a.id === b.id &&
    a.loginId === b.loginId &&
    a.userId === b.userId &&
    a.receiptSecret === b.receiptSecret &&
    a.apiBaseUrl === b.apiBaseUrl,
  );
}

export function validBinding(value: unknown): value is PushBinding {
  if (!value || typeof value !== "object") return false;
  const binding = value as PushBinding;
  return (
    [binding.id, binding.userId, binding.loginId].every(
      (field) => typeof field === "string" && field.length > 0,
    ) &&
    typeof binding.receiptSecret === "string" &&
    binding.receiptSecret.length >= 43 &&
    binding.receiptSecret.length <= 128 &&
    validApiBaseUrl(binding.apiBaseUrl)
  );
}

export function validApiBaseUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
    );
  } catch {
    return false;
  }
}

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(PUSH_DB_NAME, PUSH_DB_VERSION);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(PUSH_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Push storage is blocked."));
  });
}

async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, result: (value: T) => void) => void,
): Promise<T> {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(PUSH_STORE, mode);
    let value: T;
    tx.oncomplete = () => {
      db.close();
      resolve(value);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Push storage failed."));
    };
    try {
      operation(tx.objectStore(PUSH_STORE), (next) => {
        value = next;
      });
    } catch (error) {
      tx.abort();
      reject(error);
    }
  });
}

export function readPushBinding(): Promise<PushBinding | null> {
  return transaction("readonly", (store, result) => {
    const request = store.get(PUSH_BINDING_KEY);
    request.onsuccess = () =>
      result(validBinding(request.result) ? request.result : null);
  });
}

// Callers hold telemedicine-auth; never acquire it again from these primitives.
export function writePushBinding(
  binding: PushBinding,
  token: string,
  enable = false,
) {
  if (!validBinding(binding)) throw new Error("Invalid push binding.");
  return transaction<void>("readwrite", (store, result) => {
    store.put(binding, PUSH_BINDING_KEY);
    store.put({ token, loginId: binding.loginId }, "transport");
    if (enable) store.delete(`suppressed:${binding.loginId}`);
    result(undefined);
  });
}

export function clearPushBinding(
  loginId: string,
  suppress = false,
): Promise<{
  binding: PushBinding;
  token: string | null;
} | null> {
  return transaction("readwrite", (store, result) => {
    const request = store.get(PUSH_BINDING_KEY);
    request.onsuccess = () => {
      const binding: unknown = request.result;
      const owned = validBinding(binding) && binding.loginId === loginId;
      if ((validBinding(binding) && !owned) || (!owned && !suppress)) {
        result(null);
        return;
      }
      const transport = store.get("transport");
      transport.onsuccess = () => {
        result(
          owned
            ? {
                binding: binding as PushBinding,
                token:
                  transport.result?.loginId === loginId
                    ? transport.result.token
                    : null,
              }
            : null,
        );
        store.delete(PUSH_BINDING_KEY);
        if (transport.result?.loginId === loginId) store.delete("transport");
        store.put(true, "resetTransport");
        if (suppress) {
          store.put(true, `suppressed:${loginId}`);
          const attempt = store.get("attempt");
          attempt.onsuccess = () => {
            if (attempt.result?.loginId === loginId) store.delete("attempt");
          };
        }
      };
    };
  });
}

export function getInstallationId(): Promise<string> {
  return transaction("readwrite", (store, result) => {
    const request = store.get("installationId");
    request.onsuccess = () => {
      const valid =
        typeof request.result === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          request.result,
        );
      const id = valid ? request.result : crypto.randomUUID();
      if (!valid) store.put(id, "installationId");
      result(id);
    };
  });
}

export function createReceiptSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function readPushFlag(
  key: "resetTransport" | `suppressed:${string}`,
): Promise<boolean> {
  return transaction("readonly", (store, result) => {
    const request = store.get(key);
    request.onsuccess = () => result(request.result === true);
  });
}

export function writePushFlag(
  key: "resetTransport" | `suppressed:${string}`,
  value: boolean,
) {
  return transaction<void>("readwrite", (store, result) => {
    if (value) store.put(true, key);
    else store.delete(key);
    result(undefined);
  });
}

export function claimPushDelivery(
  bindingId: string,
  deliveryId: string,
): Promise<boolean> {
  return transaction("readwrite", (store, result) => {
    const request = store.get("deliveries");
    request.onsuccess = () => {
      const key = `${bindingId}:${deliveryId}`;
      const recent: string[] = Array.isArray(request.result)
        ? request.result
        : [];
      if (recent.includes(key)) {
        result(false);
        return;
      }
      store.put([...recent.slice(-99), key], "deliveries");
      result(true);
    };
  });
}
