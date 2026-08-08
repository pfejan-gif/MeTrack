import assert from "node:assert/strict";
import test from "node:test";

import {
  BACKUP_VERSION,
  DATA_SCHEMA_VERSION,
  calculateStreak,
  changeFromFirst,
  changeFromPrevious,
  createBackup,
  customExerciseValues,
  customMetricKey,
  entryMetricValue,
  entriesToCsv,
  hasMeasurement,
  mergeEntries,
  mergeExerciseCatalog,
  normalizeEntries,
  parseBackup,
  parseNumber,
  removeEntry,
  sanitizeEntry,
  sanitizeCustomExercises,
  setsKey,
  todayLocal,
  upsertEntry,
  validateEntry,
  validateCustomExercise,
  validateExerciseCatalog,
} from "../assets/core.js";

const entries = [
  {
    date: "2026-08-01",
    plank: 40,
    pushups: 10,
    squats: 20,
    weight: 82.4,
    waist: 96.2,
  },
  {
    date: "2026-08-02",
    plank: 45,
    pushups: 12,
    squats: 24,
    weight: 82.1,
    waist: 95.8,
  },
  {
    date: "2026-08-03",
    plank: 55,
    pushups: 14,
    squats: 28,
    weight: 81.9,
    waist: 95.5,
  },
];

test("parst deutsche Dezimalzahlen und leere Werte", () => {
  assert.equal(parseNumber("82,5"), 82.5);
  assert.equal(parseNumber(" 12 "), 12);
  assert.equal(parseNumber(""), null);
  assert.equal(parseNumber("abc"), null);
});

test("übernimmt das vorhandene v1-Datenformat ohne Datenverlust", () => {
  const sanitized = sanitizeEntry(entries[0]);
  assert.equal(sanitized.plank, 40);
  assert.deepEqual(sanitized.plankSets, [40, null, null]);
  assert.deepEqual(sanitized.pushupsSets, [10, null, null]);
  assert.deepEqual(sanitized.squatsSets, [20, null, null]);
  assert.equal(sanitized.weight, 82.4);
  assert.equal(sanitized.waist, 96.2);
  assert.equal(hasMeasurement(sanitized), true);
});

test("speichert drei Sätze und verwendet den Tagesbestwert als Hauptmetrik", () => {
  const sanitized = sanitizeEntry({
    date: "2026-08-08",
    plank1: "42",
    plank2: "48",
    plank3: "45",
    pushupsSets: [12, 10, 8, 99],
    squatsSets: [0, null],
  });
  assert.deepEqual(sanitized.plankSets, [42, 48, 45]);
  assert.equal(sanitized.plank, 48);
  assert.deepEqual(sanitized.pushupsSets, [12, 10, 8]);
  assert.equal(sanitized.pushups, 12);
  assert.deepEqual(sanitized.squatsSets, [0, null, null]);
  assert.equal(sanitized.squats, 0);
});

test("weist ungültiges Datum, Grenzwerte und leere Einträge zurück", () => {
  const invalidDate = validateEntry({ date: "2026-02-30", plank: "45" });
  assert.equal(invalidDate.valid, false);
  assert.match(invalidDate.errors.date, /gültiges Datum/);

  const invalidWeight = validateEntry({ date: "2026-08-01", weight: "900" });
  assert.equal(invalidWeight.valid, false);
  assert.match(invalidWeight.errors.weight, /20 bis 400/);

  const empty = validateEntry({ date: "2026-08-01", plank: "", weight: "" });
  assert.equal(empty.valid, false);
  assert.match(empty.errors.form, /mindestens einen/);

  const invalidSet = validateEntry({
    date: "2026-08-01",
    plank1: "45",
    plank2: "9999",
  });
  assert.equal(invalidSet.valid, false);
  assert.match(invalidSet.errors.plank2, /0–3600/);

  const fractionalRepetitions = validateEntry({
    date: "2026-08-01",
    pushups1: "1,5",
  });
  assert.equal(fractionalRepetitions.valid, false);
  assert.match(fractionalRepetitions.errors.pushups1, /Ganze Zahl/);
});

test("normalisiert, sortiert und dedupliziert Einträge", () => {
  const normalized = normalizeEntries([
    entries[2],
    entries[0],
    entries[1],
    entries[1],
    { nope: true },
  ]);
  assert.equal(normalized.length, 3);
  assert.deepEqual(
    normalized.map((entry) => entry.date),
    ["2026-08-01", "2026-08-02", "2026-08-03"],
  );
});

test("legt Einträge an, ersetzt sie explizit und löscht sie", () => {
  const added = upsertEntry(entries, {
    date: "2026-08-04",
    plank: 60,
    pushups: null,
    squats: null,
    weight: null,
    waist: null,
  });
  assert.equal(added.length, 4);

  const moved = upsertEntry(
    added,
    { ...added[3], date: "2026-08-05", plankSets: [65, null, null] },
    "2026-08-04",
  );
  assert.equal(
    moved.some((entry) => entry.date === "2026-08-04"),
    false,
  );
  assert.equal(moved.at(-1).plank, 65);

  const removed = removeEntry(moved, "2026-08-05");
  assert.equal(removed.length, 3);
});

test("berechnet Veränderungen korrekt", () => {
  assert.equal(changeFromPrevious(entries, "plank"), 10);
  assert.ok(Math.abs(changeFromFirst(entries, "weight") + 0.5) < 1e-9);
});

test("berechnet Tages-Serien relativ zu heute", () => {
  assert.equal(calculateStreak(entries, "2026-08-03"), 3);
  assert.equal(calculateStreak(entries, "2026-08-04"), 3);
  assert.equal(calculateStreak(entries, "2026-08-05"), 0);
  assert.equal(
    calculateStreak(
      [...entries, { ...entries[0], date: "2026-08-10" }],
      "2026-08-03",
    ),
    3,
  );
});

test("verwendet lokale statt UTC-Datumsgrenzen", () => {
  const localDate = new Date("2026-08-08T00:30:00+02:00");
  const expected = new Date(
    localDate.getTime() - localDate.getTimezoneOffset() * 60_000,
  )
    .toISOString()
    .slice(0, 10);
  assert.equal(todayLocal(localDate), expected);
});

test("erstellt Excel-freundliches CSV", () => {
  const csv = entriesToCsv(entries.slice(0, 1));
  assert.equal(
    csv.startsWith("\ufeffDatum;Plank Sekunden Satz 1;Plank Sekunden Satz 2;"),
    true,
  );
  assert.match(csv, /2026-08-01;40;;;40;10;;;10;20;;;20;82,4;96,2/);
});

test("exportiert und importiert eine versionierte Sicherung verlustfrei", () => {
  const backup = createBackup(entries, { theme: "dark" });
  const restored = parseBackup(JSON.stringify(backup));
  assert.equal(backup.version, BACKUP_VERSION);
  assert.deepEqual(restored.entries, normalizeEntries(entries));
  assert.deepEqual(restored.entries[0][setsKey("plank")], [40, null, null]);
  assert.equal(restored.settings.theme, "dark");
});

test("weist ungültige und zukünftige Sicherungsformate zurück", () => {
  assert.throws(() => parseBackup("kein json"), /gültiges JSON/);
  assert.throws(
    () => parseBackup(JSON.stringify({ app: "AndereApp", entries: [] })),
    /keine gültige MeTrack/,
  );
  assert.throws(
    () =>
      parseBackup(
        JSON.stringify({
          app: "MeTrack",
          version: BACKUP_VERSION + 1,
          entries: [],
        }),
      ),
    /neueren MeTrack-Version/,
  );
  assert.throws(
    () => parseBackup(JSON.stringify({ app: "MeTrack", entries: [] })),
    /keine unterstützte Version/,
  );
  assert.throws(
    () =>
      parseBackup(
        JSON.stringify({
          app: "MeTrack",
          version: BACKUP_VERSION,
          entries: [{ date: "2999-01-01", plank: 10 }],
        }),
      ),
    /ungültig/,
  );
});

test("führt Sicherungen deterministisch zusammen; Import gewinnt bei gleichem Datum", () => {
  const imported = [
    { ...entries[1], plank: 99 },
    { ...entries[2], date: "2026-08-04" },
  ];
  const merged = mergeEntries(entries, imported);
  assert.equal(merged.length, 4);
  assert.equal(merged.find((entry) => entry.date === "2026-08-02").plank, 99);
});

test("Teilimporte behalten nicht gelieferte Sätze und Körperwerte", () => {
  const current = [
    {
      date: "2026-08-08",
      plankSets: [40, 45, 43],
      pushupsSets: [12, 10, 8],
      squatsSets: [20, 18, 16],
      weight: 82.4,
      waist: 96.2,
    },
  ];
  const merged = mergeEntries(current, [
    { date: "2026-08-08", plankSets: [null, 50, null] },
  ]);
  assert.deepEqual(merged[0].plankSets, [40, 50, 43]);
  assert.deepEqual(merged[0].pushupsSets, [12, 10, 8]);
  assert.equal(merged[0].weight, 82.4);
});

test("weist übergroße Sicherungen vor der Verarbeitung zurück", () => {
  const oversized = {
    app: "MeTrack",
    version: BACKUP_VERSION,
    entries: Array.from({ length: 5001 }, (_, index) => ({
      date: `2026-01-${String((index % 28) + 1).padStart(2, "0")}`,
      plank: 10,
    })),
  };
  assert.throws(() => parseBackup(JSON.stringify(oversized)), /mehr als 5000/);
});

const customExercises = [
  {
    id: "custom-situps",
    name: "Sit-Ups",
    kind: "reps",
    active: true,
  },
  {
    id: "custom-wandsitz",
    name: "Wandsitz",
    kind: "seconds",
    active: false,
  },
];

test("validiert eigene Übungen und verhindert doppelte Namen", () => {
  const situps = validateCustomExercise(customExercises[0]);
  assert.equal(situps.valid, true);
  assert.equal(situps.exercise.name, "Sit-Ups");

  assert.equal(
    validateCustomExercise({ ...customExercises[0], kind: "meter" }).valid,
    false,
  );
  assert.equal(
    validateExerciseCatalog([
      customExercises[0],
      { ...customExercises[1], name: "sit-ups" },
    ]).valid,
    false,
  );
  assert.deepEqual(sanitizeCustomExercises(customExercises), customExercises);
});

test("speichert drei Sätze eigener Übungen und berechnet den Tagesbestwert", () => {
  const raw = {
    date: "2026-08-08",
    customSets: [
      { exerciseId: "custom-situps", values: [20, 24, 22] },
      { exerciseId: "custom-wandsitz", values: [80, null, 100] },
    ],
  };
  const validation = validateEntry(raw, customExercises);
  assert.equal(validation.valid, true);
  assert.deepEqual(
    customExerciseValues(validation.entry, "custom-situps"),
    [20, 24, 22],
  );
  assert.equal(
    entryMetricValue(
      validation.entry,
      customMetricKey("custom-situps"),
      customExercises,
    ),
    24,
  );
  assert.equal(
    entryMetricValue(
      validation.entry,
      customMetricKey("custom-wandsitz"),
      customExercises,
    ),
    100,
  );
});

test("weist Dezimalwerte und unbekannte eigene Übungen zurück", () => {
  const fractional = validateEntry(
    {
      date: "2026-08-08",
      customSets: [
        { exerciseId: "custom-situps", values: ["20,5", null, null] },
      ],
    },
    customExercises,
  );
  assert.equal(fractional.valid, false);
  assert.match(fractional.errors["custom-situps-set-1"], /Ganze Zahl/);

  const unknown = validateEntry(
    {
      date: "2026-08-08",
      customSets: [
        { exerciseId: "custom-unbekannt", values: [10, null, null] },
      ],
    },
    customExercises,
  );
  assert.equal(unknown.valid, false);
  assert.match(unknown.errors.customSets, /Übungskatalog/);
});

test("führt Teilsätze eigener Übungen ohne Datenverlust zusammen", () => {
  const current = [
    {
      date: "2026-08-08",
      customSets: [{ exerciseId: "custom-situps", values: [20, 18, 15] }],
    },
  ];
  const imported = [
    {
      date: "2026-08-08",
      customSets: [{ exerciseId: "custom-situps", values: [null, 25, null] }],
    },
  ];
  const merged = mergeEntries(current, imported, customExercises);
  assert.deepEqual(
    customExerciseValues(merged[0], "custom-situps"),
    [20, 25, 15],
  );
});

test("zählt Tage mit ausschließlich eigenen Übungen für die Serie", () => {
  const customOnly = [
    {
      date: "2026-08-07",
      customSets: [{ exerciseId: "custom-situps", values: [20, null, null] }],
    },
    {
      date: "2026-08-08",
      customSets: [{ exerciseId: "custom-situps", values: [22, null, null] }],
    },
  ];
  assert.equal(calculateStreak(customOnly, "2026-08-08", customExercises), 2);
});

test("sichert eigene Übungen in v3 und migriert v2-Sicherungen", () => {
  const customEntries = [
    {
      date: "2026-08-08",
      customSets: [{ exerciseId: "custom-wandsitz", values: [90, 100, null] }],
    },
  ];
  const backup = createBackup(customEntries, customExercises, {
    theme: "dark",
  });
  const restored = parseBackup(JSON.stringify(backup));
  assert.equal(backup.version, BACKUP_VERSION);
  assert.equal(backup.schemaVersion, DATA_SCHEMA_VERSION);
  assert.deepEqual(restored.exercises, customExercises);
  assert.deepEqual(
    customExerciseValues(restored.entries[0], "custom-wandsitz"),
    [90, 100, null],
  );

  const restoredV2 = parseBackup(
    JSON.stringify({ app: "MeTrack", version: 2, entries }),
  );
  assert.deepEqual(restoredV2.exercises, []);
  assert.deepEqual(restoredV2.entries, normalizeEntries(entries));
});

test("exportiert eigene Übungen verlustfrei ins CSV", () => {
  const csv = entriesToCsv(
    [
      {
        date: "2026-08-08",
        customSets: [
          { exerciseId: "custom-situps", values: [20, 18, null] },
          { exerciseId: "custom-wandsitz", values: [90, 100, 95] },
        ],
      },
    ],
    customExercises,
  );
  assert.match(csv, /Sit-Ups Wiederholungen Satz 1/);
  assert.match(csv, /Wandsitz Sekunden Bestwert/);
  assert.match(csv, /20;18;;20;90;100;95;100/);
});

test("führt Übungskataloge sicher zusammen und erkennt Typkonflikte", () => {
  const merged = mergeExerciseCatalog(
    [{ ...customExercises[0], active: false }],
    customExercises,
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[0].active, true);

  assert.throws(
    () =>
      mergeExerciseCatalog(customExercises, [
        { ...customExercises[0], kind: "seconds" },
      ]),
    /Typkonflikt/,
  );
});
