self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const notifTag = data.tag || (data.type ? `hrms-${data.type}` : "hrms-notification");
  event.waitUntil(
    self.registration.showNotification(data.title || "HRMS Notification", {
      body: data.body || "",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      tag: notifTag,
      renotify: false,
      data: { url: data.url || "/employee-portal/dashboard", type: data.type || null },
    })
  );
});

function requestPingFromClient(client) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(false), 20000);
    channel.port1.onmessage = (e) => {
      clearTimeout(timer);
      resolve(Boolean(e.data && e.data.ok));
    };
    client.postMessage({ type: "LOCATION_PING_REQUEST" }, [channel.port2]);
  });
}

async function handleLocationPing() {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clients) {
    if (await requestPingFromClient(client)) {
      await self.registration.showNotification("Location updated", {
        body: "Your current location has been recorded.",
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-192x192.png",
        tag: "location-reminder",
        silent: true,
      });
      return;
    }
  }
  await self.clients.openWindow("/location-ping");
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  if (data.type === "location-ping") {
    event.waitUntil(handleLocationPing());
    return;
  }

  const url = data.url || "/employee-portal/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
