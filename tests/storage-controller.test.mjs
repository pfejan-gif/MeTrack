import assert from "node:assert/strict";
import test from "node:test";

import {
  DATA_KEY,
  V4_DATA_KEY,
  parseBackup,
} from "../assets/core.js";
import {
  CORRUPT_PAYLOAD_BACKUP_KEY,
  DATA_STORAGE_KEYS,
  PRE_IMPORT_BACKUP_KEY,
  createStorageController,
} from "../assets/app/storage-controller.js";
import { catalog, day } from "./helpers/core-fixtures.mjs";

function memoryStorage(initial = {}) {
  const values = new Map(
    Object.entries(initial).map(([key, value]) => [key, String(value)]),
  );
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function appState(overrides = {}) {
  return {
    entries: [day("2026-08-05", { plank: [30, 35, 32] })],
    exercises: catalog,
    settings: { theme: "dark" },
    storageWritable: true,
    storageCorrupt: false,
    corruptStorageValue: null,
    corruptStorageKey: null,
    ...overrides,
  };
}

function setup(storage = memoryStorage(), overrides = {}) {
  const state = appState(overrides);
  const messages = [];
  const controller = createStorageController({
    state,
    storage,
    cloneDefaults: () => catalog.map((exercise) => ({ ...exercise })),
    updateStorageUi() {},
    showToast(message) {
      messages.push(message);
    },
  });
  return { controller, messages, state, storage };
}

test("migriert eine v4-Ablage weiterhin in den aktuellen Datenspeicher", () => {
  const raw = JSON.stringify({
    schemaVersion: 4,
    exercises: catalog,
    entries: [day("2026-08-05", { plank: [40, null, null] })],
  });
  const setupResult = setup(memoryStorage({ [V4_DATA_KEY]: raw }));

  const loaded = setupResult.controller.loadData();

  assert.equal(loaded.entries.length, 1);
  assert.equal(JSON.parse(setupResult.storage.getItem(DATA_KEY)).schemaVersion, 6);
  assert.equal(setupResult.storage.getItem(V4_DATA_KEY), raw);
});

test("sichert den aktuellen Stand vor einem Import als gültiges Backup", () => {
  const setupResult = setup();

  assert.equal(setupResult.controller.backupBeforeImport(), true);

  const backup = parseBackup(
    setupResult.storage.getItem(PRE_IMPORT_BACKUP_KEY),
  );
  assert.equal(backup.entries.length, 1);
  assert.equal(backup.settings.theme, "dark");
});

test("sichert beschädigte Rohdaten vor dem Verwerfen und entfernt auch v4", () => {
  const raw = "{beschädigt";
  const storage = memoryStorage({
    [V4_DATA_KEY]: raw,
    draft: "ungespeichert",
  });
  const setupResult = setup(storage, {
    entries: [],
    storageWritable: false,
    storageCorrupt: true,
    corruptStorageValue: raw,
    corruptStorageKey: V4_DATA_KEY,
  });

  assert.equal(setupResult.controller.backupBeforeReset(), true);
  setupResult.controller.removeAllStorageKeys(["draft"]);

  const recovery = JSON.parse(storage.getItem(CORRUPT_PAYLOAD_BACKUP_KEY));
  assert.equal(recovery.sourceKey, V4_DATA_KEY);
  assert.equal(recovery.raw, raw);
  assert.equal(storage.getItem(V4_DATA_KEY), null);
  assert.equal(storage.getItem("draft"), null);
  assert.notEqual(storage.getItem(CORRUPT_PAYLOAD_BACKUP_KEY), null);
});

test("führt alle unterstützten Datenversionen an einer zentralen Stelle", () => {
  assert.equal(DATA_STORAGE_KEYS.includes(V4_DATA_KEY), true);
  assert.equal(new Set(DATA_STORAGE_KEYS).size, DATA_STORAGE_KEYS.length);
});
