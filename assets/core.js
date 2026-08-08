export const STORAGE_KEY = "metrack_entries_v1";
export const PREVIOUS_DATA_KEY = "metrack_data_v2";
export const DATA_KEY = "metrack_data_v3";
export const DATA_SCHEMA_VERSION = 3;
export const SETTINGS_KEY = "metrack_settings_v1";
export const BACKUP_VERSION = 3;
export const SET_COUNT = 3;
export const MAX_BACKUP_ENTRIES = 5000;
export const MAX_CUSTOM_EXERCISES = 24;
export const CUSTOM_METRIC_PREFIX = "custom:";

export const CUSTOM_EXERCISE_TYPES = Object.freeze({
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

export const METRIC_KEYS = Object.freeze(Object.keys(METRICS));
export const EXERCISE_KEYS = Object.freeze(["plank", "pushups", "squats"]);
export const BODY_METRIC_KEYS = Object.freeze(["weight", "waist"]);

export function setFieldName(key, index) {
  return `${key}${index + 1}`;
}

export function setsKey(key) {
  return `${key}Sets`;
}

export function customMetricKey(exerciseId) {
  return `${CUSTOM_METRIC_PREFIX}${exerciseId}`;
}

export function customExerciseIdFromMetric(metricKey) {
  return String(metricKey).startsWith(CUSTOM_METRIC_PREFIX)
    ? String(metricKey).slice(CUSTOM_METRIC_PREFIX.length)
    : null;
}

export function customFieldName(exerciseId, index) {
  return `${exerciseId}-set-${index + 1}`;
}

function normalizedExerciseName(value) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ");
}

export function sanitizeCustomExercise(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id ?? "").trim();
  const name = normalizedExerciseName(raw.name);
  const kind = String(raw.kind ?? "");
  if (!/^custom-[a-z0-9][a-z0-9-]{5,79}$/.test(id)) return null;
  if (!name || name.length > 40 || /[\u0000-\u001f\u007f]/.test(name))
    return null;
  if (!CUSTOM_EXERCISE_TYPES[kind]) return null;
  return { id, name, kind, active: raw.active !== false };
}

export function validateCustomExercise(raw) {
  const errors = {};
  const id = String(raw?.id ?? "").trim();
  const name = normalizedExerciseName(raw?.name);
  if (!/^custom-[a-z0-9][a-z0-9-]{5,79}$/.test(id))
    errors.id = "Die Übungs-ID ist ungültig.";
  if (!name) errors.name = "Bitte gib der Übung einen Namen.";
  else if (name.length > 40)
    errors.name = "Der Name darf höchstens 40 Zeichen lang sein.";
  else if (/[\u0000-\u001f\u007f]/.test(name))
    errors.name = "Der Name enthält ungültige Zeichen.";
  if (!CUSTOM_EXERCISE_TYPES[raw?.kind])
    errors.kind = "Bitte wähle Wiederholungen oder Zeit.";
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    exercise: sanitizeCustomExercise(raw),
  };
}

export function sanitizeCustomExercises(exercises) {
  const sanitized = [];
  const ids = new Set();
  const names = new Set();
  for (const raw of Array.isArray(exercises) ? exercises : []) {
    if (sanitized.length >= MAX_CUSTOM_EXERCISES) break;
    const exercise = sanitizeCustomExercise(raw);
    if (!exercise) continue;
    const normalizedName = exercise.name.toLocaleLowerCase("de-DE");
    if (ids.has(exercise.id) || names.has(normalizedName)) continue;
    ids.add(exercise.id);
    names.add(normalizedName);
    sanitized.push(exercise);
  }
  return sanitized;
}

export function validateExerciseCatalog(exercises) {
  if (!Array.isArray(exercises))
    return { valid: false, errors: ["Der Übungskatalog fehlt."] };
  if (exercises.length > MAX_CUSTOM_EXERCISES) {
    return {
      valid: false,
      errors: [
        `Es sind höchstens ${MAX_CUSTOM_EXERCISES} eigene Übungen möglich.`,
      ],
    };
  }
  const errors = [];
  const ids = new Set();
  const names = new Set();
  exercises.forEach((raw, index) => {
    const validation = validateCustomExercise(raw);
    if (!validation.valid) {
      errors.push(`Eigene Übung ${index + 1} ist ungültig.`);
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

export function customExerciseDefinition(exercise) {
  const sanitized = sanitizeCustomExercise(exercise);
  if (!sanitized) return null;
  const type = CUSTOM_EXERCISE_TYPES[sanitized.kind];
  return {
    key: customMetricKey(sanitized.id),
    exerciseId: sanitized.id,
    label: sanitized.name,
    shortLabel: sanitized.name,
    unit: type.shortUnit,
    csvLabel: `${sanitized.name} ${type.csvUnit}`,
    decimals: 0,
    min: type.min,
    max: type.max,
    direction: "up",
    custom: true,
  };
}

export function metricDefinition(key, exercises = []) {
  if (METRICS[key]) return { key, ...METRICS[key], custom: false };
  const exerciseId = customExerciseIdFromMetric(key);
  const exercise = sanitizeCustomExercises(exercises).find(
    (item) => item.id === exerciseId,
  );
  return exercise ? customExerciseDefinition(exercise) : null;
}

export function exerciseSets(raw, key) {
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

function rawCustomValues(raw, exerciseId) {
  if (!Array.isArray(raw?.customSets))
    return Array.from({ length: SET_COUNT }, () => null);
  const found = raw.customSets.find((item) => item?.exerciseId === exerciseId);
  const values = Array.isArray(found?.values)
    ? found.values
    : Array.isArray(found?.sets)
      ? found.sets
      : [];
  return Array.from({ length: SET_COUNT }, (_, index) => values[index] ?? null);
}

export function customExerciseValues(raw, exerciseId) {
  return rawCustomValues(raw, exerciseId);
}

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

export function sanitizeEntry(raw, exercises = []) {
  if (!raw || !isIsoDate(raw.date)) return null;
  const entry = { date: raw.date };

  for (const key of EXERCISE_KEYS) {
    const definition = METRICS[key];
    const values = exerciseSets(raw, key).map((value) =>
      sanitizeWholeNumber(value, definition),
    );
    entry[setsKey(key)] = values;
    const completed = values.filter((value) => value !== null);
    entry[key] = completed.length ? Math.max(...completed) : null;
  }

  for (const key of BODY_METRIC_KEYS) {
    const definition = METRICS[key];
    const parsed = parseNumber(raw[key]);
    if (parsed === null) {
      entry[key] = null;
      continue;
    }
    const value =
      definition.decimals === 0
        ? Math.round(parsed)
        : Math.round(parsed * 10) / 10;
    entry[key] =
      value >= definition.min && value <= definition.max ? value : null;
  }

  entry.customSets = [];
  for (const exercise of sanitizeCustomExercises(exercises)) {
    const definition = customExerciseDefinition(exercise);
    const values = rawCustomValues(raw, exercise.id).map((value) =>
      sanitizeWholeNumber(value, definition),
    );
    if (values.some((value) => value !== null)) {
      entry.customSets.push({ exerciseId: exercise.id, values });
    }
  }

  return entry;
}

export function hasMeasurement(entry) {
  if (
    METRIC_KEYS.some(
      (key) => entry?.[key] !== null && entry?.[key] !== undefined,
    )
  )
    return true;
  return Array.isArray(entry?.customSets)
    ? entry.customSets.some((item) =>
        item?.values?.some((value) => value !== null && value !== undefined),
      )
    : false;
}

export function validateEntry(raw, exercises = []) {
  const errors = {};
  if (!isIsoDate(raw?.date)) errors.date = "Bitte wähle ein gültiges Datum.";

  for (const key of EXERCISE_KEYS) {
    const definition = METRICS[key];
    exerciseSets(raw, key).forEach((value, index) => {
      if (value === "" || value === null || value === undefined) return;
      const parsed = parseNumber(value);
      if (
        parsed === null ||
        parsed < definition.min ||
        parsed > definition.max ||
        !Number.isInteger(parsed)
      ) {
        errors[setFieldName(key, index)] =
          `Ganze Zahl von ${definition.min}–${definition.max}`;
      }
    });
  }

  for (const key of BODY_METRIC_KEYS) {
    const definition = METRICS[key];
    if (raw?.[key] === "" || raw?.[key] === null || raw?.[key] === undefined)
      continue;
    const parsed = parseNumber(raw[key]);
    const precisionFactor = 10 ** definition.decimals;
    const hasTooManyDecimals =
      parsed !== null &&
      Math.abs(
        parsed * precisionFactor - Math.round(parsed * precisionFactor),
      ) > 1e-8;
    if (
      parsed === null ||
      parsed < definition.min ||
      parsed > definition.max ||
      hasTooManyDecimals
    ) {
      errors[key] =
        `Erlaubt sind ${definition.min} bis ${definition.max} ${definition.unit} mit höchstens ${definition.decimals} Dezimalstelle`;
    }
  }

  const catalog = sanitizeCustomExercises(exercises);
  const knownIds = new Set(catalog.map((exercise) => exercise.id));
  const seenIds = new Set();
  if (raw?.customSets !== undefined && !Array.isArray(raw.customSets)) {
    errors.customSets = "Eigene Übungswerte sind ungültig.";
  }
  for (const item of Array.isArray(raw?.customSets) ? raw.customSets : []) {
    if (
      !item ||
      !knownIds.has(item.exerciseId) ||
      seenIds.has(item.exerciseId)
    ) {
      errors.customSets = "Eigene Übungswerte passen nicht zum Übungskatalog.";
      continue;
    }
    seenIds.add(item.exerciseId);
    const exercise = catalog.find(
      (candidate) => candidate.id === item.exerciseId,
    );
    const definition = customExerciseDefinition(exercise);
    const values = Array.isArray(item.values)
      ? item.values
      : Array.isArray(item.sets)
        ? item.sets
        : null;
    if (!values || values.length > SET_COUNT) {
      errors.customSets = "Eigene Übungswerte sind ungültig.";
      continue;
    }
    Array.from(
      { length: SET_COUNT },
      (_, index) => values[index] ?? null,
    ).forEach((value, index) => {
      if (value === "" || value === null || value === undefined) return;
      const parsed = parseNumber(value);
      if (
        parsed === null ||
        parsed < definition.min ||
        parsed > definition.max ||
        !Number.isInteger(parsed)
      ) {
        errors[customFieldName(exercise.id, index)] =
          `Ganze Zahl von ${definition.min}–${definition.max}`;
      }
    });
  }

  const sanitized = sanitizeEntry(raw, catalog);
  if (sanitized && !hasMeasurement(sanitized))
    errors.form = "Trage mindestens einen Messwert ein.";
  return { valid: Object.keys(errors).length === 0, errors, entry: sanitized };
}

export function sortEntries(entries, exercises = []) {
  return [...(Array.isArray(entries) ? entries : [])]
    .map((entry) => sanitizeEntry(entry, exercises))
    .filter((entry) => entry && hasMeasurement(entry))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function normalizeEntries(entries, exercises = []) {
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

export function mergeDayEntries(currentEntry, incomingEntry, exercises = []) {
  const current = sanitizeEntry(currentEntry, exercises);
  const incoming = sanitizeEntry(incomingEntry, exercises);
  if (!current) return incoming;
  if (!incoming) return current;
  if (current.date !== incoming.date) return incoming;

  const merged = { date: current.date, customSets: [] };
  for (const key of EXERCISE_KEYS) {
    const currentSets = current[setsKey(key)];
    const incomingSets = incoming[setsKey(key)];
    merged[setsKey(key)] = currentSets.map(
      (value, index) => incomingSets[index] ?? value,
    );
  }
  for (const key of BODY_METRIC_KEYS)
    merged[key] = incoming[key] ?? current[key];

  for (const exercise of sanitizeCustomExercises(exercises)) {
    const currentValues = rawCustomValues(current, exercise.id);
    const incomingValues = rawCustomValues(incoming, exercise.id);
    const values = currentValues.map(
      (value, index) => incomingValues[index] ?? value,
    );
    if (values.some((value) => value !== null))
      merged.customSets.push({ exerciseId: exercise.id, values });
  }
  return sanitizeEntry(merged, exercises);
}

export function upsertEntry(
  entries,
  nextEntry,
  previousDate = null,
  exercises = [],
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

export function removeEntry(entries, date, exercises = []) {
  return normalizeEntries(entries, exercises).filter(
    (entry) => entry.date !== date,
  );
}

export function entryMetricValue(entry, key, exercises = []) {
  if (METRICS[key]) return entry?.[key] ?? null;
  const exerciseId = customExerciseIdFromMetric(key);
  if (!exerciseId || !metricDefinition(key, exercises)) return null;
  const completed = rawCustomValues(entry, exerciseId).filter(
    (value) => value !== null && value !== undefined,
  );
  return completed.length ? Math.max(...completed) : null;
}

export function metricValues(entries, key, exercises = []) {
  return normalizeEntries(entries, exercises).filter(
    (entry) => entryMetricValue(entry, key, exercises) !== null,
  );
}

export function latestValue(entries, key, exercises = []) {
  const values = metricValues(entries, key, exercises);
  return values.length
    ? entryMetricValue(values[values.length - 1], key, exercises)
    : null;
}

export function firstValue(entries, key, exercises = []) {
  const values = metricValues(entries, key, exercises);
  return values.length ? entryMetricValue(values[0], key, exercises) : null;
}

export function bestValue(entries, key, exercises = []) {
  const values = metricValues(entries, key, exercises).map((entry) =>
    entryMetricValue(entry, key, exercises),
  );
  return values.length ? Math.max(...values) : null;
}

export function previousValue(entries, key, exercises = []) {
  const values = metricValues(entries, key, exercises);
  return values.length > 1
    ? entryMetricValue(values[values.length - 2], key, exercises)
    : null;
}

export function changeFromPrevious(entries, key, exercises = []) {
  const latest = latestValue(entries, key, exercises);
  const previous = previousValue(entries, key, exercises);
  return latest === null || previous === null ? null : latest - previous;
}

export function changeFromFirst(entries, key, exercises = []) {
  const latest = latestValue(entries, key, exercises);
  const first = firstValue(entries, key, exercises);
  return latest === null || first === null ? null : latest - first;
}

export function calculateStreak(
  entries,
  referenceDate = todayLocal(),
  exercises = [],
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

export function entriesToCsv(entries, exercises = []) {
  const catalog = sanitizeCustomExercises(exercises);
  const header = [
    "Datum",
    ...EXERCISE_KEYS.flatMap((key) => [
      ...Array.from(
        { length: SET_COUNT },
        (_, index) => `${METRICS[key].csvLabel} Satz ${index + 1}`,
      ),
      `${METRICS[key].csvLabel} Bestwert`,
    ]),
    ...catalog.flatMap((exercise) => {
      const definition = customExerciseDefinition(exercise);
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
    ...EXERCISE_KEYS.flatMap((key) => [
      ...entry[setsKey(key)].map((value) => csvNumber(value)),
      csvNumber(entry[key]),
    ]),
    ...catalog.flatMap((exercise) => {
      const values = rawCustomValues(entry, exercise.id);
      const best = entryMetricValue(
        entry,
        customMetricKey(exercise.id),
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
    ? sanitizeCustomExercises(exercisesOrSettings)
    : [];
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
    throw new Error(
      `Die Sicherung enthält mehr als ${MAX_BACKUP_ENTRIES} Einträge.`,
    );
  if (parsed.version > BACKUP_VERSION)
    throw new Error(
      "Diese Sicherung wurde mit einer neueren MeTrack-Version erstellt.",
    );

  const rawExercises = parsed.version >= 3 ? parsed.exercises : [];
  const catalogValidation = validateExerciseCatalog(rawExercises);
  if (!catalogValidation.valid)
    throw new Error("Der Katalog der eigenen Übungen ist ungültig.");
  const exercises = sanitizeCustomExercises(rawExercises);
  parsed.entries.forEach((entry, index) => {
    if (entry?.date > todayLocal() || !validateEntry(entry, exercises).valid)
      throw new Error(`Eintrag ${index + 1} der Sicherung ist ungültig.`);
  });
  const entries = normalizeEntries(parsed.entries, exercises);
  if (parsed.entries.length > 0 && entries.length === 0)
    throw new Error("Die Sicherung enthält keine gültigen Einträge.");
  return {
    entries,
    exercises,
    settings:
      parsed.settings && typeof parsed.settings === "object"
        ? parsed.settings
        : {},
    exportedAt: parsed.exportedAt ?? null,
  };
}

export function mergeExerciseCatalog(currentExercises, importedExercises) {
  const currentValidation = validateExerciseCatalog(currentExercises);
  const importedValidation = validateExerciseCatalog(importedExercises);
  if (!currentValidation.valid || !importedValidation.valid)
    throw new Error("Der Übungskatalog ist ungültig.");
  const merged = sanitizeCustomExercises(currentExercises);
  const byId = new Map(merged.map((exercise) => [exercise.id, exercise]));
  const names = new Map(
    merged.map((exercise) => [
      exercise.name.toLocaleLowerCase("de-DE"),
      exercise,
    ]),
  );
  for (const incoming of sanitizeCustomExercises(importedExercises)) {
    const current = byId.get(incoming.id);
    if (current) {
      if (current.kind !== incoming.kind)
        throw new Error(`Die Übung „${incoming.name}“ hat einen Typkonflikt.`);
      if (!current.active && incoming.active) current.active = true;
      continue;
    }
    const sameName = names.get(incoming.name.toLocaleLowerCase("de-DE"));
    if (sameName)
      throw new Error(
        `Die Übung „${incoming.name}“ ist bereits mit einer anderen ID vorhanden.`,
      );
    if (merged.length >= MAX_CUSTOM_EXERCISES)
      throw new Error(
        `Es sind höchstens ${MAX_CUSTOM_EXERCISES} eigene Übungen möglich.`,
      );
    merged.push({ ...incoming });
    byId.set(incoming.id, incoming);
    names.set(incoming.name.toLocaleLowerCase("de-DE"), incoming);
  }
  return merged;
}

export function mergeEntries(currentEntries, importedEntries, exercises = []) {
  const catalog = sanitizeCustomExercises(exercises);
  const byDate = new Map(
    normalizeEntries(currentEntries, catalog).map((entry) => [
      entry.date,
      entry,
    ]),
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
