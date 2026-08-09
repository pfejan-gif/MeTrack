const CACHE_PREFIX = "metrack-app-";
const CACHE_NAME = `${CACHE_PREFIX}v2.8.2`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/styles.css",
  "./assets/styles/base.css",
  "./assets/styles/dashboard.css",
  "./assets/styles/training.css",
  "./assets/styles/charts-history.css",
  "./assets/styles/dialogs.css",
  "./assets/styles/responsive.css",
  "./assets/app.js",
  "./assets/app/chart-renderer.js",
  "./assets/app/dashboard-controller.js",
  "./assets/app/entry-draft.js",
  "./assets/app/entry-controller.js",
  "./assets/app/exercise-controller.js",
  "./assets/app/exercise-icon-ui.js",
  "./assets/app/history-controller.js",
  "./assets/app/navigation-controller.js",
  "./assets/app/pwa-controller.js",
  "./assets/app/timer-controller.js",
  "./assets/app/transfer-controller.js",
  "./assets/core.js",
  "./assets/core/constants.js",
  "./assets/core/entries.js",
  "./assets/core/exercises.js",
  "./assets/core/migrations.js",
  "./assets/core/statistics.js",
  "./assets/core/transfer.js",
  "./assets/core/value-utils.js",
  "./assets/exercise-icons.js",
  "./assets/icons/favicon.svg",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(
          APP_SHELL.map((url) => new Request(url, { cache: "reload" })),
        ),
      ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic")
            return response;
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => {
          if (request.mode === "navigate") return caches.match("./index.html");
          return new Response("Offline", {
            status: 503,
            statusText: "Offline",
          });
        });
    }),
  );
});
