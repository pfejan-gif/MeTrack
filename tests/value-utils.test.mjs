import assert from "node:assert/strict";
import test from "node:test";

import {
  TIMER_MAX_MS,
  formatNumber,
  formatStopwatch,
  parseNumber,
  timerElapsedMs,
  timerRecordedSeconds,
} from "../assets/core.js";

test("parst deutsche Dezimalzahlen und leere Werte", () => {
  assert.equal(parseNumber("82,4"), 82.4);
  assert.equal(parseNumber(" 95.1 "), 95.1);
  assert.equal(parseNumber(""), null);
  assert.equal(formatNumber(82.4, 1), "82,4");
});

test("berechnet die Stoppuhr aus Zeitstempeln statt Intervall-Schritten", () => {
  assert.equal(
    timerElapsedMs(
      { running: true, startedAt: 10_000, accumulatedMs: 2_500 },
      14_250,
    ),
    6_750,
  );
  assert.equal(
    timerElapsedMs({ running: false, startedAt: null, accumulatedMs: 6_750 }),
    6_750,
  );
  assert.equal(timerRecordedSeconds(45_760), 46);
  assert.equal(
    timerElapsedMs(
      { running: true, startedAt: 0, accumulatedMs: 10_000 },
      TIMER_MAX_MS + 20_000,
    ),
    TIMER_MAX_MS,
  );
  assert.equal(timerElapsedMs({ accumulatedMs: -10 }), 0);
});

test("formatiert kurze und lange Stoppuhrzeiten lesbar", () => {
  assert.equal(formatStopwatch(45_890), "00:45,8");
  assert.equal(formatStopwatch(3_725_400), "1:02:05,4");
});

