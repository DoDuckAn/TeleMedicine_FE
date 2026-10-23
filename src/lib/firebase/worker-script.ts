export function buildMessagingWorker(config: Record<string, string | undefined>, version: string) {
  const serialized = JSON.stringify(config).replace(/</g, "\\u003c");
  return `
self.addEventListener("notificationclick", (event) => {
  event.stopImmediatePropagation();
  event.notification.close();
  const target = new URL("/notifications", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      const navigated = await client.navigate(target);
      if (navigated) return navigated.focus();
    }
    return self.clients.openWindow(target);
  })());
});
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
importScripts("https://www.gstatic.com/firebasejs/${version}/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/${version}/firebase-messaging-compat.js");
firebase.initializeApp(${serialized});
firebase.messaging();
// FCM displays notification payloads in the background; do not display a second copy.
`;
}
