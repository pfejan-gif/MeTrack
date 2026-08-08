import assert from "node:assert/strict";
import test from "node:test";

import {
  BACKUP_VERSION,
  DATA_SCHEMA_VERSION,
  DEFAULT_EXERCISES,
  MAX_BACKUP_ENTRIES,
  calculateStreak,
  changeFromPrevious,
  createBackup,
  createDataEnvelope,
  entriesToCsv,
  entryExerciseValues,
  entryMetricValue,
  exerciseMetricKey,
  exerciseUsageCount,
  formatNumber,
  mergeEntries,
  mergeExerciseCatalog,
  migrateDataEnvelope,
  migrateLegacyEntries,
  normalizeEntries,
  parseBackup,
  parseNumber,
  removeEntry,
  removeExerciseFromEntries,
  sanitizeExerciseCatalog,
  todayLocal,
  upsertEntry,
  validateEntry,
  validateExercise,
  validateExerciseCatalog,
} from "../assets/core.js";

const catalog = DEFAULT_EXERCISES.map((exercise) => ({ ...exercise }));
const [plank, pushups, squats] = catalog;
const plankMetric = exerciseMetricKey(plank.id);
const pushupsMetric = exerciseMetricKey(pushups.id);

const day = (date, values = {}) => ({
  date,
  exerciseSets: [
    values.plank && { exerciseId: plank.id, values: values.plank },
    values.pushups && { exerciseId: pushups.id, values: values.pushups },
    values.squats && { exerciseId: squats.id, values: values.squats },
  ].filter(Boolean),
  weight: values.weight ?? null,
  waist: values.waist ?? null,
});

test("parst deutsche Dezimalzahlen und leere Werte", () => {
  assert.equal(parseNumber("82,4"), 82.4);
  assert.equal(parseNumber(" 95.1 "), 95.1);
  assert.equal(parseNumber(""), null);
  assert.equal(formatNumber(82.4, 1), "82,4");
});

test("behandelt die drei bisherigen Übungen als normalen Übungskatalog", () => {
  assert.deepEqual(
    catalog.map(({ name, kind, active }) => ({ name, kind, active })),
    [
      { name: "Plank", kind: "seconds", active: true },
      { name: "Liegestütze", kind: "reps", active: true },
      { name: "Kniebeugen", kind: "reps", active: true },
    ],
  );
  assert.equal(validateExerciseCatalog(catalog).valid, true);
});

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
  assert.equal(migrated.schemaVersion, 4);
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

test("validiert neue Übungen und verhindert doppelte Namen", () => {
  const situps = validateExercise({ id: "custom-situps", name: " Sit-Ups ", kind: "reps", active: true });
  assert.equal(situps.valid, true);
  assert.equal(situps.exercise.name, "Sit-Ups");
  assert.equal(validateExercise({ ...situps.exercise, kind: "meter" }).valid, false);
  assert.equal(validateExerciseCatalog([situps.exercise, { ...situps.exercise, id: "custom-situps-2", name: "sit-ups" }]).valid, false);
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

test("erstellt Excel-freundliches CSV für alle Übungen", () => {
  const csv = entriesToCsv([day("2026-08-05", { plank: [40, 45, 43], weight: 82.4 })], catalog);
  assert.equal(csv.startsWith("\ufeff"), true);
  assert.match(csv, /Plank Sekunden Satz 1/);
  assert.match(csv, /Liegestütze Wiederholungen Satz 3/);
  assert.match(csv, /82,4/);
});

test("exportiert und importiert eine v4-Sicherung verlustfrei", () => {
  const situps = { id: "custom-situps", name: "Sit-Ups", kind: "reps", active: false };
  const exercises = [...catalog, situps];
  const entries = [{
    date: "2026-08-05",
    exerciseSets: [{ exerciseId: situps.id, values: [20, 24, 22] }],
    weight: null,
    waist: null,
  }];
  const backup = createBackup(entries, exercises, { theme: "dark" });
  const restored = parseBackup(JSON.stringify(backup));
  assert.equal(backup.version, BACKUP_VERSION);
  assert.equal(backup.schemaVersion, DATA_SCHEMA_VERSION);
  assert.deepEqual(restored.exercises, exercises);
  assert.deepEqual(entryExerciseValues(restored.entries[0], situps.id), [20, 24, 22]);
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

test("führt Übungskataloge sicher zusammen und erkennt Typkonflikte", () => {
  const situps = { id: "custom-situps", name: "Sit-Ups", kind: "reps", active: false };
  const merged = mergeExerciseCatalog(catalog, [situps]);
  assert.equal(merged.length, 4);
  assert.throws(() => mergeExerciseCatalog([...catalog, situps], [{ ...situps, kind: "seconds" }]), /Typkonflikt/);
});

test("sanitisiert Kataloge deterministisch", () => {
  const situps = { id: "custom-situps", name: "Sit-Ups", kind: "reps", active: true };
  assert.deepEqual(sanitizeExerciseCatalog([situps, { ...situps }]), [situps]);
});
