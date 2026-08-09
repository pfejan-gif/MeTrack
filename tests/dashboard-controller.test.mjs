import assert from "node:assert/strict";
import test from "node:test";

import { exerciseHistoryValue } from "../assets/app/dashboard-controller.js";

const stretch = {
  id: "custom-hip-stretch",
  name: "Hüftstrecker",
  kind: "stretch",
  active: true,
};

function entry(completed) {
  return {
    date: "2026-08-09",
    exerciseSets: [],
    exerciseChecks:
      completed === null ? [] : [{ exerciseId: stretch.id, completed }],
    weight: null,
    waist: null,
  };
}

test("zeigt im Verlauf nur tatsächlich erledigte Dehnungen", () => {
  assert.equal(exerciseHistoryValue(entry(true), stretch), "Erledigt ✓");
  assert.equal(exerciseHistoryValue(entry(false), stretch), null);
  assert.equal(exerciseHistoryValue(entry(null), stretch), null);
});
