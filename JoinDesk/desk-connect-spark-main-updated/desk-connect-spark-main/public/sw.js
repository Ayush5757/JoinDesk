// JoinDesk service worker — only job is to receive Web Push events and
// show the OS/browser notification popup for them. This is the free
// (VAPID-based) push flow that replaced email for "Special" user
// notifications. No Firebase, no external SDK — this file IS the whole
// client-side push implementation.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = { title: "JoinDesk", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "JoinDesk";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/" },
    tag: data.tag || undefined,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Clicking the notification focuses an already-open JoinDesk tab if there
// is one, otherwise opens a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
      return undefined;
    })
  );
});
