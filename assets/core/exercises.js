import {
  defaultExerciseIcon,
  isExerciseIconAllowed,
} from "../exercise-icons.js";
import {
  BODY_METRIC_KEYS,
  DEFAULT_EXERCISES,
  EXERCISE_KEYS,
  EXERCISE_METRIC_PREFIX,
  EXERCISE_TYPES,
  MAX_EXERCISES,
  MAX_INSTRUCTION_LENGTH,
  METRICS,
} from "./constants.js";

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

export function exerciseCheckFieldName(exerciseId) {
  return `${exerciseId}-completed`;
}

export const customFieldName = exerciseFieldName;

function normalizedExerciseName(value) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizedInstructions(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .trim();
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
  const requestedIcon = String(raw.icon ?? "").trim();
  const icon = isExerciseIconAllowed(requestedIcon, kind)
    ? requestedIcon
    : defaultExerciseIcon(kind, id);
  const exercise = { id, name, kind, icon, active: raw.active !== false };
  if (kind === "stretch") {
    const instructions = normalizedInstructions(raw.instructions);
    if (
      instructions.length > MAX_INSTRUCTION_LENGTH ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(instructions)
    )
      return null;
    exercise.instructions = instructions;
  }
  return exercise;
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
    errors.kind = "Bitte wähle Wiederholungen, Zeit oder Dehnung.";
  const icon = String(raw?.icon ?? "").trim();
  if (icon && !isExerciseIconAllowed(icon, raw?.kind))
    errors.icon = "Bitte wähle ein passendes Symbol.";
  const instructions = normalizedInstructions(raw?.instructions);
  if (raw?.kind === "stretch" && instructions.length > MAX_INSTRUCTION_LENGTH)
    errors.instructions = `Die Anleitung darf höchstens ${MAX_INSTRUCTION_LENGTH} Zeichen lang sein.`;
  else if (
    raw?.kind === "stretch" &&
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(instructions)
  )
    errors.instructions = "Die Anleitung enthält ungültige Zeichen.";
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

export function reorderExerciseCatalog(exercises, orderedIds) {
  if (!Array.isArray(exercises) || !Array.isArray(orderedIds)) return exercises;
  if (exercises.length !== orderedIds.length) return exercises;
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  if (byId.size !== exercises.length) return exercises;
  const seen = new Set();
  const reordered = [];
  for (const rawId of orderedIds) {
    const id = String(rawId);
    const exercise = byId.get(id);
    if (!exercise || seen.has(id)) return exercises;
    seen.add(id);
    reordered.push(exercise);
  }
  if (reordered.every((exercise, index) => exercise === exercises[index]))
    return exercises;
  return reordered;
}

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
  if (type.completion) {
    return {
      key: exerciseMetricKey(sanitized.id),
      exerciseId: sanitized.id,
      label: sanitized.name,
      shortLabel: sanitized.name,
      unit: "",
      csvLabel: `${sanitized.name} ${type.csvUnit}`,
      decimals: 0,
      min: 0,
      max: 1,
      direction: "up",
      exercise: true,
      completion: true,
    };
  }
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
