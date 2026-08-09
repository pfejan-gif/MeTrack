import assert from "node:assert/strict";
import test from "node:test";

import { chartableExercises } from "../assets/app/dashboard-controller.js";
import { catalog } from "./helpers/core-fixtures.mjs";

test("blendet Dehnungen aus der Messwertauswahl des Verlaufs aus", () => {
  const stretch = {
    id: "stretch-hips",
    name: "Hüftbeuger",
    kind: "stretch",
    icon: "hip-stretch",
    active: true,
  };

  assert.deepEqual(
    chartableExercises([...catalog, stretch]).map(({ id }) => id),
    catalog.map(({ id }) => id),
  );
});

test("behält auch deaktivierte messbare Übungen im historischen Verlauf", () => {
  const inactive = { ...catalog[0], active: false };
  assert.deepEqual(chartableExercises([inactive]), [inactive]);
});
