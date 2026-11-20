const CACHE_VERSION = "v1";
const STATIC_CACHE = `qawmi-static-${CACHE_VERSION}`;
const PAGE_CACHE = `qawmi-pages-${CACHE_VERSION}`;
const RSC_CACHE = `qawmi-rsc-${CACHE_VERSION}`;

const PRECACHE_URLS = ["/offline.html", "/favicon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  const validCaches = new Set([STATIC_CACHE, PAGE_CACHE, RSC_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (!validCaches.has(key)) {
              return caches.delete(key);
            }
            return Promise.resolve();
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/fonts/") ||
    pathname.startsWith("/assets/") ||
    /\.(?:js|css|woff2?|ttf|otf|eot|png|jpg|jpeg|svg|webp|ico)$/i.test(pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API routes or sw.js itself
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") {
    return;
  }

  // 1. Static assets: Cache-First with network fallback
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response && response.ok) {
            cache.put(request, response.clone()).catch(() => {});
          }
          return response;
        } catch {
          return new Response("", { status: 504, statusText: "Offline" });
        }
      })
    );
    return;
  }

  // 2. Next.js RSC soft-navigation payloads: Network-First with RSC cache fallback
  const isRsc = request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
  if (isRsc) {
    event.respondWith(
      caches.open(RSC_CACHE).then(async (cache) => {
        try {
          const response = await fetch(request);
          if (response && response.ok) {
            cache.put(request.url, response.clone()).catch(() => {});
          }
          return response;
        } catch {
          const exactMatch = await cache.match(request.url);
          if (exactMatch) return exactMatch;

          // Fallback to same pathname without _rsc query param
          const cleanUrl = `${url.origin}${url.pathname}${url.search.replace(/[?&]_rsc=[^&]+/, "")}`;
          const pathMatch = await cache.match(cleanUrl);
          if (pathMatch) return pathMatch;

          return new Response("", { status: 504, statusText: "Offline" });
        }
      })
    );
    return;
  }

  // 3. HTML Page Navigations: Network-First with Page cache fallback
  if (request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      caches.open(PAGE_CACHE).then(async (cache) => {
        try {
          const response = await fetch(request);
          if (response && response.ok) {
            cache.put(request.url, response.clone()).catch(() => {});
            // Also store under clean pathname if query params exist (e.g. /portal?student_id=...)
            if (url.search) {
              cache.put(`${url.origin}${url.pathname}`, response.clone()).catch(() => {});
            }
          }
          return response;
        } catch {
          const exactMatch = await cache.match(request.url);
          if (exactMatch) return exactMatch;

          const pathMatch = await cache.match(`${url.origin}${url.pathname}`);
          if (pathMatch) return pathMatch;

          const offlinePage = await caches.match("/offline.html");
          if (offlinePage) return offlinePage;

          return new Response(
            "<!DOCTYPE html><html lang='bn'><body style='font-family:sans-serif;text-align:center;padding:40px'><h2>ইন্টারনেট সংযোগ নেই</h2><p>দয়া করে ইন্টারনেট চালু করে আবার চেষ্টা করুন।</p></body></html>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        }
      })
    );
  }
});
