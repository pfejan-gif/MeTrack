import { isExerciseIconAllowed } from "../exercise-icons.js";
import {
  DATA_SCHEMA_VERSION,
  DEFAULT_EXERCISES,
  MAX_BACKUP_ENTRIES,
  MAX_EXERCISES,
} from "./constants.js";
import {
  sanitizeExerciseCatalog,
  validateExerciseCatalog,
} from "./exercises.js";
import { normalizeEntries, validateEntry } from "./entries.js";
import { todayLocal } from "./value-utils.js";

function migratedCatalog(previousExercises) {
  const result = DEFAULT_EXERCISES.map((exercise) => ({ ...exercise }));
  const names = new Set(
    result.map((exercise) => exercise.name.toLocaleLowerCase("de-DE")),
  );
  for (const raw of sanitizeExerciseCatalog(previousExercises)) {
    if (result.length >= MAX_EXERCISES) break;
    let name = raw.name;
    let suffix = 2;
    while (names.has(name.toLocaleLowerCase("de-DE"))) {
      name = `${raw.name} (${suffix})`;
      suffix += 1;
    }
    const exercise = { ...raw, name };
    result.push(exercise);
    names.add(name.toLocaleLowerCase("de-DE"));
  }
  return result;
}

function validateStoredEntries(
  entries,
  exercises,
  { canonical = false, requireChecks = false } = {},
) {
  if (!Array.isArray(entries)) throw new Error("Der Datensatz ist ungültig.");
  if (entries.length > MAX_BACKUP_ENTRIES)
    throw new Error(`Der Datensatz enthält mehr als ${MAX_BACKUP_ENTRIES} Einträge.`);
  entries.forEach((entry, index) => {
    if (canonical && !Array.isArray(entry?.exerciseSets))
      throw new Error(`Eintrag ${index + 1} ist nicht im aktuellen Format.`);
    if (requireChecks && !Array.isArray(entry?.exerciseChecks))
      throw new Error(`Eintrag ${index + 1} ist nicht im aktuellen Format.`);
    if (entry?.date > todayLocal() || !validateEntry(entry, exercises).valid)
      throw new Error(`Eintrag ${index + 1} ist ungültig.`);
  });
  return normalizeEntries(entries, exercises);
}

export function migrateDataEnvelope(parsed) {
  if (!parsed || !Number.isInteger(parsed.schemaVersion))
    throw new Error("Die gespeicherten MeTrack-Daten haben keine Version.");
  if (parsed.schemaVersion > DATA_SCHEMA_VERSION)
    throw new Error("Die Daten wurden mit einer neueren MeTrack-Version erstellt.");
  if (parsed.schemaVersion === 6) {
    const hasCanonicalIcons =
      Array.isArray(parsed.exercises) &&
      parsed.exercises.every((exercise) =>
        isExerciseIconAllowed(exercise?.icon, exercise?.kind),
      );
    if (!hasCanonicalIcons || !validateExerciseCatalog(parsed.exercises).valid)
      throw new Error("Der Übungskatalog ist ungültig.");
    const exercises = sanitizeExerciseCatalog(parsed.exercises);
    return {
      schemaVersion: DATA_SCHEMA_VERSION,
      exercises,
      entries: validateStoredEntries(parsed.entries, exercises, {
        canonical: true,
        requireChecks: true,
      }),
    };
  }
  if (parsed.schemaVersion === 5) {
    if (!validateExerciseCatalog(parsed.exercises).valid)
      throw new Error("Der bisherige Übungskatalog ist ungültig.");
    const exercises = sanitizeExerciseCatalog(parsed.exercises);
    return {
      schemaVersion: DATA_SCHEMA_VERSION,
      exercises,
      entries: validateStoredEntries(parsed.entries, exercises, {
        canonical: true,
        requireChecks: true,
      }),
    };
  }
  if (parsed.schemaVersion === 4) {
    if (!validateExerciseCatalog(parsed.exercises).valid)
      throw new Error("Der bisherige Übungskatalog ist ungültig.");
    const exercises = sanitizeExerciseCatalog(parsed.exercises);
    return {
      schemaVersion: DATA_SCHEMA_VERSION,
      exercises,
      entries: validateStoredEntries(parsed.entries, exercises, {
        canonical: true,
      }),
    };
  }
  if (parsed.schemaVersion === 3) {
    if (!validateExerciseCatalog(parsed.exercises).valid)
      throw new Error("Der bisherige Übungskatalog ist ungültig.");
    const exercises = migratedCatalog(parsed.exercises);
    return {
      schemaVersion: DATA_SCHEMA_VERSION,
      exercises,
      entries: validateStoredEntries(parsed.entries, exercises),
    };
  }
  if (parsed.schemaVersion === 2) {
    const exercises = DEFAULT_EXERCISES.map((exercise) => ({ ...exercise }));
    return {
      schemaVersion: DATA_SCHEMA_VERSION,
      exercises,
      entries: validateStoredEntries(parsed.entries, exercises),
    };
  }
  throw new Error("Diese gespeicherte Datenversion wird nicht unterstützt.");
}

export function migrateLegacyEntries(entries) {
  const exercises = DEFAULT_EXERCISES.map((exercise) => ({ ...exercise }));
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    exercises,
    entries: validateStoredEntries(entries, exercises),
  };
}

export function createDataEnvelope(entries, exercises) {
  const catalogValidation = validateExerciseCatalog(exercises);
  if (!catalogValidation.valid) throw new Error("Der Übungskatalog ist ungültig.");
  const catalog = sanitizeExerciseCatalog(exercises);
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    exercises: catalog,
    entries: normalizeEntries(entries, catalog),
  };
}
