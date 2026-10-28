/* Algo UPSC service worker: shows study alerts and opens the feed when tapped. */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Algo UPSC", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Algo UPSC";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "study",
      renotify: true,
      requireInteraction: !!data.sticky,
      vibrate: [300, 150, 300, 150, 600],
      data: { url: data.url || "/study" },
      actions: [{ action: "start", title: data.action || "Start now" }],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/study";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes("/study") && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
