import assert from "node:assert/strict";
import test from "node:test";

import {
  chartDateDomain,
  chartValueScale,
  createChartModel,
} from "../assets/app/chart-renderer.js";

test("skaliert Messpunkte innerhalb des gewählten Zeitraums nach Datum", () => {
  const entries = [
    { date: "2026-07-12" },
    { date: "2026-08-08" },
  ];
  const model = createChartModel(entries, [71, 80], {
    period: "30",
    today: "2026-08-09",
  });

  assert.deepEqual(model.dateDomain, {
    start: chartDateDomain([{ date: "2026-08-09" }], {
      period: "30",
      today: "2026-08-09",
    }).start,
    end: chartDateDomain([], { period: "30", today: "2026-08-09" }).end,
  });
  assert.ok(model.points[0].xRatio > 0);
  assert.ok(model.points[0].xRatio < 0.05);
  assert.ok(model.points[1].xRatio > 0.95);
  assert.ok(model.points[1].xRatio < 1);
});

test("nutzt für den Gesamtzeitraum den ersten und letzten Messpunkt", () => {
  const model = createChartModel(
    [{ date: "2026-07-12" }, { date: "2026-08-08" }],
    [71, 80],
    { period: "all" },
  );

  assert.equal(model.points[0].xRatio, 0);
  assert.equal(model.points[1].xRatio, 1);
});

test("erzeugt verständliche Achsenmarken mit Luft um die Messwerte", () => {
  assert.deepEqual(chartValueScale([71, 80]), {
    min: 70,
    max: 80,
    ticks: [70, 75, 80],
  });

  const constant = chartValueScale([80, 80]);
  assert.ok(constant.min < 80);
  assert.ok(constant.max > 80);
  assert.ok(constant.ticks.includes(80));
});

test("begrenzt Erledigt-Werte auf eine eindeutige Null-Eins-Skala", () => {
  assert.deepEqual(chartValueScale([1, 1], { completion: true }), {
    min: 0,
    max: 1,
    ticks: [0, 1],
  });
});
