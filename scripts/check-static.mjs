import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const readdirTestFiles = () =>
  readdirSync(resolve(root, "tests"))
    .filter((file) => file.endsWith(".test.mjs"))
    .map((file) => `tests/${file}`);

const styleModules = [
  "assets/styles/base.css",
  "assets/styles/dashboard.css",
  "assets/styles/training.css",
  "assets/styles/charts-history.css",
  "assets/styles/dialogs.css",
  "assets/styles/responsive.css",
];
const appModules = [
  "assets/app.js",
  "assets/app/chart-renderer.js",
  "assets/app/dashboard-controller.js",
  "assets/app/entry-draft.js",
  "assets/app/entry-controller.js",
  "assets/app/exercise-controller.js",
  "assets/app/exercise-icon-ui.js",
  "assets/app/history-controller.js",
  "assets/app/navigation-controller.js",
  "assets/app/pwa-controller.js",
  "assets/app/timer-controller.js",
  "assets/app/transfer-controller.js",
];
const coreModules = [
  "assets/core.js",
  "assets/core/constants.js",
  "assets/core/entries.js",
  "assets/core/exercises.js",
  "assets/core/migrations.js",
  "assets/core/statistics.js",
  "assets/core/transfer.js",
  "assets/core/value-utils.js",
];
const appShellFiles = [
  "index.html",
  "manifest.webmanifest",
  "assets/styles.css",
  ...styleModules,
  ...appModules,
  ...coreModules,
  "assets/exercise-icons.js",
  "assets/icons/favicon.svg",
  "assets/icons/apple-touch-icon.png",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
];
const requiredFiles = [
  "service-worker.js",
  ...appShellFiles,
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
const styleEntry = read("assets/styles.css");
const styles = styleModules.map(read).join("\n");
const chartHistoryStyles = read("assets/styles/charts-history.css");
const responsiveStyles = read("assets/styles/responsive.css");
const app = appModules.map(read).join("\n");
const exerciseController = read("assets/app/exercise-controller.js");
const core = coreModules.map(read).join("\n");
for (const module of styleModules)
  assert.ok(
    styleEntry.includes(`@import "./${module.slice("assets/".length)}";`),
    `Stylesheet-Einstieg importiert ${module} nicht.`,
  );
assert.match(
  chartHistoryStyles,
  /\.history-controls\s*\{[^}]*--history-control-height:\s*44px/s,
  "Monatsauswahl und Daten-Button brauchen eine gemeinsame Zielhöhe.",
);
assert.match(
  chartHistoryStyles,
  /\.history-month-control select,\s*\.history-controls > \.compact-button\s*\{[^}]*height:\s*var\(--history-control-height\)[^}]*min-height:\s*var\(--history-control-height\)/s,
  "Monatsauswahl und Daten-Button müssen exakt gleich hoch sein.",
);
assert.match(
  responsiveStyles,
  /--app-nav-height:\s*max\(\s*64px,\s*calc\(44px \+ env\(safe-area-inset-bottom\)\)\s*\);/s,
  "Die mobile Navigation muss eine kompakte, iPhone-sichere Gesamthöhe verwenden.",
);
assert.match(
  responsiveStyles,
  /\.app-nav\s*\{[^}]*height:\s*var\(--app-nav-height\);[^}]*padding:\s*5px max\(10px, env\(safe-area-inset-right\)\)\s*5px\s*max\(10px, env\(safe-area-inset-left\)\);[^}]*align-items:\s*center/s,
  "Die mobile Navigation muss ihre Ziele innerhalb der iPhone-Safe-Area zentrieren.",
);
assert.match(html, /Content-Security-Policy/);
assert.match(html, /viewport-fit=cover/);
assert.match(html, /maximum-scale=1/);
assert.match(html, /user-scalable=no/);
assert.match(html, /apple-mobile-web-app-capable/);
assert.match(html, /id="updateBanner"/);
assert.match(html, /id="exerciseDialog"/);
assert.match(html, /id="customExerciseFields"/);
assert.match(html, /id="stretchFields"/);
assert.match(html, /id="exerciseInstructions"/);
assert.match(html, /id="exerciseIconPalette"/);
assert.match(html, /id="timerDialog"/);
assert.match(html, /id="timerStartPauseButton"/);
assert.match(html, /data-view-link="today"/);
assert.match(html, /data-view-link="analysis"/);
assert.match(html, /data-view-link="history"/);
assert.match(html, /id="draftStatus"/);
assert.match(html, /id="entryProgress"/);
assert.match(html, /id="historyMonthFilter"/);
assert.match(html, /id="dataActionsDialog"/);
assert.doesNotMatch(html, /id="resetButton"/);
assert.doesNotMatch(html, /Alle Daten löschen/);
assert.doesNotMatch(html, /privat/i);
assert.doesNotMatch(html, /privacy-card/);
assert.doesNotMatch(
  html,
  /id="appVersion"[^<]*<\/span>\s*·\s*offline-fähig/i,
);
assert.match(styles, /touch-action:\s*pan-x pan-y/);
assert.match(styles, /\.update-banner\s*\{/);
assert.match(styles, /\.set-timer-button\s*\{/);
assert.match(styles, /\.set-field-header\s*\{/);
assert.match(styles, /\.app-nav\s*\{/);
assert.match(
  styles,
  /\.set-timer-button\s*\{[^}]*position:\s*absolute/s,
  "Die Stoppuhr darf die kompakte Satzzeile nicht vergrößern.",
);
assert.doesNotMatch(
  styles,
  /\.set-field-header\.has-timer\s*\{[^}]*min-height/s,
  "Zeitbasierte Satzzeilen müssen denselben Abstand wie Wiederholungen haben.",
);
assert.match(
  styles,
  /\.toast\.visible\s*\{[^}]*pointer-events:\s*auto/s,
  "Die sichtbare Snackbar muss auf Touch-Eingaben reagieren.",
);
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
assert.doesNotMatch(app, /label\.textContent\s*=\s*"Timer"/);
const packageJson = JSON.parse(read("package.json"));
for (const asset of appShellFiles) {
  assert.ok(
    serviceWorker.includes(`./${asset}`),
    `App-Shell fehlt im Service Worker: ${asset}`,
  );
}
assert.match(serviceWorker, /CACHE_PREFIX = ["']metrack-app-["']/);
assert.match(
  serviceWorker,
  /new Request\(url,\s*\{\s*cache:\s*"reload"\s*\}\)/,
  "Der App-Shell-Cache muss bei Updates den HTTP-Cache umgehen.",
);
assert.ok(
  serviceWorker.includes(`v${packageJson.version}`),
  "Service-Worker-Cache und package.json müssen dieselbe Version verwenden.",
);
assert.ok(
  app.includes(`APP_VERSION = "${packageJson.version}"`),
  "App-Anzeige und package.json müssen dieselbe Version verwenden.",
);
assert.match(core, /DATA_KEY = "metrack_data_v6"/);
assert.match(core, /DATA_SCHEMA_VERSION = 6/);
assert.match(app, /createExerciseIconSvg/);
assert.match(core, /entryExerciseCompletion/);
assert.match(core, /exerciseCompletionSummary/);
assert.match(core, /export function timerElapsedMs/);
assert.doesNotMatch(
  app,
  /\.innerHTML\s*=|insertAdjacentHTML/,
  "Dynamische Inhalte dürfen nicht als ungeprüftes HTML gerendert werden.",
);
assert.match(app, /navigator\.wakeLock\.request\("screen"\)/);
assert.match(app, /TIMER_KEY = "metrack_active_timer_v1"/);
assert.match(app, /ENTRY_DRAFT_KEY = "metrack_entry_draft_v1"/);
assert.match(app, /entryForm\.addEventListener\("input", saveDraft\)/);
assert.match(exerciseController, /saveEntryDraft\(\)/);
assert.match(exerciseController, /restoreEntryDraft\(\)/);
assert.doesNotMatch(exerciseController, /\bresetForm\b/);
assert.match(app, /updateViaCache:\s*"none"/);
assert.match(app, /registration\s*\.update\(\)/);
assert.match(html, />Übungen &amp; Dehnungen<\/h3>/);
assert.doesNotMatch(html, />Eigene Übungen</);
assert.doesNotMatch(
  app,
  /showToast\("Eine neue MeTrack-Version/,
  "PWA-Updates müssen den kompakten Update-Banner statt des Aktions-Toasts verwenden.",
);

const modularSources = [
  ...appModules,
  ...coreModules,
  ...styleModules,
  ...readdirTestFiles(),
];
for (const file of modularSources) {
  const lineCount = read(file).split(/\r?\n/).length;
  assert.ok(
    lineCount <= 800,
    `${file} ist mit ${lineCount} Zeilen zu groß und muss fachlich geteilt werden.`,
  );
}

console.log(`Static check passed (${requiredFiles.length} required files).`);
