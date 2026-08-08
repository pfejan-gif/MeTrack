import {
  BACKUP_VERSION,
  BODY_METRIC_KEYS,
  DATA_SCHEMA_VERSION,
  DEFAULT_EXERCISES,
  MAX_BACKUP_ENTRIES,
  MAX_EXERCISES,
  METRICS,
  SET_COUNT,
} from "./constants.js";
import {
  exerciseDefinition,
  exerciseMetricKey,
  sanitizeExerciseCatalog,
  validateExerciseCatalog,
} from "./exercises.js";
import {
  entryExerciseCompletion,
  mergeDayEntries,
  normalizeEntries,
  rawExerciseValues,
} from "./entries.js";
import { entryMetricValue } from "./statistics.js";
import {
  migrateDataEnvelope,
  migrateLegacyEntries,
} from "./migrations.js";

function csvCell(value) {
  const string = String(value ?? "");
  return /[;"\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}

function csvNumber(value, decimals = 0) {
  if (value === null || value === undefined) return "";
  return decimals > 0
    ? Number(value).toFixed(decimals).replace(".", ",")
    : String(value);
}

export function entriesToCsv(entries, exercises = DEFAULT_EXERCISES) {
  const catalog = sanitizeExerciseCatalog(exercises);
  const header = [
    "Datum",
    ...catalog.flatMap((exercise) => {
      const definition = exerciseDefinition(exercise);
      if (definition.completion) return [definition.csvLabel];
      return [
        ...Array.from(
          { length: SET_COUNT },
          (_, index) => `${definition.csvLabel} Satz ${index + 1}`,
        ),
        `${definition.csvLabel} Bestwert`,
      ];
    }),
    ...BODY_METRIC_KEYS.map((key) => METRICS[key].csvLabel),
  ];
  const lines = normalizeEntries(entries, catalog).map((entry) => [
    entry.date,
    ...catalog.flatMap((exercise) => {
      if (exercise.kind === "stretch") {
        const completed = entryExerciseCompletion(entry, exercise.id);
        return [completed === null ? "" : completed ? "Ja" : "Nein"];
      }
      const values = rawExerciseValues(entry, exercise.id);
      const best = entryMetricValue(
        entry,
        exerciseMetricKey(exercise.id),
        catalog,
      );
      return [...values.map((value) => csvNumber(value)), csvNumber(best)];
    }),
    ...BODY_METRIC_KEYS.map((key) =>
      csvNumber(entry[key], METRICS[key].decimals),
    ),
  ]);
  return `\ufeff${[header, ...lines].map((row) => row.map(csvCell).join(";")).join("\n")}`;
}

export function createBackup(entries, exercisesOrSettings = [], settings = {}) {
  const hasExerciseArray = Array.isArray(exercisesOrSettings);
  const exercises = hasExerciseArray
    ? sanitizeExerciseCatalog(exercisesOrSettings)
    : DEFAULT_EXERCISES.map((exercise) => ({ ...exercise }));
  const resolvedSettings = hasExerciseArray ? settings : exercisesOrSettings;
  return {
    app: "MeTrack",
    version: BACKUP_VERSION,
    schemaVersion: DATA_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    exercises,
    entries: normalizeEntries(entries, exercises),
    settings: {
      theme: ["system", "light", "dark"].includes(resolvedSettings?.theme)
        ? resolvedSettings.theme
        : "system",
    },
  };
}

export function parseBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Die Datei enthält kein gültiges JSON.");
  }
  if (!parsed || parsed.app !== "MeTrack" || !Array.isArray(parsed.entries))
    throw new Error("Das ist keine gültige MeTrack-Sicherung.");
  if (!Number.isInteger(parsed.version) || parsed.version < 1)
    throw new Error("Die MeTrack-Sicherung hat keine unterstützte Version.");
  if (parsed.entries.length > MAX_BACKUP_ENTRIES)
    throw new Error(`Die Sicherung enthält mehr als ${MAX_BACKUP_ENTRIES} Einträge.`);
  if (parsed.version > BACKUP_VERSION)
    throw new Error("Diese Sicherung wurde mit einer neueren MeTrack-Version erstellt.");

  let migrated;
  if (parsed.version >= 6) {
    migrated = migrateDataEnvelope({
      schemaVersion: 6,
      exercises: parsed.exercises,
      entries: parsed.entries,
    });
  } else if (parsed.version === 5) {
    migrated = migrateDataEnvelope({
      schemaVersion: 5,
      exercises: parsed.exercises,
      entries: parsed.entries,
    });
  } else if (parsed.version === 4) {
    migrated = migrateDataEnvelope({
      schemaVersion: 4,
      exercises: parsed.exercises,
      entries: parsed.entries,
    });
  } else if (parsed.version === 3) {
    migrated = migrateDataEnvelope({
      schemaVersion: 3,
      exercises: parsed.exercises,
      entries: parsed.entries,
    });
  } else {
    migrated = migrateLegacyEntries(parsed.entries);
  }
  return {
    entries: migrated.entries,
    exercises: migrated.exercises,
    settings:
      parsed.settings && typeof parsed.settings === "object"
        ? parsed.settings
        : {},
    exportedAt: parsed.exportedAt ?? null,
  };
}

export function mergeExerciseCatalog(currentExercises, importedExercises) {
  if (
    !validateExerciseCatalog(currentExercises).valid ||
    !validateExerciseCatalog(importedExercises).valid
  )
    throw new Error("Der Übungskatalog ist ungültig.");
  const merged = sanitizeExerciseCatalog(currentExercises);
  const byId = new Map(merged.map((exercise) => [exercise.id, exercise]));
  const names = new Map(
    merged.map((exercise) => [
      exercise.name.toLocaleLowerCase("de-DE"),
      exercise,
    ]),
  );
  for (const incoming of sanitizeExerciseCatalog(importedExercises)) {
    const current = byId.get(incoming.id);
    if (current) {
      if (current.kind !== incoming.kind)
        throw new Error(`Die Übung „${incoming.name}“ hat einen Typkonflikt.`);
      if (!current.active && incoming.active) current.active = true;
      if (
        current.kind === "stretch" &&
        !current.instructions &&
        incoming.instructions
      )
        current.instructions = incoming.instructions;
      continue;
    }
    if (names.has(incoming.name.toLocaleLowerCase("de-DE")))
      throw new Error(`Die Übung „${incoming.name}“ ist bereits vorhanden.`);
    if (merged.length >= MAX_EXERCISES)
      throw new Error(`Es sind höchstens ${MAX_EXERCISES} Übungen möglich.`);
    merged.push({ ...incoming });
    byId.set(incoming.id, incoming);
    names.set(incoming.name.toLocaleLowerCase("de-DE"), incoming);
  }
  return merged;
}

export function mergeEntries(
  currentEntries,
  importedEntries,
  exercises = DEFAULT_EXERCISES,
) {
  const catalog = sanitizeExerciseCatalog(exercises);
  const byDate = new Map(
    normalizeEntries(currentEntries, catalog).map((entry) => [entry.date, entry]),
  );
  for (const incoming of normalizeEntries(importedEntries, catalog)) {
    const current = byDate.get(incoming.date);
    byDate.set(
      incoming.date,
      current ? mergeDayEntries(current, incoming, catalog) : incoming,
    );
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
