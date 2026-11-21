// Private HTML/RSC (including /portal?student_id=...) must never be shared by URL.
// Only immutable assets and the account-neutral offline reader live in Cache Storage.
const STATIC_CACHE = "qawmi-static-v3";
const PUBLIC = ["/offline.html", "/offline-portal.js", "/favicon.png"];
self.addEventListener("install", (e) =>
  e.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((c) => c.addAll(PUBLIC))
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("qawmi-") && k !== STATIC_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (e) => {
  const r = e.request,
    u = new URL(r.url);
  if (
    r.method !== "GET" ||
    u.origin !== self.location.origin ||
    u.pathname.startsWith("/api/")
  )
    return;
  if (r.mode === "navigate") {
    e.respondWith(
      // Do not replay even a fresh HTTP-cached portal document for a different owner.
      fetch(r, { cache: "no-store" }).catch(
        async () =>
          (await (await caches.open(STATIC_CACHE)).match("/offline.html")) ||
          Response.error(),
      ),
    );
  } else if (
    u.pathname.startsWith("/_next/static/") ||
    u.pathname.startsWith("/fonts/") ||
    PUBLIC.includes(u.pathname)
  ) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(async (c) => {
        const hit = await c.match(r);
        if (hit) return hit;
        const res = await fetch(r);
        if (res.ok && !res.redirected) await c.put(r, res.clone());
        return res;
      }),
    );
  }
});
