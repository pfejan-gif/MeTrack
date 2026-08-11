import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeExerciseCatalog,
  sanitizeExerciseCatalog,
  validateExercise,
  validateExerciseCatalog,
} from "../assets/core.js";
import {
  EXERCISE_ICONS,
  defaultExerciseIcon,
  exerciseIconSource,
  iconOptionsForKind,
  isExerciseIconAllowed,
} from "../assets/exercise-icons.js";
import { catalog, plank } from "./helpers/core-fixtures.mjs";

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

test("validiert neue Übungen und verhindert doppelte Namen", () => {
  const situps = validateExercise({ id: "custom-situps", name: " Sit-Ups ", kind: "reps", active: true });
  assert.equal(situps.valid, true);
  assert.equal(situps.exercise.name, "Sit-Ups");
  assert.equal(validateExercise({ ...situps.exercise, kind: "meter" }).valid, false);
  assert.equal(validateExerciseCatalog([situps.exercise, { ...situps.exercise, id: "custom-situps-2", name: "sit-ups" }]).valid, false);
});

test("bietet getrennte, eindeutige Symbolpaletten für Übungen und Dehnungen", () => {
  const exerciseIcons = iconOptionsForKind("reps");
  const stretchIcons = iconOptionsForKind("stretch");
  assert.equal(EXERCISE_ICONS.length, 32);
  assert.equal(new Set(EXERCISE_ICONS.map((icon) => icon.id)).size, 32);
  assert.equal(
    new Set(EXERCISE_ICONS.map((icon) => exerciseIconSource(icon.id))).size,
    32,
  );
  assert.equal(exerciseIcons.length, 18);
  assert.equal(stretchIcons.length, 14);
  assert.equal(isExerciseIconAllowed("dumbbell", "seconds"), true);
  assert.equal(isExerciseIconAllowed("pistol-squat", "reps"), true);
  assert.equal(isExerciseIconAllowed("burpee", "reps"), true);
  assert.equal(isExerciseIconAllowed("wrist-stretch", "stretch"), true);
  assert.equal(
    isExerciseIconAllowed("standing-forward-fold", "stretch"),
    true,
  );
  assert.equal(isExerciseIconAllowed("standing-forward-fold", "reps"), false);
  assert.equal(isExerciseIconAllowed("hip-stretch", "reps"), false);
  assert.equal(isExerciseIconAllowed("burpee", "stretch"), false);
  assert.equal(defaultExerciseIcon("reps", plank.id), "plank");
});

test("speichert gewählte Symbole und weist Symbole der falschen Gruppe zurück", () => {
  const pistolSquats = validateExercise({
    id: "custom-pistol-squats",
    name: "Einbeinige Kniebeuge",
    kind: "reps",
    icon: "pistol-squat",
    active: true,
  });
  assert.equal(pistolSquats.valid, true);
  assert.equal(pistolSquats.exercise.icon, "pistol-squat");
  assert.equal(
    validateExercise({ ...pistolSquats.exercise, icon: "hip-stretch" }).valid,
    false,
  );
});

test("validiert Dehnungen mit optionaler Anleitung", () => {
  const stretch = validateExercise({
    id: "custom-hip-stretch",
    name: "Hüftbeuger",
    kind: "stretch",
    active: true,
    instructions: "Ausfallschritt einnehmen.\nBecken sanft nach vorn schieben.",
  });
  assert.equal(stretch.valid, true);
  assert.equal(stretch.exercise.instructions.includes("\n"), true);
  assert.equal(
    validateExercise({ ...stretch.exercise, instructions: "x".repeat(601) }).valid,
    false,
  );
});

test("führt Übungskataloge sicher zusammen und erkennt Typkonflikte", () => {
  const situps = { id: "custom-situps", name: "Sit-Ups", kind: "reps", active: false };
  const merged = mergeExerciseCatalog(catalog, [situps]);
  assert.equal(merged.length, 4);
  assert.throws(() => mergeExerciseCatalog([...catalog, situps], [{ ...situps, kind: "seconds" }]), /Typkonflikt/);
});

test("sanitisiert Kataloge deterministisch", () => {
  const situps = { id: "custom-situps", name: "Sit-Ups", kind: "reps", active: true };
  assert.deepEqual(sanitizeExerciseCatalog([situps, { ...situps }]), [
    { ...situps, icon: "activity" },
  ]);
});
