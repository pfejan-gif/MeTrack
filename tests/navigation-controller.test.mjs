import assert from "node:assert/strict";
import test from "node:test";

import {
  createNavigationController,
  routeFromHash,
  swipeDestination,
  viewTransitionKeyframes,
} from "../assets/app/navigation-controller.js";

class FakeElement {
  constructor(dataset = {}) {
    this.dataset = dataset;
    this.hidden = false;
    this.attributes = new Map();
    this.scrolled = false;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  scrollIntoView() {
    this.scrolled = true;
  }
}

function fixture(
  hash = "",
  { initialNow = 0, reducedMotion = false } = {},
) {
  const listeners = new Map();
  const gestureListeners = new Map();
  const animations = [];
  const sections = ["today", "analysis", "analysis", "history"].map(
    (appView) => new FakeElement({ appView }),
  );
  const links = ["today", "analysis", "history"].map(
    (viewLink) => new FakeElement({ viewLink }),
  );
  const entrySection = new FakeElement();
  const changes = [];
  const transitions = [];
  let currentTime = initialNow;
  const windowRef = {
    innerWidth: 393,
    location: { hash },
    history: {
      replaceState: (_state, _title, nextHash) => {
        windowRef.location.hash = nextHash;
      },
    },
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name) => listeners.delete(name),
    matchMedia: () => ({ matches: reducedMotion }),
    requestAnimationFrame: (callback) => callback(),
    scrollTo() {},
  };
  const gestureSurface = {
    addEventListener: (name, callback) => gestureListeners.set(name, callback),
    removeEventListener: (name) => gestureListeners.delete(name),
  };
  const transitionSurface = {
    animate: (keyframes, options) => {
      const animation = {
        cancelled: false,
        cancel() {
          this.cancelled = true;
        },
        keyframes,
        options,
      };
      animations.push(animation);
      return animation;
    },
  };
  const controller = createNavigationController({
    windowRef,
    gestureSurface,
    transitionSurface,
    sections,
    links,
    entrySection,
    beforeNavigate: (from, to) => transitions.push([from, to]),
    onViewChange: (view) => changes.push(view),
    now: () => currentTime,
  });
  return {
    animations,
    changes,
    controller,
    entrySection,
    gestureListeners,
    links,
    listeners,
    sections,
    transitions,
    windowRef,
    advanceTime: (value) => {
      currentTime += value;
    },
  };
}

function touch(identifier, clientX, clientY) {
  return { identifier, clientX, clientY };
}

function swipe(setup, { fromX, fromY, toX, toY, duration = 250, target } = {}) {
  const eventTarget = target || { closest: () => null };
  setup.gestureListeners.get("touchstart")({
    target: eventTarget,
    touches: [touch(1, fromX, fromY)],
  });
  setup.advanceTime(duration);
  setup.gestureListeners.get("touchend")({
    changedTouches: [touch(1, toX, toY)],
  });
}

test("ordnet neue und bisherige Anker den drei Ansichten zu", () => {
  assert.deepEqual(routeFromHash("#today"), {
    view: "today",
    focusEntry: false,
  });
  assert.deepEqual(routeFromHash("#entry"), {
    view: "today",
    focusEntry: true,
  });
  assert.equal(routeFromHash("#overview").view, "analysis");
  assert.equal(routeFromHash("#progress").view, "analysis");
  assert.equal(routeFromHash("#history").view, "history");
  assert.equal(routeFromHash("#unbekannt").view, "today");
});

test("ordnet deutliche horizontale Wischgesten dem benachbarten Tab zu", () => {
  assert.equal(
    swipeDestination("today", { deltaX: -80, deltaY: 8, duration: 300 }),
    "analysis",
  );
  assert.equal(
    swipeDestination("analysis", { deltaX: -80, deltaY: 8, duration: 300 }),
    "history",
  );
  assert.equal(
    swipeDestination("history", { deltaX: 80, deltaY: 8, duration: 300 }),
    "analysis",
  );
  assert.equal(
    swipeDestination("analysis", { deltaX: 80, deltaY: 8, duration: 300 }),
    "today",
  );
});

test("ignoriert Tab-Grenzen, kurze, vertikale und zu langsame Gesten", () => {
  assert.equal(
    swipeDestination("today", { deltaX: 80, deltaY: 0, duration: 200 }),
    null,
  );
  assert.equal(
    swipeDestination("history", { deltaX: -80, deltaY: 0, duration: 200 }),
    null,
  );
  assert.equal(
    swipeDestination("analysis", { deltaX: -40, deltaY: 0, duration: 200 }),
    null,
  );
  assert.equal(
    swipeDestination("analysis", { deltaX: -80, deltaY: 70, duration: 200 }),
    null,
  );
  assert.equal(
    swipeDestination("analysis", { deltaX: -80, deltaY: 0, duration: 1_001 }),
    null,
  );
});

test("erzeugt einen dezenten Übergang aus der Wischrichtung", () => {
  assert.deepEqual(viewTransitionKeyframes(1), [
    {
      opacity: 0.66,
      transform: "translate3d(28px, 0, 0) scale(0.992)",
    },
    {
      opacity: 1,
      transform: "translate3d(0, 0, 0) scale(1)",
    },
  ]);
  assert.equal(
    viewTransitionKeyframes(-1)[0].transform,
    "translate3d(-28px, 0, 0) scale(0.992)",
  );
});

test("zeigt nur die gewählte Ansicht und markiert ihre Navigation", () => {
  const { controller, links, sections, transitions } = fixture("#analysis");

  assert.equal(controller.initialize(), "analysis");
  assert.deepEqual(sections.map((section) => section.hidden), [true, false, false, true]);
  assert.equal(links[1].attributes.get("aria-current"), "page");
  assert.deepEqual(transitions, []);
});

test("speichert vor einem Ansichtswechsel und unterstützt den Eintragsanker", () => {
  const setup = fixture("#history");
  setup.controller.initialize();
  setup.windowRef.location.hash = "#entry";
  setup.listeners.get("hashchange")();

  assert.deepEqual(setup.transitions, [["history", "today"]]);
  assert.equal(setup.entrySection.scrolled, true);
  assert.equal(setup.controller.currentView, "today");
});

test("wechselt per Wischgeste zum benachbarten Tab", () => {
  const setup = fixture("#analysis");
  setup.controller.initialize();

  swipe(setup, {
    fromX: 300,
    fromY: 400,
    toX: 210,
    toY: 410,
  });

  assert.equal(setup.windowRef.location.hash, "#history");
});

test("animiert den neuen Inhalt passend zur Wischrichtung", () => {
  const setup = fixture("#analysis");
  setup.controller.initialize();

  swipe(setup, {
    fromX: 300,
    fromY: 400,
    toX: 210,
    toY: 405,
  });
  setup.listeners.get("hashchange")();

  assert.equal(setup.animations.length, 1);
  assert.equal(
    setup.animations[0].keyframes[0].transform,
    "translate3d(28px, 0, 0) scale(0.992)",
  );
  assert.deepEqual(setup.animations[0].options, {
    duration: 380,
    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  });

  swipe(setup, {
    fromX: 100,
    fromY: 400,
    toX: 190,
    toY: 405,
  });
  setup.listeners.get("hashchange")();

  assert.equal(setup.animations.length, 2);
  assert.equal(setup.animations[0].cancelled, true);
  assert.equal(
    setup.animations[1].keyframes[0].transform,
    "translate3d(-28px, 0, 0) scale(0.992)",
  );
});

test("respektiert die Systemeinstellung für reduzierte Bewegung", () => {
  const setup = fixture("#analysis", { reducedMotion: true });
  setup.controller.initialize();

  swipe(setup, {
    fromX: 300,
    fromY: 400,
    toX: 210,
    toY: 405,
  });
  setup.listeners.get("hashchange")();

  assert.equal(setup.windowRef.location.hash, "#history");
  assert.equal(setup.animations.length, 0);
});

test("ignoriert Wischgesten auf Bedienelementen und am Displayrand", () => {
  const setup = fixture("#analysis");
  setup.controller.initialize();
  const blockedTarget = { closest: () => ({}) };

  swipe(setup, {
    fromX: 300,
    fromY: 400,
    toX: 210,
    toY: 405,
    target: blockedTarget,
  });
  assert.equal(setup.windowRef.location.hash, "#analysis");

  swipe(setup, {
    fromX: 12,
    fromY: 400,
    toX: 100,
    toY: 405,
  });
  assert.equal(setup.windowRef.location.hash, "#analysis");
});
