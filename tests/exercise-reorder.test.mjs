import assert from "node:assert/strict";
import test from "node:test";

import {
  createDataEnvelope,
  reorderExerciseCatalog,
} from "../assets/core.js";
import {
  insertionIndexForPointer,
  moveExerciseId,
} from "../assets/app/exercise-reorder-controller.js";
import { catalog } from "./helpers/core-fixtures.mjs";

test("sortiert den Katalog ohne Übungsdaten zu verändern", () => {
  const [plank, pushups, squats] = catalog;
  const reordered = reorderExerciseCatalog(catalog, [
    squats.id,
    plank.id,
    pushups.id,
  ]);

  assert.deepEqual(
    reordered.map((exercise) => exercise.id),
    [squats.id, plank.id, pushups.id],
  );
  assert.equal(reordered[0], squats);
  assert.equal(reordered[1], plank);
  assert.deepEqual(
    createDataEnvelope([], reordered).exercises.map((exercise) => exercise.id),
    [squats.id, plank.id, pushups.id],
  );
});

test("verwirft unvollständige, unbekannte und doppelte Reihenfolgen", () => {
  assert.equal(reorderExerciseCatalog(catalog, [catalog[0].id]), catalog);
  assert.equal(
    reorderExerciseCatalog(catalog, [
      catalog[0].id,
      catalog[1].id,
      "exercise-unknown",
    ]),
    catalog,
  );
  assert.equal(
    reorderExerciseCatalog(catalog, [
      catalog[0].id,
      catalog[0].id,
      catalog[2].id,
    ]),
    catalog,
  );
});

test("verschiebt Einträge per Tastatur an begrenzte Zielpositionen", () => {
  const ids = ["a", "b", "c", "d"];
  assert.deepEqual(moveExerciseId(ids, "c", 1), ["a", "c", "b", "d"]);
  assert.deepEqual(moveExerciseId(ids, "c", -20), ["c", "a", "b", "d"]);
  assert.deepEqual(moveExerciseId(ids, "b", 20), ["a", "c", "d", "b"]);
  assert.deepEqual(moveExerciseId(ids, "missing", 0), ids);
  assert.deepEqual(moveExerciseId(ids, "b", Number.NaN), ids);
  assert.deepEqual(ids, ["a", "b", "c", "d"]);
});

test("bestimmt die sichtbare Einfügelücke aus der Fingerposition", () => {
  const midpoints = [120, 220, 320];
  assert.equal(insertionIndexForPointer(midpoints, 80), 0);
  assert.equal(insertionIndexForPointer(midpoints, 120), 1);
  assert.equal(insertionIndexForPointer(midpoints, 219), 1);
  assert.equal(insertionIndexForPointer(midpoints, 400), 3);
  assert.equal(insertionIndexForPointer(midpoints, Number.NaN), 3);
  assert.equal(insertionIndexForPointer(null, 100), 0);
});
