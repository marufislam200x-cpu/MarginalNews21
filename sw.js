
/* =========================================
   MARGINAL NEWS
   PROGRESSIVE WEB APP - SERVICE WORKER
========================================= */

const CACHE_NAME = "marginal-news-v1";

const STATIC_FILES = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/manifest.webmanifest"
];


/* =========================================
   1. INSTALL SERVICE WORKER
========================================= */

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_FILES))
      .then(() => self.skipWaiting())
  );
});


/* =========================================
   2. ACTIVATE SERVICE WORKER
========================================= */

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name !== CACHE_NAME)
            .map(name => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});


/* =========================================
   3. HANDLE NETWORK REQUESTS
========================================= */

self.addEventListener("fetch", event => {

  const request = event.request;
  const url = new URL(request.url);

  // Only handle same-origin GET requests.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // Never cache API requests or Admin pages.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/admin")
  ) {
    return;
  }

  // HTML navigation: network first, cached homepage as fallback.
  if (request.mode === "navigate") {

    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();

            caches.open(CACHE_NAME).then(cache => {
              cache.put("/", copy);
            });
          }

          return response;
        })
        .catch(async () => {
          return (
            await caches.match(request) ||
            await caches.match("/") ||
            new Response(
              "You are offline. Please check your internet connection.",
              {
                status: 503,
                headers: {
                  "Content-Type": "text/plain; charset=utf-8"
                }
              }
            )
          );
        })
    );

    return;
  }

  // Static files: cache first, then network.
  event.respondWith(
    caches.match(request).then(cachedResponse => {

      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then(response => {

        if (
          response.ok &&
          response.type === "basic"
        ) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, copy);
          });
        }

        return response;
      });

    })
  );

});
