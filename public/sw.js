/*
 * Service worker.
 *
 * Deliberately small and conservative:
 *   - navigations are network-first with a cached shell and an offline fallback,
 *     so a learner who is already online always gets fresh content;
 *   - lesson and exercise pages are never cached at all, because they carry the
 *     graded quiz and interactive exercises;
 *   - hashed build assets and icons are cache-first, because their URLs change
 *     when their contents change;
 *   - everything else (API routes, POSTs, cross-origin) is left alone.
 *
 * Registration is limited to production builds (see ServiceWorkerRegistrar), so
 * this never interferes with the dev server's hot reloading.
 */

/*
 * Bump this whenever the caching behaviour changes.
 *
 * The activate handler deletes every cache whose name does not start with the
 * current VERSION, so bumping it is what purges leftovers from earlier builds.
 * It was never bumped, which is how caches from the first deployment survived
 * every subsequent rebuild.
 */
const VERSION = "icdl-v3";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const OFFLINE_URL = "/offline";

/*
 * Pages that must never be cached, not even when a response looks cacheable.
 *
 * Lesson pages carry the graded quiz and the interactive exercises, so a
 * remembered copy can hand someone an exercise they had already finished, or a
 * quiz payload from an earlier build. They are always fetched from the network.
 */
const NO_CACHE_PREFIXES = ["/course/", "/exercises"];

function isNoCachePath(pathname) {
  return NO_CACHE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Individual failures must not abort the whole install.
      await Promise.all(
        PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" })).catch(() => undefined)),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function isBuildAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|svg|webp|avif)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API calls or the Next.js dev/data endpoints.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/data/")) return;

  if (request.mode === "navigate") {
    // Lessons, quizzes and exercises are never cached: network only.
    if (isNoCachePath(url.pathname)) {
      event.respondWith(
        (async () => {
          try {
            return await fetch(request, { cache: "reload" });
          } catch {
            const offline = await caches.match(OFFLINE_URL);
            if (offline) return offline;
            return new Response("offline", { status: 503, headers: { "Content-Type": "text/plain" } });
          }
        })(),
      );
      return;
    }

    event.respondWith(
      (async () => {
        try {
          // `cache: "reload"` bypasses the browser's own HTTP cache, so a page
          // viewed online is always the current deployment rather than a
          // remembered copy of an earlier build.
          const response = await fetch(request, { cache: "reload" });

          // Only remember pages that are safe to remember. Next marks every
          // dynamic page `no-store`; caching those is what allowed a stale page
          // to be served later.
          const policy = response.headers.get("cache-control") ?? "";
          if (response.ok && !policy.includes("no-store")) {
            const cache = await caches.open(SHELL_CACHE);
            cache.put(request, response.clone()).catch(() => undefined);
          }

          return response;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          if (offline) return offline;
          return new Response("offline", { status: 503, headers: { "Content-Type": "text/plain" } });
        }
      })(),
    );
    return;
  }

  if (isBuildAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(ASSET_CACHE);
            cache.put(request, response.clone()).catch(() => undefined);
          }
          return response;
        } catch {
          return new Response("", { status: 504 });
        }
      })(),
    );
  }
});
