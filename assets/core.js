export const STORAGE_KEY = "metrack_entries_v1";
export const V2_DATA_KEY = "metrack_data_v2";
export const PREVIOUS_DATA_KEY = "metrack_data_v3";
export const DATA_KEY = "metrack_data_v4";
export const DATA_SCHEMA_VERSION = 4;
export const SETTINGS_KEY = "metrack_settings_v1";
export const BACKUP_VERSION = 4;
export const SET_COUNT = 3;
export const MAX_BACKUP_ENTRIES = 5000;
// v3 erlaubte bis zu 30 zusätzliche Übungen. Zusammen mit den drei
// bisherigen Standardübungen müssen daher mindestens 33 migrierbar bleiben.
export const MAX_EXERCISES = 40;
export const MAX_CUSTOM_EXERCISES = MAX_EXERCISES;
export const EXERCISE_METRIC_PREFIX = "exercise:";
export const CUSTOM_METRIC_PREFIX = EXERCISE_METRIC_PREFIX;

export const EXERCISE_TYPES = Object.freeze({
  reps: {
    label: "Wiederholungen",
    shortUnit: "Wdh.",
    csvUnit: "Wiederholungen",
    min: 0,
    max: 10_000,
  },
  seconds: {
    label: "Zeit",
    shortUnit: "Sek.",
    csvUnit: "Sekunden",
    min: 0,
    max: 86_400,
  },
});

export const CUSTOM_EXERCISE_TYPES = EXERCISE_TYPES;

export const DEFAULT_EXERCISES = Object.freeze([
  Object.freeze({
    id: "exercise-plank",
    name: "Plank",
    kind: "seconds",
    active: true,
  }),
  Object.freeze({
    id: "exercise-pushups",
    name: "Liegestütze",
    kind: "reps",
    active: true,
  }),
  Object.freeze({
    id: "exercise-squats",
    name: "Kniebeugen",
    kind: "reps",
    active: true,
  }),
]);

const LEGACY_EXERCISE_BY_ID = Object.freeze({
  "exercise-plank": "plank",
  "exercise-pushups": "pushups",
  "exercise-squats": "squats",
});

export const METRICS = Object.freeze({
  plank: {
    label: "Plank",
    shortLabel: "Plank",
    unit: "Sek.",
    csvLabel: "Plank Sekunden",
    decimals: 0,
    min: 0,
    max: 3600,
    direction: "up",
  },
  pushups: {
    label: "Liegestütze",
    shortLabel: "Liegestütze",
    unit: "Wdh.",
    csvLabel: "Liegestuetze",
    decimals: 0,
    min: 0,
    max: 1000,
    direction: "up",
  },
  squats: {
    label: "Kniebeugen",
    shortLabel: "Kniebeugen",
    unit: "Wdh.",
    csvLabel: "Kniebeugen",
    decimals: 0,
    min: 0,
    max: 2000,
    direction: "up",
  },
  weight: {
    label: "Gewicht",
    shortLabel: "Gewicht",
    unit: "kg",
    csvLabel: "Gewicht kg",
    decimals: 1,
    min: 20,
    max: 400,
    direction: "neutral",
  },
  waist: {
    label: "Bauchumfang",
    shortLabel: "Bauch",
    unit: "cm",
    csvLabel: "Bauch cm",
    decimals: 1,
    min: 30,
    max: 300,
    direction: "neutral",
  },
});

export const EXERCISE_KEYS = Object.freeze(["plank", "pushups", "squats"]);
export const BODY_METRIC_KEYS = Object.freeze(["weight", "waist"]);
export const METRIC_KEYS = Object.freeze([
  ...EXERCISE_KEYS,
  ...BODY_METRIC_KEYS,
]);

export function setFieldName(key, index) {
  return `${key}${index + 1}`;
}

export function setsKey(key) {
  return `${key}Sets`;
}

export function exerciseMetricKey(exerciseId) {
  return `${EXERCISE_METRIC_PREFIX}${exerciseId}`;
}

export const customMetricKey = exerciseMetricKey;

export function exerciseIdFromMetric(metricKey) {
  return String(metricKey).startsWith(EXERCISE_METRIC_PREFIX)
    ? String(metricKey).slice(EXERCISE_METRIC_PREFIX.length)
    : null;
}

export const customExerciseIdFromMetric = exerciseIdFromMetric;

export function exerciseFieldName(exerciseId, index) {
  return `${exerciseId}-set-${index + 1}`;
}

export const customFieldName = exerciseFieldName;

function normalizedExerciseName(value) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ");
}

export function sanitizeExercise(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id ?? "").trim();
  const name = normalizedExerciseName(raw.name);
  const kind = String(raw.kind ?? "");
  if (!/^(?:exercise|custom)-[a-z0-9][a-z0-9-]{3,79}$/.test(id))
    return null;
  if (!name || name.length > 40 || /[\u0000-\u001f\u007f]/.test(name))
    return null;
  if (!EXERCISE_TYPES[kind]) return null;
  return { id, name, kind, active: raw.active !== false };
}

export const sanitizeCustomExercise = sanitizeExercise;

export function validateExercise(raw) {
  const errors = {};
  const id = String(raw?.id ?? "").trim();
  const name = normalizedExerciseName(raw?.name);
  if (!/^(?:exercise|custom)-[a-z0-9][a-z0-9-]{3,79}$/.test(id))
    errors.id = "Die Übungs-ID ist ungültig.";
  if (!name) errors.name = "Bitte gib der Übung einen Namen.";
  else if (name.length > 40)
    errors.name = "Der Name darf höchstens 40 Zeichen lang sein.";
  else if (/[\u0000-\u001f\u007f]/.test(name))
    errors.name = "Der Name enthält ungültige Zeichen.";
  if (!EXERCISE_TYPES[raw?.kind])
    errors.kind = "Bitte wähle Wiederholungen oder Zeit.";
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    exercise: sanitizeExercise(raw),
  };
}

export const validateCustomExercise = validateExercise;

export function sanitizeExerciseCatalog(exercises) {
  const sanitized = [];
  const ids = new Set();
  const names = new Set();
  for (const raw of Array.isArray(exercises) ? exercises : []) {
    if (sanitized.length >= MAX_EXERCISES) break;
    const exercise = sanitizeExercise(raw);
    if (!exercise) continue;
    const normalizedName = exercise.name.toLocaleLowerCase("de-DE");
    if (ids.has(exercise.id) || names.has(normalizedName)) continue;
    ids.add(exercise.id);
    names.add(normalizedName);
    sanitized.push(exercise);
  }
  return sanitized;
}

export const sanitizeCustomExercises = sanitizeExerciseCatalog;

export function validateExerciseCatalog(exercises) {
  if (!Array.isArray(exercises))
    return { valid: false, errors: ["Der Übungskatalog fehlt."] };
  if (exercises.length > MAX_EXERCISES) {
    return {
      valid: false,
      errors: [`Es sind höchstens ${MAX_EXERCISES} Übungen möglich.`],
    };
  }
  const errors = [];
  const ids = new Set();
  const names = new Set();
  exercises.forEach((raw, index) => {
    const validation = validateExercise(raw);
    if (!validation.valid) {
      errors.push(`Übung ${index + 1} ist ungültig.`);
      return;
    }
    const exercise = validation.exercise;
    const normalizedName = exercise.name.toLocaleLowerCase("de-DE");
    if (ids.has(exercise.id)) errors.push(`Doppelte Übungs-ID: ${exercise.id}`);
    if (names.has(normalizedName))
      errors.push(`Doppelter Übungsname: ${exercise.name}`);
    ids.add(exercise.id);
    names.add(normalizedName);
  });
  return { valid: errors.length === 0, errors };
}

export function exerciseDefinition(exercise) {
  const sanitized = sanitizeExercise(exercise);
  if (!sanitized) return null;
  const type = EXERCISE_TYPES[sanitized.kind];
  return {
    key: exerciseMetricKey(sanitized.id),
    exerciseId: sanitized.id,
    label: sanitized.name,
    shortLabel: sanitized.name,
    unit: type.shortUnit,
    csvLabel: `${sanitized.name} ${type.csvUnit}`,
    decimals: 0,
    min: type.min,
    max: type.max,
    direction: "up",
    exercise: true,
  };
}

export const customExerciseDefinition = exerciseDefinition;

export function metricDefinition(key, exercises = DEFAULT_EXERCISES) {
  if (BODY_METRIC_KEYS.includes(key))
    return { key, ...METRICS[key], exercise: false };
  if (EXERCISE_KEYS.includes(key))
    return { key, ...METRICS[key], exercise: true, legacy: true };
  const exerciseId = exerciseIdFromMetric(key);
  const exercise = sanitizeExerciseCatalog(exercises).find(
    (item) => item.id === exerciseId,
  );
  return exercise ? exerciseDefinition(exercise) : null;
}

export function legacyExerciseSets(raw, key) {
  const storedSets = raw?.[setsKey(key)];
  if (Array.isArray(storedSets))
    return Array.from(
      { length: SET_COUNT },
      (_, index) => storedSets[index] ?? null,
    );
  const formFields = Array.from(
    { length: SET_COUNT },
    (_, index) => raw?.[setFieldName(key, index)],
  );
  if (formFields.some((value) => value !== undefined)) return formFields;
  return [
    raw?.[key] ?? null,
    ...Array.from({ length: SET_COUNT - 1 }, () => null),
  ];
}

export const exerciseSets = legacyExerciseSets;

function arrayValues(values) {
  return Array.from(
    { length: SET_COUNT },
    (_, index) => values?.[index] ?? null,
  );
}

function rawExerciseValues(raw, exerciseId) {
  if (Array.isArray(raw?.exerciseSets)) {
    const canonical = raw.exerciseSets.find(
      (item) => item?.exerciseId === exerciseId,
    );
    if (canonical)
      return arrayValues(
        Array.isArray(canonical.values) ? canonical.values : canonical.sets,
      );
  }
  const legacyKey = LEGACY_EXERCISE_BY_ID[exerciseId];
  if (legacyKey) {
    const values = legacyExerciseSets(raw, legacyKey);
    if (values.some((value) => value !== null && value !== undefined))
      return values;
  }
  if (Array.isArray(raw?.customSets)) {
    const previous = raw.customSets.find(
      (item) => item?.exerciseId === exerciseId,
    );
    if (previous)
      return arrayValues(
        Array.isArray(previous.values) ? previous.values : previous.sets,
      );
  }
  return arrayValues([]);
}

export function entryExerciseValues(raw, exerciseId) {
  return rawExerciseValues(raw, exerciseId);
}

export const customExerciseValues = entryExerciseValues;

export function todayLocal(now = new Date()) {
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function parseNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(",", ".");
  if (normalized === "") return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function sanitizeWholeNumber(value, definition) {
  const parsed = parseNumber(value);
  if (parsed === null) return null;
  const rounded = Math.round(parsed);
  return rounded >= definition.min && rounded <= definition.max
    ? rounded
    : null;
}

export function sanitizeEntry(raw, exercises = DEFAULT_EXERCISES) {
  if (!raw || !isIsoDate(raw.date)) return null;
  const catalog = sanitizeExerciseCatalog(exercises);
  const entry = { date: raw.date, exerciseSets: [] };
  for (const exercise of catalog) {
    const definition = exerciseDefinition(exercise);
    const values = rawExerciseValues(raw, exercise.id).map((value) =>
      sanitizeWholeNumber(value, definition),
    );
    if (values.some((value) => value !== null))
      entry.exerciseSets.push({ exerciseId: exercise.id, values });
  }
  for (const key of BODY_METRIC_KEYS) {
    const definition = METRICS[key];
    const parsed = parseNumber(raw[key]);
    if (parsed === null) {
      entry[key] = null;
      continue;
    }
    const value = Math.round(parsed * 10) / 10;
    entry[key] =
      value >= definition.min && value <= definition.max ? value : null;
  }
  return entry;
}

export function hasMeasurement(entry) {
  if (
    BODY_METRIC_KEYS.some(
      (key) => entry?.[key] !== null && entry?.[key] !== undefined,
    )
  )
    return true;
  return Array.isArray(entry?.exerciseSets)
    ? entry.exerciseSets.some((item) =>
        item?.values?.some((value) => value !== null && value !== undefined),
      )
    : false;
}

function validateSetValues(values, definition, errors, exerciseId) {
  if (!Array.isArray(values) || values.length > SET_COUNT) {
    errors.exerciseSets = "Übungswerte sind ungültig.";
    return;
  }
  arrayValues(values).forEach((value, index) => {
    if (value === "" || value === null || value === undefined) return;
    const parsed = parseNumber(value);
    if (
      parsed === null ||
      parsed < definition.min ||
      parsed > definition.max ||
      !Number.isInteger(parsed)
    ) {
      errors[exerciseFieldName(exerciseId, index)] =
        `Ganze Zahl von ${definition.min}–${definition.max}`;
    }
  });
}

export function validateEntry(raw, exercises = DEFAULT_EXERCISES) {
  const errors = {};
  if (!isIsoDate(raw?.date)) errors.date = "Bitte wähle ein gültiges Datum.";
  const catalog = sanitizeExerciseCatalog(exercises);
  const definitions = new Map(
    catalog.map((exercise) => [exercise.id, exerciseDefinition(exercise)]),
  );
  const seenIds = new Set();
  if (raw?.exerciseSets !== undefined && !Array.isArray(raw.exerciseSets))
    errors.exerciseSets = "Übungswerte sind ungültig.";
  for (const item of Array.isArray(raw?.exerciseSets) ? raw.exerciseSets : []) {
    const definition = definitions.get(item?.exerciseId);
    if (!item || !definition || seenIds.has(item.exerciseId)) {
      errors.exerciseSets = "Übungswerte passen nicht zum Übungskatalog.";
      continue;
    }
    seenIds.add(item.exerciseId);
    validateSetValues(
      Array.isArray(item.values) ? item.values : item.sets,
      definition,
      errors,
      item.exerciseId,
    );
  }
  if (Array.isArray(raw?.customSets)) {
    for (const item of raw.customSets) {
      const definition = definitions.get(item?.exerciseId);
      if (!item || !definition) {
        errors.exerciseSets = "Übungswerte passen nicht zum Übungskatalog.";
        continue;
      }
      validateSetValues(
        Array.isArray(item.values) ? item.values : item.sets,
        definition,
        errors,
        item.exerciseId,
      );
    }
  }
  for (const exercise of catalog) {
    const legacyKey = LEGACY_EXERCISE_BY_ID[exercise.id];
    if (!legacyKey) continue;
    legacyExerciseSets(raw, legacyKey).forEach((value, index) => {
      if (value === "" || value === null || value === undefined) return;
      const definition = exerciseDefinition(exercise);
      const parsed = parseNumber(value);
      if (
        parsed === null ||
        parsed < definition.min ||
        parsed > definition.max ||
        !Number.isInteger(parsed)
      ) {
        errors[exerciseFieldName(exercise.id, index)] =
          `Ganze Zahl von ${definition.min}–${definition.max}`;
      }
    });
  }
  for (const key of BODY_METRIC_KEYS) {
    const definition = METRICS[key];
    if (raw?.[key] === "" || raw?.[key] === null || raw?.[key] === undefined)
      continue;
    const parsed = parseNumber(raw[key]);
    const hasTooManyDecimals =
      parsed !== null && Math.abs(parsed * 10 - Math.round(parsed * 10)) > 1e-8;
    if (
      parsed === null ||
      parsed < definition.min ||
      parsed > definition.max ||
      hasTooManyDecimals
    ) {
      errors[key] =
        `Erlaubt sind ${definition.min} bis ${definition.max} ${definition.unit} mit höchstens 1 Dezimalstelle`;
    }
  }
  const sanitized = sanitizeEntry(raw, catalog);
  if (sanitized && !hasMeasurement(sanitized))
    errors.form = "Trage mindestens einen Messwert ein.";
  return { valid: Object.keys(errors).length === 0, errors, entry: sanitized };
}

export function sortEntries(entries, exercises = DEFAULT_EXERCISES) {
  return [...(Array.isArray(entries) ? entries : [])]
    .map((entry) => sanitizeEntry(entry, exercises))
    .filter((entry) => entry && hasMeasurement(entry))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function normalizeEntries(entries, exercises = DEFAULT_EXERCISES) {
  const byDate = new Map();
  for (const entry of sortEntries(entries, exercises)) {
    const existing = byDate.get(entry.date);
    byDate.set(
      entry.date,
      existing ? mergeDayEntries(existing, entry, exercises) : entry,
    );
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function mergeDayEntries(
  currentEntry,
  incomingEntry,
  exercises = DEFAULT_EXERCISES,
) {
  const catalog = sanitizeExerciseCatalog(exercises);
  const current = sanitizeEntry(currentEntry, catalog);
  const incoming = sanitizeEntry(incomingEntry, catalog);
  if (!current) return incoming;
  if (!incoming) return current;
  if (current.date !== incoming.date) return incoming;
  const merged = { date: current.date, exerciseSets: [] };
  for (const exercise of catalog) {
    const currentValues = rawExerciseValues(current, exercise.id);
    const incomingValues = rawExerciseValues(incoming, exercise.id);
    const values = currentValues.map(
      (value, index) => incomingValues[index] ?? value,
    );
    if (values.some((value) => value !== null))
      merged.exerciseSets.push({ exerciseId: exercise.id, values });
  }
  for (const key of BODY_METRIC_KEYS)
    merged[key] = incoming[key] ?? current[key];
  return sanitizeEntry(merged, catalog);
}

export function upsertEntry(
  entries,
  nextEntry,
  previousDate = null,
  exercises = DEFAULT_EXERCISES,
) {
  const normalized = normalizeEntries(entries, exercises);
  const sanitized = sanitizeEntry(nextEntry, exercises);
  if (!sanitized || !hasMeasurement(sanitized)) return normalized;
  const withoutPrevious = previousDate
    ? normalized.filter((entry) => entry.date !== previousDate)
    : normalized;
  const index = withoutPrevious.findIndex(
    (entry) => entry.date === sanitized.date,
  );
  if (index >= 0) withoutPrevious[index] = sanitized;
  else withoutPrevious.push(sanitized);
  return withoutPrevious.sort((a, b) => a.date.localeCompare(b.date));
}

export function removeEntry(entries, date, exercises = DEFAULT_EXERCISES) {
  return normalizeEntries(entries, exercises).filter(
    (entry) => entry.date !== date,
  );
}

export function removeExerciseFromEntries(
  entries,
  exerciseId,
  remainingExercises,
) {
  const stripped = (Array.isArray(entries) ? entries : []).map((entry) => ({
    ...entry,
    exerciseSets: Array.isArray(entry.exerciseSets)
      ? entry.exerciseSets.filter((item) => item?.exerciseId !== exerciseId)
      : [],
    customSets: Array.isArray(entry.customSets)
      ? entry.customSets.filter((item) => item?.exerciseId !== exerciseId)
      : [],
    ...(LEGACY_EXERCISE_BY_ID[exerciseId]
      ? {
          [LEGACY_EXERCISE_BY_ID[exerciseId]]: null,
          [setsKey(LEGACY_EXERCISE_BY_ID[exerciseId])]: arrayValues([]),
        }
      : {}),
  }));
  return normalizeEntries(stripped, remainingExercises);
}

export function exerciseUsageCount(entries, exerciseId) {
  return (Array.isArray(entries) ? entries : []).filter((entry) =>
    rawExerciseValues(entry, exerciseId).some(
      (value) => value !== null && value !== undefined,
    ),
  ).length;
}

export function entryMetricValue(
  entry,
  key,
  exercises = DEFAULT_EXERCISES,
) {
  if (BODY_METRIC_KEYS.includes(key)) return entry?.[key] ?? null;
  if (EXERCISE_KEYS.includes(key)) {
    const defaultExercise = DEFAULT_EXERCISES.find(
      (exercise) => LEGACY_EXERCISE_BY_ID[exercise.id] === key,
    );
    if (!defaultExercise) return null;
    const completed = rawExerciseValues(entry, defaultExercise.id).filter(
      (value) => value !== null && value !== undefined,
    );
    return completed.length ? Math.max(...completed) : null;
  }
  const exerciseId = exerciseIdFromMetric(key);
  if (
    !exerciseId ||
    !sanitizeExerciseCatalog(exercises).some(
      (exercise) => exercise.id === exerciseId,
    )
  )
    return null;
  const completed = rawExerciseValues(entry, exerciseId).filter(
    (value) => value !== null && value !== undefined,
  );
  return completed.length ? Math.max(...completed) : null;
}

export function metricValues(entries, key, exercises = DEFAULT_EXERCISES) {
  return normalizeEntries(entries, exercises).filter(
    (entry) => entryMetricValue(entry, key, exercises) !== null,
  );
}

export function latestValue(entries, key, exercises = DEFAULT_EXERCISES) {
  const values = metricValues(entries, key, exercises);
  return values.length
    ? entryMetricValue(values[values.length - 1], key, exercises)
    : null;
}

export function firstValue(entries, key, exercises = DEFAULT_EXERCISES) {
  const values = metricValues(entries, key, exercises);
  return values.length ? entryMetricValue(values[0], key, exercises) : null;
}

export function bestValue(entries, key, exercises = DEFAULT_EXERCISES) {
  const values = metricValues(entries, key, exercises).map((entry) =>
    entryMetricValue(entry, key, exercises),
  );
  return values.length ? Math.max(...values) : null;
}

export function previousValue(entries, key, exercises = DEFAULT_EXERCISES) {
  const values = metricValues(entries, key, exercises);
  return values.length > 1
    ? entryMetricValue(values[values.length - 2], key, exercises)
    : null;
}

export function changeFromPrevious(
  entries,
  key,
  exercises = DEFAULT_EXERCISES,
) {
  const latest = latestValue(entries, key, exercises);
  const previous = previousValue(entries, key, exercises);
  return latest === null || previous === null ? null : latest - previous;
}

export function changeFromFirst(
  entries,
  key,
  exercises = DEFAULT_EXERCISES,
) {
  const latest = latestValue(entries, key, exercises);
  const first = firstValue(entries, key, exercises);
  return latest === null || first === null ? null : latest - first;
}

export function calculateStreak(
  entries,
  referenceDate = todayLocal(),
  exercises = DEFAULT_EXERCISES,
) {
  const uniqueDates = [
    ...new Set(
      normalizeEntries(entries, exercises)
        .map((entry) => entry.date)
        .filter((date) => date <= referenceDate),
    ),
  ]
    .sort()
    .reverse();
  if (!uniqueDates.length || !isIsoDate(referenceDate)) return 0;
  let reference = new Date(`${referenceDate}T12:00:00`);
  let streak = 0;
  for (const dateString of uniqueDates) {
    const current = new Date(`${dateString}T12:00:00`);
    const difference = Math.round((reference - current) / 86_400_000);
    const acceptedFirstDay = streak === 0 && difference >= 0 && difference <= 1;
    const acceptedNextDay = streak > 0 && difference === 1;
    if (!acceptedFirstDay && !acceptedNextDay) break;
    streak += 1;
    reference = current;
  }
  return streak;
}

export function formatNumber(value, decimals = 0, locale = "de-DE") {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "—";
  return value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDate(dateString, locale = "de-DE") {
  if (!isIsoDate(dateString)) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dateString}T12:00:00`));
}

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

function validateStoredEntries(entries, exercises, { canonical = false } = {}) {
  if (!Array.isArray(entries)) throw new Error("Der Datensatz ist ungültig.");
  if (entries.length > MAX_BACKUP_ENTRIES)
    throw new Error(`Der Datensatz enthält mehr als ${MAX_BACKUP_ENTRIES} Einträge.`);
  entries.forEach((entry, index) => {
    if (canonical && !Array.isArray(entry?.exerciseSets))
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
  if (parsed.schemaVersion === 4) {
    if (!validateExerciseCatalog(parsed.exercises).valid)
      throw new Error("Der Übungskatalog ist ungültig.");
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
  if (parsed.version >= 4) {
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
