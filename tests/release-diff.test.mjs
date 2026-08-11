import assert from "node:assert/strict";
import test from "node:test";

import {
  assertVersionAdvanced,
  compareSemver,
  isRuntimeFile,
  parseSemver,
} from "../scripts/check-release-diff.mjs";

test("erkennt ausschließlich ausgelieferte Dateien als Laufzeitänderung", () => {
  for (const path of [
    "index.html",
    "manifest.webmanifest",
    "service-worker.js",
    "assets/app.js",
    "assets/icons/exercises/squat.webp",
  ]) {
    assert.equal(isRuntimeFile(path), true, path);
  }

  for (const path of [
    "AGENTS.md",
    "README.md",
    ".github/workflows/quality.yml",
    "package.json",
    "scripts/check-static.mjs",
    "tests/release-diff.test.mjs",
  ]) {
    assert.equal(isRuntimeFile(path), false, path);
  }
});

test("vergleicht stabile Semver-Versionen numerisch", () => {
  assert.deepEqual(parseSemver("2.11.3"), [2, 11, 3]);
  assert.ok(compareSemver("2.12.0", "2.11.99") > 0);
  assert.equal(compareSemver("2.11.3", "2.11.3"), 0);
  assert.ok(compareSemver("2.11.2", "2.11.3") < 0);
  assert.throws(() => parseSemver("2.11"), /Ungültige App-Version/);
});

test("akzeptiert nur eine tatsächlich höhere Release-Version", () => {
  assert.doesNotThrow(() => assertVersionAdvanced("2.11.3", "2.11.4"));
  assert.throws(
    () => assertVersionAdvanced("2.11.3", "2.11.3"),
    /nicht erhöht/,
  );
  assert.throws(
    () => assertVersionAdvanced("2.11.3", "2.11.2"),
    /nicht erhöht/,
  );
});
