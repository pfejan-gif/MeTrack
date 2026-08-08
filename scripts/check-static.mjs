import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const requiredFiles = [
  "index.html",
  "manifest.webmanifest",
  "service-worker.js",
  "assets/styles.css",
  "assets/app.js",
  "assets/core.js",
  "assets/icons/favicon.svg",
  "assets/icons/apple-touch-icon.png",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/metrack-logo.svg",
  "assets/icons/social-preview.svg",
];

for (const file of requiredFiles)
  assert.equal(
    existsSync(resolve(root, file)),
    true,
    `Fehlende Datei: ${file}`,
  );

const html = read("index.html");
const styles = read("assets/styles.css");
assert.match(html, /Content-Security-Policy/);
assert.match(html, /viewport-fit=cover/);
assert.match(html, /maximum-scale=1/);
assert.match(html, /user-scalable=no/);
assert.match(html, /apple-mobile-web-app-capable/);
assert.match(html, /id="updateBanner"/);
assert.match(html, /id="exerciseDialog"/);
assert.match(html, /id="customExerciseFields"/);
assert.match(html, /id="timerDialog"/);
assert.match(html, /id="timerStartPauseButton"/);
assert.doesNotMatch(html, /id="resetButton"/);
assert.doesNotMatch(html, /Alle Daten löschen/);
assert.doesNotMatch(html, /privat/i);
assert.doesNotMatch(html, /privacy-card/);
assert.match(styles, /touch-action:\s*pan-x pan-y/);
assert.match(styles, /\.update-banner\s*\{/);
assert.match(styles, /\.set-timer-button\s*\{/);
assert.match(
  styles,
  /\.set-card legend\s*\{[^}]*float:\s*left/s,
  "Legenden müssen innerhalb des Feldrahmens liegen, damit iOS die obere Linie nicht unterbricht.",
);
assert.doesNotMatch(
  html,
  /(?:src|href)="\/(?!\/)/,
  "Lokale Ressourcen müssen relativ für GitHub Pages sein.",
);

const manifest = JSON.parse(read("manifest.webmanifest"));
assert.doesNotMatch(manifest.description, /privat/i);
for (const key of [
  "id",
  "name",
  "short_name",
  "start_url",
  "scope",
  "display",
  "icons",
]) {
  assert.ok(manifest[key], `Manifest-Feld fehlt: ${key}`);
}
assert.equal(manifest.start_url, "./");
assert.equal(manifest.scope, "./");
assert.equal(
  manifest.icons.some((icon) => icon.sizes === "192x192"),
  true,
);
assert.equal(
  manifest.icons.some((icon) => icon.sizes === "512x512"),
  true,
);

const pngSize = (path) => {
  const bytes = readFileSync(resolve(root, path));
  assert.equal(bytes.toString("ascii", 1, 4), "PNG", `${path} ist kein PNG.`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};
const assertOpaquePng = (path) => {
  const bytes = readFileSync(resolve(root, path));
  assert.equal(
    bytes[25],
    2,
    `${path} muss ein vollflächiges RGB-PNG ohne Alphakanal sein.`,
  );
};
assert.deepEqual(pngSize("assets/icons/icon-192.png"), {
  width: 192,
  height: 192,
});
assert.deepEqual(pngSize("assets/icons/icon-512.png"), {
  width: 512,
  height: 512,
});
assert.deepEqual(pngSize("assets/icons/apple-touch-icon.png"), {
  width: 180,
  height: 180,
});
assertOpaquePng("assets/icons/icon-192.png");
assertOpaquePng("assets/icons/icon-512.png");
assertOpaquePng("assets/icons/apple-touch-icon.png");

const serviceWorker = read("service-worker.js");
const app = read("assets/app.js");
const core = read("assets/core.js");
const packageJson = JSON.parse(read("package.json"));
for (const asset of requiredFiles
  .slice(0, 10)
  .filter((path) => !["service-worker.js"].includes(path))) {
  if (asset === "index.html") continue;
  assert.ok(
    serviceWorker.includes(`./${asset}`),
    `App-Shell fehlt im Service Worker: ${asset}`,
  );
}
assert.match(serviceWorker, /CACHE_PREFIX = ["']metrack-app-["']/);
assert.ok(
  serviceWorker.includes(`v${packageJson.version}`),
  "Service-Worker-Cache und package.json müssen dieselbe Version verwenden.",
);
assert.ok(
  app.includes(`APP_VERSION = "${packageJson.version}"`),
  "App-Anzeige und package.json müssen dieselbe Version verwenden.",
);
assert.match(core, /DATA_KEY = "metrack_data_v4"/);
assert.match(core, /DATA_SCHEMA_VERSION = 4/);
assert.match(core, /export function timerElapsedMs/);
assert.match(app, /navigator\.wakeLock\.request\("screen"\)/);
assert.match(app, /TIMER_KEY = "metrack_active_timer_v1"/);
assert.match(app, /updateViaCache:\s*"none"/);
assert.match(app, /registration\s*\.update\(\)/);
assert.match(html, />Übungen<\/h3>/);
assert.doesNotMatch(html, />Eigene Übungen</);
assert.doesNotMatch(
  app,
  /showToast\("Eine neue MeTrack-Version/,
  "PWA-Updates müssen den kompakten Update-Banner statt des Aktions-Toasts verwenden.",
);

console.log(`Static check passed (${requiredFiles.length} required files).`);
