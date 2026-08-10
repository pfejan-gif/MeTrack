import assert from "node:assert/strict";
import test from "node:test";

import {
  swipeDestination,
  swipeGestureIntent,
  swipeVisualOffset,
} from "../assets/app/navigation-controller.js";

test("fixiert eine Wischgeste erst nach klarer horizontaler oder vertikaler Absicht", () => {
  assert.equal(swipeGestureIntent({ deltaX: 6, deltaY: 3 }), "pending");
  assert.equal(swipeGestureIntent({ deltaX: 18, deltaY: 5 }), "horizontal");
  assert.equal(swipeGestureIntent({ deltaX: 5, deltaY: 18 }), "vertical");
  assert.equal(swipeGestureIntent({ deltaX: 14, deltaY: 13 }), "pending");
});

test("folgt horizontalen Gesten dezent und bremst an den äußeren Tabs", () => {
  const regularOffset = swipeVisualOffset("analysis", 80);
  const edgeOffset = swipeVisualOffset("today", 80);

  assert.ok(regularOffset > 20);
  assert.ok(edgeOffset > 0);
  assert.ok(edgeOffset < regularOffset / 2);
  assert.equal(swipeVisualOffset("analysis", -500), -28);
  assert.equal(swipeVisualOffset("unknown", 80), 0);
});

test("erkennt kurze schnelle Flicks, aber keine zufälligen kurzen Bewegungen", () => {
  assert.equal(
    swipeDestination("analysis", { deltaX: -40, deltaY: 4, duration: 80 }),
    "history",
  );
  assert.equal(
    swipeDestination("analysis", { deltaX: -40, deltaY: 4, duration: 200 }),
    null,
  );
});
