import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateStreak,
  changeFromPrevious,
  createDataEnvelope,
  entryExerciseCompletion,
  entryExerciseValues,
  entryMetricValue,
  exerciseCompletionSummary,
  exerciseMetricKey,
  exerciseUsageCount,
  mergeEntries,
  normalizeEntries,
  removeEntry,
  removeExerciseFromEntries,
  todayLocal,
  upsertEntry,
  validateEntry,
} from "../assets/core.js";
import {
  catalog,
  day,
  plank,
  plankMetric,
  pushups,
  pushupsMetric,
} from "./helpers/core-fixtures.mjs";

test("speichert drei Sätze und nutzt den Tagesbestwert", () => {
  const entry = day("2026-08-04", { plank: [42, 48, 45] });
  const validation = validateEntry(entry, catalog);
  assert.equal(validation.valid, true);
  assert.deepEqual(entryExerciseValues(validation.entry, plank.id), [42, 48, 45]);
  assert.equal(entryMetricValue(validation.entry, plankMetric, catalog), 48);
});

test("weist ungültige Daten, Grenzen, Bruchteile und leere Einträge zurück", () => {
  assert.equal(validateEntry(day("2026-02-30", { plank: [45, null, null] }), catalog).valid, false);
  const outOfRange = validateEntry(day("2026-08-04", { plank: [90_000, null, null] }), catalog);
  assert.match(outOfRange.errors[`${plank.id}-set-1`], /0–86400/);
  const fraction = validateEntry(day("2026-08-04", { pushups: [1.5, null, null] }), catalog);
  assert.match(fraction.errors[`${pushups.id}-set-1`], /Ganze Zahl/);
  assert.equal(validateEntry(day("2026-08-04"), catalog).valid, false);
});

test("normalisiert, sortiert und dedupliziert Trainingstage", () => {
  const entries = normalizeEntries([
    day("2026-08-03", { plank: [30, null, null] }),
    day("2026-08-01", { plank: [20, null, null] }),
    day("2026-08-03", { pushups: [10, null, null] }),
  ], catalog);
  assert.deepEqual(entries.map((entry) => entry.date), ["2026-08-01", "2026-08-03"]);
  assert.equal(entryMetricValue(entries[1], plankMetric, catalog), 30);
  assert.equal(entryMetricValue(entries[1], pushupsMetric, catalog), 10);
});

test("legt Einträge an, ersetzt sie explizit und löscht sie", () => {
  const added = upsertEntry([], day("2026-08-01", { plank: [40, null, null] }), null, catalog);
  const replaced = upsertEntry(added, day("2026-08-01", { plank: [65, null, null] }), "2026-08-01", catalog);
  assert.equal(entryMetricValue(replaced[0], plankMetric, catalog), 65);
  assert.deepEqual(removeEntry(replaced, "2026-08-01", catalog), []);
  assert.deepEqual(
    upsertEntry(
      removeEntry(replaced, "2026-08-01", catalog),
      replaced[0],
      null,
      catalog,
    ),
    replaced,
  );
});

test("berechnet Veränderung und Tages-Serie", () => {
  const entries = [
    day("2026-08-06", { plank: [40, null, null] }),
    day("2026-08-07", { plank: [50, null, null] }),
    day("2026-08-08", { pushups: [10, null, null] }),
  ];
  assert.equal(changeFromPrevious(entries, plankMetric, catalog), 10);
  assert.equal(calculateStreak(entries, "2026-08-08", catalog), 3);
});

test("verwendet lokale statt UTC-Datumsgrenzen", () => {
  assert.equal(todayLocal(new Date("2026-08-08T23:30:00-02:00")), "2026-08-09");
});

test("deaktivieren ändert den Katalog, behält aber sämtliche Werte", () => {
  const entries = [day("2026-08-05", { plank: [40, 45, 43] })];
  const inactive = catalog.map((exercise) =>
    exercise.id === plank.id ? { ...exercise, active: false } : exercise,
  );
  const envelope = createDataEnvelope(entries, inactive);
  assert.equal(envelope.exercises[0].active, false);
  assert.deepEqual(entryExerciseValues(envelope.entries[0], plank.id), [40, 45, 43]);
});

test("ganz löschen entfernt Übung und historische Werte", () => {
  const entries = [
    day("2026-08-05", { plank: [40, 45, 43], pushups: [12, null, null] }),
    day("2026-08-06", { plank: [50, null, null] }),
    day("2026-08-07", { plank: [60, null, null], weight: 82 }),
  ];
  const remaining = catalog.filter((exercise) => exercise.id !== plank.id);
  const stripped = removeExerciseFromEntries(entries, plank.id, remaining);
  assert.equal(stripped.length, 2);
  assert.equal(stripped.some((entry) => entry.date === "2026-08-06"), false);
  assert.equal(stripped.find((entry) => entry.date === "2026-08-07").weight, 82);
  assert.equal(exerciseUsageCount(entries, plank.id), 3);
});

test("speichert Dehnungsstatus und zählt ausschließlich Durchführungen", () => {
  const stretch = {
    id: "custom-hip-stretch",
    name: "Hüftbeuger",
    kind: "stretch",
    active: true,
    instructions: "30 Sekunden pro Seite halten.",
  };
  const exercises = [...catalog, stretch];
  const entries = [
    {
      date: "2026-08-05",
      exerciseSets: [],
      exerciseChecks: [{ exerciseId: stretch.id, completed: true }],
      weight: null,
      waist: null,
    },
    {
      ...day("2026-08-06", { pushups: [10, null, null] }),
      exerciseChecks: [{ exerciseId: stretch.id, completed: false }],
    },
    {
      date: "2026-08-07",
      exerciseSets: [],
      exerciseChecks: [{ exerciseId: stretch.id, completed: true }],
      weight: null,
      waist: null,
    },
    {
      date: "2026-08-08",
      exerciseSets: [],
      exerciseChecks: [{ exerciseId: stretch.id, completed: true }],
      weight: null,
      waist: null,
    },
  ];
  const normalized = normalizeEntries(entries, exercises);
  assert.equal(entryExerciseCompletion(normalized[1], stretch.id), false);
  assert.equal(
    entryMetricValue(normalized[1], exerciseMetricKey(stretch.id), exercises),
    null,
  );
  assert.deepEqual(
    exerciseCompletionSummary(normalized, stretch.id, exercises),
    { completed: 3 },
  );
  assert.equal(
    validateEntry({
      date: "2026-08-08",
      exerciseSets: [],
      exerciseChecks: [{ exerciseId: stretch.id, completed: false }],
    }, exercises).valid,
    false,
  );
});

test("weist Werte unbekannter Übungen zurück", () => {
  const validation = validateEntry({
    date: "2026-08-05",
    exerciseSets: [{ exerciseId: "custom-unknown", values: [10, null, null] }],
  }, catalog);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.exerciseSets, /Übungskatalog/);
});

test("führt Teilsätze ohne Datenverlust zusammen", () => {
  const current = [day("2026-08-05", { plank: [40, 45, 43], pushups: [12, 10, 8], weight: 82 })];
  const incoming = [day("2026-08-05", { plank: [null, 50, null] })];
  const merged = mergeEntries(current, incoming, catalog);
  assert.deepEqual(entryExerciseValues(merged[0], plank.id), [40, 50, 43]);
  assert.deepEqual(entryExerciseValues(merged[0], pushups.id), [12, 10, 8]);
  assert.equal(merged[0].weight, 82);
});

test("führt einen expliziten Dehnungsstatus beim Import deterministisch zusammen", () => {
  const stretch = {
    id: "custom-hip-stretch",
    name: "Hüftbeuger",
    kind: "stretch",
    active: true,
    instructions: "30 Sekunden halten.",
  };
  const exercises = [...catalog, stretch];
  const current = [{
    ...day("2026-08-05", { pushups: [10, null, null] }),
    exerciseChecks: [{ exerciseId: stretch.id, completed: true }],
  }];
  const incoming = [{
    ...day("2026-08-05", { plank: [40, null, null] }),
    exerciseChecks: [{ exerciseId: stretch.id, completed: false }],
  }];
  const merged = mergeEntries(current, incoming, exercises);
  assert.equal(entryExerciseCompletion(merged[0], stretch.id), false);
  assert.equal(entryMetricValue(merged[0], pushupsMetric, exercises), 10);
});
