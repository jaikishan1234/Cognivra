const CACHE_NAME = "cognivra-v2"; // ✅ bump version to clear old cache immediately

const STATIC_ASSETS = ["/", "/index.html"];

// Install — cache only the bare shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate — wipe ALL old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only handle GET
  if (event.request.method !== "GET") return;

  // Skip non-http requests (chrome-extension, etc.)
  if (!event.request.url.startsWith("http")) return;

  const url = new URL(event.request.url);

  // Never cache API, socket, or Vite dev requests
  if (
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/socket.io") ||
    url.pathname.startsWith("/@") ||        // Vite internal
    url.pathname.startsWith("/src") ||      // Vite source files
    url.pathname.startsWith("/node_modules")
  ) return;

  // Vite hashed assets (e.g. /assets/index-Abc123.js) — network first, cache as fallback
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Navigation — always network first, never serve stale index.html
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }
});