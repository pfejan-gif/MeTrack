import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const moduleFiles = [
  "assets/app.js",
  ...readdirSync("assets/app")
    .filter((file) => file.endsWith(".js"))
    .map((file) => `assets/app/${file}`),
  "assets/core.js",
  ...readdirSync("assets/core")
    .filter((file) => file.endsWith(".js"))
    .map((file) => `assets/core/${file}`),
  "assets/body-metric-icons.js",
  "assets/exercise-icons.js",
  "service-worker.js",
  "scripts/check-release-diff.mjs",
  "scripts/check-static.mjs",
  "scripts/preview-server.mjs",
];

for (const file of moduleFiles) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`Syntax check passed (${moduleFiles.length} JavaScript files).`);
