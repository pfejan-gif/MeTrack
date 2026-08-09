import assert from "node:assert/strict";
import test from "node:test";

import { BODY_METRIC_KEYS } from "../assets/core.js";
import {
  BODY_METRIC_ICONS,
  bodyMetricIconDefinition,
  bodyMetricIconSource,
} from "../assets/body-metric-icons.js";

test("ordnet jedem Körperwert genau ein lokales Bild-Symbol zu", () => {
  assert.deepEqual(
    BODY_METRIC_ICONS.map(({ id }) => id),
    BODY_METRIC_KEYS,
  );
  assert.equal(
    new Set(BODY_METRIC_ICONS.map(({ src }) => src)).size,
    BODY_METRIC_KEYS.length,
  );
  for (const metricId of BODY_METRIC_KEYS) {
    assert.equal(
      bodyMetricIconSource(metricId),
      `./assets/icons/metrics/${metricId}.webp`,
    );
  }
});

test("weist unbekannte Körperwert-Symbole eindeutig zurück", () => {
  assert.throws(
    () => bodyMetricIconDefinition("body-fat"),
    /Unbekanntes Körperwert-Symbol/,
  );
});
