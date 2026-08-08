import {
  BODY_METRIC_KEYS,
  DEFAULT_EXERCISES,
  LEGACY_EXERCISE_BY_ID,
  METRICS,
  SET_COUNT,
} from "./constants.js";
import {
  exerciseDefinition,
  exerciseFieldName,
  sanitizeExerciseCatalog,
  setFieldName,
  setsKey,
} from "./exercises.js";
import { isIsoDate, parseNumber } from "./value-utils.js";

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

export function rawExerciseValues(raw, exerciseId) {
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

export function entryExerciseCompletion(raw, exerciseId) {
  if (!Array.isArray(raw?.exerciseChecks)) return null;
  const check = raw.exerciseChecks.find(
    (item) => item?.exerciseId === exerciseId,
  );
  return typeof check?.completed === "boolean" ? check.completed : null;
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
  const entry = { date: raw.date, exerciseSets: [], exerciseChecks: [] };
  for (const exercise of catalog) {
    if (exercise.kind === "stretch") {
      const completed = entryExerciseCompletion(raw, exercise.id);
      if (completed !== null)
        entry.exerciseChecks.push({ exerciseId: exercise.id, completed });
      continue;
    }
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
  if (
    Array.isArray(entry?.exerciseChecks) &&
    entry.exerciseChecks.some((item) => item?.completed === true)
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
  const exerciseById = new Map(catalog.map((exercise) => [exercise.id, exercise]));
  const seenIds = new Set();
  if (raw?.exerciseSets !== undefined && !Array.isArray(raw.exerciseSets))
    errors.exerciseSets = "Übungswerte sind ungültig.";
  for (const item of Array.isArray(raw?.exerciseSets) ? raw.exerciseSets : []) {
    const definition = definitions.get(item?.exerciseId);
    if (
      !item ||
      !definition ||
      definition.completion ||
      seenIds.has(item.exerciseId)
    ) {
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
      if (!item || !definition || definition.completion) {
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
  const seenChecks = new Set();
  if (raw?.exerciseChecks !== undefined && !Array.isArray(raw.exerciseChecks))
    errors.exerciseChecks = "Dehnungsstatus ist ungültig.";
  for (const item of Array.isArray(raw?.exerciseChecks) ? raw.exerciseChecks : []) {
    const exercise = exerciseById.get(item?.exerciseId);
    if (
      !item ||
      exercise?.kind !== "stretch" ||
      typeof item.completed !== "boolean" ||
      seenChecks.has(item.exerciseId)
    ) {
      errors.exerciseChecks = "Dehnungsstatus passt nicht zum Übungskatalog.";
      continue;
    }
    seenChecks.add(item.exerciseId);
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
    errors.form = "Trage mindestens einen Messwert ein oder hake eine Dehnung ab.";
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
  const merged = {
    date: current.date,
    exerciseSets: [],
    exerciseChecks: [],
  };
  for (const exercise of catalog) {
    if (exercise.kind === "stretch") {
      const currentCompletion = entryExerciseCompletion(current, exercise.id);
      const incomingCompletion = entryExerciseCompletion(incoming, exercise.id);
      const completed = incomingCompletion ?? currentCompletion;
      if (completed !== null)
        merged.exerciseChecks.push({ exerciseId: exercise.id, completed });
      continue;
    }
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
    exerciseChecks: Array.isArray(entry.exerciseChecks)
      ? entry.exerciseChecks.filter((item) => item?.exerciseId !== exerciseId)
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
  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    const completion = entryExerciseCompletion(entry, exerciseId);
    return completion !== null || rawExerciseValues(entry, exerciseId).some(
      (value) => value !== null && value !== undefined,
    );
  }).length;
}

