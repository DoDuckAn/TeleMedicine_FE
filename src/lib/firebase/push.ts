import { getMessaging, getToken, deleteToken, isSupported, onMessage, type MessagePayload } from "firebase/messaging";
import { getFirebaseApp, isFirebaseConfigured } from "./client";
import { API_BASE_URL } from "@/lib/api/client";
import { registerPushDevice } from "@/lib/api/notifications";

const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
let operations: Promise<unknown> = Promise.resolve();
let binding: { userId: string; token: string; unsubscribe?: () => void } | undefined;

function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const next = operations.catch(() => undefined).then(operation);
  operations = next;
  return next;
}

export function pushConfigurationError() {
  if (!isFirebaseConfigured() || !process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || !vapidKey) {
    return "Chưa cấu hình đầy đủ Firebase và khóa VAPID cho thông báo thiết bị.";
  }
  return null;
}

export async function assertPushSupported() {
  if (!window.isSecureContext || !("Notification" in window) || !("serviceWorker" in navigator) || !(await isSupported())) {
    throw new Error("Trình duyệt này chưa hỗ trợ thông báo đẩy. Hãy dùng trình duyệt hỗ trợ qua HTTPS.");
  }
  const error = pushConfigurationError();
  if (error) throw new Error(error);
}

async function activeWorker(registration: ServiceWorkerRegistration) {
  const worker = registration.installing ?? registration.waiting ?? registration.active;
  if (!worker) throw new Error("Không khởi động được dịch vụ thông báo.");
  if (worker.state === "activated") return;
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer);
      worker.removeEventListener("statechange", changed);
      if (error) reject(error); else resolve();
    };
    const changed = () => {
      if (worker.state === "activated") finish();
      else if (worker.state === "redundant") finish(new Error("Không cài đặt được dịch vụ thông báo."));
    };
    const timer = setTimeout(() => finish(new Error("Dịch vụ thông báo khởi động quá lâu. Vui lòng thử lại.")), 20_000);
    worker.addEventListener("statechange", changed);
    changed();
  });
}

export function connectPushDevice(
  session: { userId: string; accessToken: string },
  isCurrent: () => boolean,
  received: (payload: MessagePayload) => void,
) {
  return serialized(async () => {
    if (!isCurrent()) return false;
    await assertPushSupported();
    if (Notification.permission !== "granted") return false;
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
    await activeWorker(registration);
    const messaging = getMessaging(getFirebaseApp());
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (!token) throw new Error("Không lấy được mã đăng ký thông báo của thiết bị.");
    if (!isCurrent()) { await deleteToken(messaging); return false; }
    binding?.unsubscribe?.();
    binding = { userId: session.userId, token };
    await registerPushDevice({ token, platform: "WEB" }, { accessToken: session.accessToken });
    if (!isCurrent()) return false;
    binding.unsubscribe = onMessage(messaging, (payload) => {
      if (isCurrent()) received(payload);
    });
    return true;
  });
}

export function disconnectPushDevice(session: { userId: string; accessToken: string }) {
  return serialized(async () => {
    if (binding && binding.userId !== session.userId) return;
    const previous = binding;
    binding?.unsubscribe?.();
    binding = undefined;
    // Do not refresh an old account's token after the browser has switched accounts.
    const unregister = previous ? fetch(`${API_BASE_URL}/notifications/devices`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken}` },
      body: JSON.stringify({ token: previous.token }),
      signal: AbortSignal.timeout(10_000),
      keepalive: true,
    }).then(response => {
      if (!response.ok) throw new Error("Không gỡ được đăng ký thông báo trên máy chủ.");
    }) : Promise.resolve();
    const revoke = (async () => {
      if (isFirebaseConfigured() && await isSupported()) await deleteToken(getMessaging(getFirebaseApp()));
    })();
    const results = await Promise.allSettled([unregister, revoke]);
    if (results.some(result => result.status === "rejected")) {
      throw new Error("Chưa gỡ hoàn toàn thông báo của phiên trước. Vui lòng tải lại trang và kiểm tra quyền thông báo.");
    }
  });
}
