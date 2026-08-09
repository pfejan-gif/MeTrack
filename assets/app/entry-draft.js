import {
  BODY_METRIC_KEYS,
  MAX_EXERCISES,
  SET_COUNT,
  isIsoDate,
} from "../core.js";

export const ENTRY_DRAFT_KEY = "metrack_entry_draft_v1";

const ENTRY_DRAFT_VERSION = 1;
const MAX_DRAFT_LENGTH = 20_000;
const MAX_FIELD_LENGTH = 32;
const MAX_EXERCISE_ID_LENGTH = 120;

export class InvalidEntryDraftError extends Error {
  constructor() {
    super("Gespeicherter Eintragsentwurf ist ungültig.");
    this.name = "InvalidEntryDraftError";
  }
}

function invalidDraft() {
  return new InvalidEntryDraftError();
}

function assertDraft(condition) {
  if (!condition) throw invalidDraft();
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeFieldValue(value) {
  assertDraft(typeof value === "string" && value.length <= MAX_FIELD_LENGTH);
  return value;
}

function normalizeExerciseId(value) {
  assertDraft(
    typeof value === "string" &&
      value.length > 0 &&
      value.length <= MAX_EXERCISE_ID_LENGTH &&
      /^[a-z0-9][a-z0-9-]*$/.test(value),
  );
  return value;
}

function normalizeEntryDraft(value) {
  assertDraft(isRecord(value) && value.version === ENTRY_DRAFT_VERSION);
  assertDraft(value.date === "" || isIsoDate(value.date));
  assertDraft(value.editingDate === null || isIsoDate(value.editingDate));
  assertDraft(isRecord(value.bodyMetrics));
  assertDraft(isRecord(value.exerciseValues));
  assertDraft(isRecord(value.exerciseChecks));

  const bodyMetrics = Object.fromEntries(
    BODY_METRIC_KEYS.map((key) => [
      key,
      normalizeFieldValue(value.bodyMetrics[key]),
    ]),
  );
  const valueEntries = Object.entries(value.exerciseValues);
  const checkEntries = Object.entries(value.exerciseChecks);
  assertDraft(valueEntries.length <= MAX_EXERCISES);
  assertDraft(checkEntries.length <= MAX_EXERCISES);

  const exerciseValues = {};
  for (const [rawExerciseId, rawValues] of valueEntries) {
    const exerciseId = normalizeExerciseId(rawExerciseId);
    assertDraft(Array.isArray(rawValues) && rawValues.length === SET_COUNT);
    exerciseValues[exerciseId] = rawValues.map(normalizeFieldValue);
  }

  const exerciseChecks = {};
  for (const [rawExerciseId, completed] of checkEntries) {
    const exerciseId = normalizeExerciseId(rawExerciseId);
    assertDraft(typeof completed === "boolean");
    exerciseChecks[exerciseId] = completed;
  }

  return {
    version: ENTRY_DRAFT_VERSION,
    date: value.date,
    editingDate: value.editingDate,
    bodyMetrics,
    exerciseValues,
    exerciseChecks,
  };
}

export function createEntryDraft({
  date,
  editingDate = null,
  bodyMetrics,
  exerciseValues,
  exerciseChecks,
}) {
  return normalizeEntryDraft({
    version: ENTRY_DRAFT_VERSION,
    date,
    editingDate,
    bodyMetrics,
    exerciseValues,
    exerciseChecks,
  });
}

export function entryDraftHasContent(draft, defaultDate) {
  return (
    draft.editingDate !== null ||
    draft.date !== defaultDate ||
    Object.values(draft.bodyMetrics).some((value) => value !== "") ||
    Object.values(draft.exerciseValues).some((values) =>
      values.some((value) => value !== ""),
    ) ||
    Object.values(draft.exerciseChecks).some(Boolean)
  );
}

export function entryDraftProgress(draft, exercises) {
  const active = exercises.filter((exercise) => exercise.active);
  const completed = active.filter((exercise) => {
    if (exercise.kind === "stretch")
      return draft.exerciseChecks[exercise.id] === true;
    return (draft.exerciseValues[exercise.id] || []).some(
      (value) => value !== "",
    );
  }).length;
  return { completed, total: active.length };
}

export function parseEntryDraft(raw) {
  assertDraft(typeof raw === "string" && raw.length <= MAX_DRAFT_LENGTH);
  try {
    return normalizeEntryDraft(JSON.parse(raw));
  } catch (error) {
    if (error instanceof InvalidEntryDraftError) throw error;
    throw invalidDraft();
  }
}

export function readEntryDraft(storage) {
  const raw = storage.getItem(ENTRY_DRAFT_KEY);
  return raw === null ? null : parseEntryDraft(raw);
}

export function writeEntryDraft(storage, draft) {
  const normalized = normalizeEntryDraft(draft);
  const serialized = JSON.stringify(normalized);
  storage.setItem(ENTRY_DRAFT_KEY, serialized);
  if (storage.getItem(ENTRY_DRAFT_KEY) !== serialized)
    throw new Error("Eintragsentwurf konnte nicht geprüft werden.");
  return normalized;
}

export function removeEntryDraft(storage) {
  storage.removeItem(ENTRY_DRAFT_KEY);
}
