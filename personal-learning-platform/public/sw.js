const CACHE = "personal-learning-shell-v2";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(["/", "/icon.svg", "/manifest.webmanifest"]),
      ),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/internal/") ||
    url.pathname.startsWith("/sandbox/")
  )
    return;
  if (url.pathname.startsWith("/assets/"))
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const found = await cache.match(event.request);
        if (found) return found;
        const r = await fetch(event.request);
        if (r.ok) cache.put(event.request, r.clone());
        return r;
      }),
    );
  else if (event.request.mode === "navigate")
    event.respondWith(fetch(event.request).catch(() => caches.match("/")));
});
self.addEventListener("push", (event) => {
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: "Personal Learning",
      body: "Your next learning step is ready.",
      url: "/",
    };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: "learning-reminder",
      data: { url: payload.url || "/" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url || "/";
  const url = new URL(path, location.origin);
  if (url.origin !== location.origin) return;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (new URL(client.url).origin === location.origin) {
            client.navigate(url.href);
            return client.focus();
          }
        }
        return self.clients.openWindow(url.href);
      }),
  );
});
