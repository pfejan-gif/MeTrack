import assert from "node:assert/strict";
import test from "node:test";

import {
  entryExerciseCompletion,
  entryExerciseValues,
  entryMetricValue,
  migrateDataEnvelope,
  migrateLegacyEntries,
  validateExerciseCatalog,
} from "../assets/core.js";
import {
  catalog,
  day,
  plank,
  plankMetric,
  pushups,
} from "./helpers/core-fixtures.mjs";

test("migriert v1-Einzelwerte verlustfrei in den allgemeinen Katalog", () => {
  const migrated = migrateLegacyEntries([
    {
      date: "2026-08-01",
      plank: 40,
      pushups: 10,
      squats: 20,
      weight: 82.4,
      waist: 95.1,
    },
  ]);
  assert.equal(migrated.schemaVersion, 6);
  assert.deepEqual(migrated.exercises, catalog);
  assert.deepEqual(entryExerciseValues(migrated.entries[0], plank.id), [40, null, null]);
  assert.deepEqual(entryExerciseValues(migrated.entries[0], pushups.id), [10, null, null]);
  assert.equal(migrated.entries[0].weight, 82.4);
});

test("migriert v2 mit drei Sätzen", () => {
  const migrated = migrateDataEnvelope({
    schemaVersion: 2,
    entries: [
      {
        date: "2026-08-02",
        plankSets: [42, 48, 45],
        pushupsSets: [12, 10, 8],
        squatsSets: [20, 18, 16],
      },
    ],
  });
  assert.deepEqual(entryExerciseValues(migrated.entries[0], plank.id), [42, 48, 45]);
  assert.equal(entryMetricValue(migrated.entries[0], plankMetric, catalog), 48);
});

test("migriert v3 mit Standard- und Zusatzübungen", () => {
  const situps = { id: "custom-situps", name: "Sit-Ups", kind: "reps", active: false };
  const migrated = migrateDataEnvelope({
    schemaVersion: 3,
    exercises: [situps],
    entries: [
      {
        date: "2026-08-03",
        plankSets: [50, 48, null],
        customSets: [{ exerciseId: situps.id, values: [20, 22, 18] }],
        weight: null,
        waist: null,
      },
    ],
  });
  assert.equal(migrated.exercises.length, 4);
  assert.equal(migrated.exercises[3].active, false);
  assert.deepEqual(entryExerciseValues(migrated.entries[0], situps.id), [20, 22, 18]);
});

test("macht Namenskonflikte bei der v3-Migration eindeutig", () => {
  const migrated = migrateDataEnvelope({
    schemaVersion: 3,
    exercises: [{ id: "custom-plank", name: "Plank", kind: "reps", active: true }],
    entries: [],
  });
  assert.equal(migrated.exercises[3].name, "Plank (2)");
});

test("erhält den maximalen v3-Katalog plus Standardübungen", () => {
  const exercises = Array.from({ length: 30 }, (_, index) => ({
    id: `custom-exercise-${String(index).padStart(2, "0")}`,
    name: `Übung ${index + 1}`,
    kind: "reps",
    active: true,
  }));
  const migrated = migrateDataEnvelope({ schemaVersion: 3, exercises, entries: [] });
  assert.equal(migrated.exercises.length, 33);
  assert.equal(validateExerciseCatalog(migrated.exercises).valid, true);
});

test("migriert v4-Einträge ohne erfundene Dehnungsstatus nach v6", () => {
  const migrated = migrateDataEnvelope({
    schemaVersion: 4,
    exercises: catalog,
    entries: [day("2026-08-04", { plank: [45, null, null] })],
  });
  assert.equal(migrated.schemaVersion, 6);
  assert.deepEqual(migrated.entries[0].exerciseChecks, []);
  assert.equal(entryMetricValue(migrated.entries[0], plankMetric, catalog), 45);
});

test("ergänzt bei der v5-Migration verlustfrei Standardsymbole", () => {
  const stretch = {
    id: "custom-hip-stretch",
    name: "Hüftbeuger",
    kind: "stretch",
    active: true,
    instructions: "30 Sekunden halten.",
  };
  const migrated = migrateDataEnvelope({
    schemaVersion: 5,
    exercises: [...catalog.map(({ icon, ...exercise }) => exercise), stretch],
    entries: [{
      date: "2026-08-08",
      exerciseSets: [],
      exerciseChecks: [{ exerciseId: stretch.id, completed: true }],
      weight: null,
      waist: null,
    }],
  });
  assert.equal(migrated.schemaVersion, 6);
  assert.equal(migrated.exercises[0].icon, "plank");
  assert.equal(migrated.exercises[3].icon, "stretch");
  assert.equal(entryExerciseCompletion(migrated.entries[0], stretch.id), true);
});

test("verlangt im v6-Dokument kanonische Symbole", () => {
  assert.throws(
    () => migrateDataEnvelope({
      schemaVersion: 6,
      exercises: catalog.map(({ icon, ...exercise }) => exercise),
      entries: [],
    }),
    /Übungskatalog ist ungültig/,
  );
});

