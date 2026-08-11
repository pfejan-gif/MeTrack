import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const RUNTIME_FILES = new Set([
  "index.html",
  "manifest.webmanifest",
  "service-worker.js",
]);

export function isRuntimeFile(path) {
  return RUNTIME_FILES.has(path) || path.startsWith("assets/");
}

export function parseSemver(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  if (!match) {
    throw new Error(`Ungültige App-Version: ${version}`);
  }
  return match.slice(1).map(Number);
}

export function compareSemver(leftVersion, rightVersion) {
  const left = parseSemver(leftVersion);
  const right = parseSemver(rightVersion);
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

export function assertVersionAdvanced(baseVersion, currentVersion) {
  if (compareSemver(currentVersion, baseVersion) <= 0) {
    throw new Error(
      `Laufzeitdateien wurden geändert, aber die App-Version wurde nicht erhöht ` +
        `(Basis ${baseVersion}, aktuell ${currentVersion}).`,
    );
  }
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function packageVersionFromRevision(revision) {
  const packageJson = git("show", `${revision}:package.json`);
  return JSON.parse(packageJson).version;
}

function changedFilesSince(revision) {
  const output = git("diff", "--name-only", `${revision}...HEAD`);
  return output ? output.split("\n") : [];
}

export function checkReleaseDiff(baseRevision) {
  if (!baseRevision) {
    throw new Error("Basis-Revision als erstes Argument angeben.");
  }

  const changedRuntimeFiles = changedFilesSince(baseRevision).filter(isRuntimeFile);
  if (changedRuntimeFiles.length === 0) {
    console.log("Kein App-Release: keine Laufzeitdatei geändert.");
    return;
  }

  const baseVersion = packageVersionFromRevision(baseRevision);
  const currentVersion = JSON.parse(readFileSync("package.json", "utf8")).version;
  assertVersionAdvanced(baseVersion, currentVersion);
  console.log(
    `App-Version korrekt erhöht: ${baseVersion} → ${currentVersion} ` +
      `(${changedRuntimeFiles.length} Laufzeitdatei(en)).`,
  );
}

const invokedPath = process.argv[1] && pathToFileURL(process.argv[1]).href;
if (invokedPath === import.meta.url) {
  try {
    checkReleaseDiff(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
