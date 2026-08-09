import assert from "node:assert/strict";
import test from "node:test";

import {
  TIMER_KEY,
  createTimerController,
} from "../assets/app/timer-controller.js";

test("stellt die Stoppuhr ohne Hinweis beim App-Start wieder her", (t) => {
  const originalLocalStorage = globalThis.localStorage;
  t.after(() => {
    if (originalLocalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalLocalStorage;
  });

  globalThis.localStorage = {
    getItem(key) {
      assert.equal(key, TIMER_KEY);
      return JSON.stringify({
        exerciseId: "exercise-plank",
        setIndex: 1,
        running: false,
        startedAt: null,
        accumulatedMs: 42_000,
      });
    },
  };

  const state = {
    exercises: [
      {
        id: "exercise-plank",
        name: "Plank",
        kind: "seconds",
        active: true,
      },
    ],
    timer: {
      exerciseId: null,
      setIndex: null,
      running: false,
      startedAt: null,
      accumulatedMs: 0,
      animationFrame: null,
      wakeLock: null,
      lastRenderedTenth: null,
    },
  };
  const shownToasts = [];
  const timer = createTimerController({
    state,
    elements: { exerciseFields: {} },
    $: () => null,
    $$: () => [],
    showToast: (...args) => shownToasts.push(args),
    askForConfirmation: () => {},
  });

  timer.restoreTimer();

  assert.equal(state.timer.exerciseId, "exercise-plank");
  assert.equal(state.timer.setIndex, 1);
  assert.equal(state.timer.accumulatedMs, 42_000);
  assert.deepEqual(shownToasts, []);
});
