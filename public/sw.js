/* تويلف — Service Worker */

/* ── Push Notifications ──────────────────────────────────────────── */
self.addEventListener("push", e => {
  let data = { title: "🛵 طلب جديد!", body: "", data: {} };
  try { data = e.data ? e.data.json() : data; } catch { /* ignore */ }

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/twelve/images/icon-192.png",
      badge: "/twelve/images/icon-192.png",
      tag: "new-delivery-order",          // replaces previous if still visible
      renotify: true,
      vibrate: [200, 100, 200, 100, 400],
      data: data.data ?? {},
      requireInteraction: true,           // keep on screen until tapped
    })
  );
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      // Focus existing delivery tab if open
      const deliveryTab = list.find(c => c.url.includes("/delivery"));
      if (deliveryTab) return deliveryTab.focus();
      // Otherwise open a new tab
      return clients.openWindow("/twelve/delivery");
    })
  );
});


const CACHE = "twelve-v1";
const PRECACHE = [
  "/twelve/",
  "/twelve/images/logo.jpg",
  "/twelve/images/icon-512.png",
  "/twelve/images/icon-192.png",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  /* tiles + nominatim: network only */
  if (e.request.url.includes("openstreetmap") || e.request.url.includes("nominatim")) return;

  /* html navigation: network-first so updates propagate */
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() => caches.match("/twelve/"))
    );
    return;
  }

  /* everything else: stale-while-revalidate */
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request);
      const fetchPromise = fetch(e.request).then(res => {
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      }).catch(() => cached);
      return cached ?? fetchPromise;
    })
  );
});
