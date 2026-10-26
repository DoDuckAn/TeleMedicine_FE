import type { PushReceipt, ResolvedPush } from "@/lib/api/notifications";

import { type PushBinding, validApiBaseUrl } from "./push-storage";

export function parsePushReceipt(payload: unknown): PushReceipt | null {
  if (
    !payload ||
    typeof payload !== "object" ||
    "notification" in payload ||
    "title" in payload ||
    "body" in payload
  )
    return null;
  const message = payload as {
    data?: Record<string, unknown>;
    webpush?: object;
  };
  if (message.webpush && "notification" in message.webpush) return null;
  const data = message.data;
  if (
    !data ||
    typeof data !== "object" ||
    Object.keys(data).some(
      (key) => key !== "bindingId" && key !== "deliveryId",
    ) ||
    typeof data.bindingId !== "string" ||
    !data.bindingId ||
    typeof data.deliveryId !== "string" ||
    !data.deliveryId ||
    data.bindingId.length > 256 ||
    data.deliveryId.length > 256
  )
    return null;
  return { bindingId: data.bindingId, deliveryId: data.deliveryId };
}

export async function resolvePushReceipt(
  binding: PushBinding,
  receipt: PushReceipt,
) {
  if (binding.id !== receipt.bindingId || !validApiBaseUrl(binding.apiBaseUrl))
    return null;
  const response = await fetch(
    `${binding.apiBaseUrl.replace(/\/$/, "")}/notifications/push/resolve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...receipt,
        receiptSecret: binding.receiptSecret,
      }),
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!response.ok) return null;
  const envelope = await response.json();
  const value = envelope?.success === true ? envelope.data : envelope;
  if (
    !value ||
    typeof value.title !== "string" ||
    !value.title ||
    typeof value.body !== "string" ||
    value.url !== "/notifications" ||
    typeof value.notificationId !== "string" ||
    !value.notificationId
  )
    return null;
  return value as ResolvedPush;
}
