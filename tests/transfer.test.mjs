import assert from "node:assert/strict";
import test from "node:test";

import {
  BACKUP_VERSION,
  DATA_SCHEMA_VERSION,
  MAX_BACKUP_ENTRIES,
  createBackup,
  entriesToCsv,
  entryExerciseCompletion,
  entryExerciseValues,
  parseBackup,
} from "../assets/core.js";
import {
  catalog,
  day,
  plank,
} from "./helpers/core-fixtures.mjs";

test("erstellt Excel-freundliches CSV für alle Übungen", () => {
  const stretch = {
    id: "custom-hip-stretch",
    name: "Hüftbeuger",
    kind: "stretch",
    active: true,
    instructions: "30 Sekunden halten.",
  };
  const csv = entriesToCsv([{
    ...day("2026-08-05", { plank: [40, 45, 43], weight: 82.4 }),
    exerciseChecks: [{ exerciseId: stretch.id, completed: true }],
  }], [...catalog, stretch]);
  assert.equal(csv.startsWith("\ufeff"), true);
  assert.match(csv, /Plank Sekunden Satz 1/);
  assert.match(csv, /Liegestütze Wiederholungen Satz 3/);
  assert.match(csv, /Hüftbeuger durchgeführt/);
  assert.match(csv, /;Ja;/);
  assert.match(csv, /82,4/);
});

test("exportiert und importiert eine v6-Sicherung verlustfrei", () => {
  const situps = { id: "custom-situps", name: "Sit-Ups", kind: "reps", icon: "sit-up", active: false };
  const stretch = {
    id: "custom-hip-stretch",
    name: "Hüftbeuger",
    kind: "stretch",
    icon: "hip-stretch",
    active: true,
    instructions: "30 Sekunden pro Seite halten.",
  };
  const exercises = [...catalog, situps, stretch];
  const entries = [{
    date: "2026-08-05",
    exerciseSets: [{ exerciseId: situps.id, values: [20, 24, 22] }],
    exerciseChecks: [{ exerciseId: stretch.id, completed: false }],
    weight: null,
    waist: null,
  }];
  const backup = createBackup(entries, exercises, { theme: "dark" });
  const restored = parseBackup(JSON.stringify(backup));
  assert.equal(backup.version, BACKUP_VERSION);
  assert.equal(backup.schemaVersion, DATA_SCHEMA_VERSION);
  assert.deepEqual(restored.exercises, exercises);
  assert.deepEqual(entryExerciseValues(restored.entries[0], situps.id), [20, 24, 22]);
  assert.equal(entryExerciseCompletion(restored.entries[0], stretch.id), false);
  assert.equal(restored.settings.theme, "dark");
});

test("migriert alte Sicherungen beim Import", () => {
  const restored = parseBackup(JSON.stringify({
    app: "MeTrack",
    version: 2,
    entries: [{ date: "2026-08-05", plankSets: [40, null, null] }],
  }));
  assert.deepEqual(restored.exercises, catalog);
  assert.deepEqual(entryExerciseValues(restored.entries[0], plank.id), [40, null, null]);
});

test("weist ungültige und zukünftige Sicherungsformate zurück", () => {
  assert.throws(() => parseBackup("kein json"), /gültiges JSON/);
  assert.throws(() => parseBackup(JSON.stringify({ app: "MeTrack", version: BACKUP_VERSION + 1, entries: [] })), /neueren/);
  assert.throws(() => parseBackup(JSON.stringify({
    app: "MeTrack",
    version: 4,
    exercises: catalog,
    entries: [day("2999-01-01", { plank: [10, null, null] })],
  })), /ungültig/);
});

test("weist übergroße Sicherungen vor der Verarbeitung zurück", () => {
  const entries = Array.from({ length: MAX_BACKUP_ENTRIES + 1 }, (_, index) => ({ date: `2025-01-${String((index % 28) + 1).padStart(2, "0")}` }));
  assert.throws(() => parseBackup(JSON.stringify({ app: "MeTrack", version: 4, exercises: catalog, entries })), /mehr als/);
});

