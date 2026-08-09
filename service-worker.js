const CACHE_PREFIX = "metrack-app-";
const CACHE_NAME = `${CACHE_PREFIX}v2.9.1`;
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
  "./assets/icons/exercises/activity.webp",
  "./assets/icons/exercises/plank.webp",
  "./assets/icons/exercises/push-up.webp",
  "./assets/icons/exercises/squat.webp",
  "./assets/icons/exercises/sit-up.webp",
  "./assets/icons/exercises/dumbbell.webp",
  "./assets/icons/exercises/kettlebell.webp",
  "./assets/icons/exercises/running.webp",
  "./assets/icons/exercises/cycling.webp",
  "./assets/icons/exercises/pull-up.webp",
  "./assets/icons/exercises/lunge.webp",
  "./assets/icons/exercises/jump-rope.webp",
  "./assets/icons/exercises/rowing.webp",
  "./assets/icons/exercises/target.webp",
  "./assets/icons/exercises/burpee.webp",
  "./assets/icons/exercises/jumping-jack.webp",
  "./assets/icons/exercises/mountain-climber.webp",
  "./assets/icons/exercises/stretch.webp",
  "./assets/icons/exercises/hip-stretch.webp",
  "./assets/icons/exercises/hamstring.webp",
  "./assets/icons/exercises/shoulder-stretch.webp",
  "./assets/icons/exercises/neck-stretch.webp",
  "./assets/icons/exercises/side-stretch.webp",
  "./assets/icons/exercises/butterfly.webp",
  "./assets/icons/exercises/calf-stretch.webp",
  "./assets/icons/exercises/back-stretch.webp",
  "./assets/icons/exercises/yoga.webp",
  "./assets/icons/exercises/quadriceps-stretch.webp",
  "./assets/icons/exercises/chest-stretch.webp",
  "./assets/icons/exercises/wrist-stretch.webp",
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
