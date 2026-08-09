import {
  BODY_METRIC_KEYS,
  DEFAULT_EXERCISES,
  EXERCISE_KEYS,
  LEGACY_EXERCISE_BY_ID,
} from "./constants.js";
import {
  exerciseIdFromMetric,
  sanitizeExerciseCatalog,
} from "./exercises.js";
import {
  entryExerciseCompletion,
  normalizeEntries,
  rawExerciseValues,
} from "./entries.js";
import { isIsoDate, todayLocal } from "./value-utils.js";

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
  const exercise = sanitizeExerciseCatalog(exercises).find(
    (item) => item.id === exerciseId,
  );
  if (!exerciseId || !exercise) return null;
  if (exercise.kind === "stretch") {
    const completed = entryExerciseCompletion(entry, exerciseId);
    return completed === true ? 1 : null;
  }
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

function calculateDateStreak(dates, referenceDate) {
  const uniqueDates = [...new Set(dates.filter((date) => date <= referenceDate))]
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

export function calculateStreak(
  entries,
  referenceDate = todayLocal(),
  exercises = DEFAULT_EXERCISES,
) {
  return calculateDateStreak(
    normalizeEntries(entries, exercises).map((entry) => entry.date),
    referenceDate,
  );
}

export function exerciseCompletionSummary(
  entries,
  exerciseId,
  exercises = DEFAULT_EXERCISES,
) {
  const exercise = sanitizeExerciseCatalog(exercises).find(
    (item) => item.id === exerciseId && item.kind === "stretch",
  );
  if (!exercise) return { completed: 0 };
  const completed = normalizeEntries(entries, exercises).filter(
    (entry) => entryExerciseCompletion(entry, exerciseId) === true,
  ).length;
  return { completed };
}
