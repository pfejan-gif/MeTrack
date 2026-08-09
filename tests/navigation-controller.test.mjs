import assert from "node:assert/strict";
import test from "node:test";

import {
  VIEW_ENTER_TRANSITION_OPTIONS,
  VIEW_EXIT_TRANSITION_OPTIONS,
  createNavigationController,
  routeFromHash,
  swipeDestination,
  viewEnterKeyframes,
  viewExitKeyframes,
} from "../assets/app/navigation-controller.js";

class FakeElement {
  constructor(dataset = {}) {
    this.dataset = dataset;
    this.hidden = false;
    this.attributes = new Map();
    this.listeners = new Map();
    this.scrolled = false;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  addEventListener(name, callback) {
    this.listeners.set(name, callback);
  }

  removeEventListener(name) {
    this.listeners.delete(name);
  }

  click(options = {}) {
    let prevented = false;
    this.listeners.get("click")?.({
      button: 0,
      defaultPrevented: false,
      preventDefault: () => {
        prevented = true;
      },
      ...options,
    });
    return prevented;
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
  const scrollCalls = [];
  const transitions = [];
  let currentTime = initialNow;
  const windowRef = {
    innerWidth: 393,
    scrollY: 0,
    location: { hash },
    history: {
      scrollRestoration: "auto",
      pushState: (_state, _title, nextHash) => {
        windowRef.location.hash = nextHash;
      },
      replaceState: (_state, _title, nextHash) => {
        windowRef.location.hash = nextHash;
      },
    },
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name) => listeners.delete(name),
    matchMedia: () => ({ matches: reducedMotion }),
    requestAnimationFrame: (callback) => callback(),
    scrollTo({ top }) {
      windowRef.scrollY = top;
      scrollCalls.push(top);
    },
  };
  const gestureSurface = {
    addEventListener: (name, callback) => gestureListeners.set(name, callback),
    removeEventListener: (name) => gestureListeners.delete(name),
  };
  const transitionSurface = {
    animate: (keyframes, options) => {
      let resolveFinished;
      let rejectFinished;
      let settled = false;
      const animation = {
        cancelled: false,
        finished: new Promise((resolve, reject) => {
          resolveFinished = resolve;
          rejectFinished = reject;
        }),
        cancel() {
          this.cancelled = true;
          if (settled) return;
          settled = true;
          rejectFinished(new Error("cancelled"));
        },
        finish() {
          if (settled) return;
          settled = true;
          resolveFinished();
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
    scrollCalls,
    sections,
    transitions,
    windowRef,
    advanceTime: (value) => {
      currentTime += value;
    },
  };
}

async function finishAnimation(animation) {
  animation.finish();
  await animation.finished;
  await Promise.resolve();
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

test("erzeugt getrennte Aus- und Einblendphasen aus der Wischrichtung", () => {
  assert.deepEqual(viewExitKeyframes(1), [
    {
      opacity: 1,
      transform: "translate3d(0, 0, 0) scale(1)",
    },
    {
      opacity: 0,
      transform: "translate3d(-32px, 0, 0) scale(0.99)",
    },
  ]);
  assert.deepEqual(viewEnterKeyframes(1), [
    {
      opacity: 0,
      transform: "translate3d(40px, 0, 0) scale(0.99)",
    },
    {
      opacity: 1,
      transform: "translate3d(0, 0, 0) scale(1)",
    },
  ]);
  assert.equal(
    viewExitKeyframes(-1)[1].transform,
    "translate3d(32px, 0, 0) scale(0.99)",
  );
  assert.equal(
    viewEnterKeyframes(-1)[0].transform,
    "translate3d(-40px, 0, 0) scale(0.99)",
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

test("behält die Scrollposition beim Tabwechsel und merkt sie je Ansicht", () => {
  const setup = fixture("#analysis");
  setup.controller.initialize();
  setup.windowRef.scrollY = 420;

  assert.equal(setup.links[2].click(), true);
  assert.equal(setup.windowRef.location.hash, "#history");
  assert.deepEqual(setup.scrollCalls, [420]);

  setup.windowRef.scrollY = 180;
  setup.links[1].click();
  assert.equal(setup.windowRef.location.hash, "#analysis");
  assert.deepEqual(setup.scrollCalls, [420, 420]);

  setup.windowRef.scrollY = 510;
  setup.links[2].click();
  assert.deepEqual(setup.scrollCalls, [420, 420, 180]);
});

test("verhindert das native Hash-Springen nur bei normalen Tabklicks", () => {
  const setup = fixture("#today");
  setup.controller.initialize();

  assert.equal(setup.links[1].click({ metaKey: true }), false);
  assert.equal(setup.windowRef.location.hash, "#today");
  assert.equal(setup.links[1].click(), true);
  assert.equal(setup.windowRef.location.hash, "#analysis");
});

test("stellt die Browser-Scrollsteuerung beim Aufräumen wieder her", () => {
  const setup = fixture("#today");
  setup.controller.initialize();
  assert.equal(setup.windowRef.history.scrollRestoration, "manual");

  setup.controller.destroy();
  assert.equal(setup.windowRef.history.scrollRestoration, "auto");
  assert.equal(setup.links[0].listeners.has("click"), false);
});

test("wechselt erst nach dem Herausgleiten zum benachbarten Tab", async () => {
  const setup = fixture("#analysis");
  setup.controller.initialize();

  swipe(setup, {
    fromX: 300,
    fromY: 400,
    toX: 210,
    toY: 410,
  });

  assert.equal(setup.windowRef.location.hash, "#analysis");
  assert.equal(setup.animations.length, 1);
  await finishAnimation(setup.animations[0]);
  assert.equal(setup.windowRef.location.hash, "#history");
});

test("animiert alte und neue Ansicht nacheinander in Wischrichtung", async () => {
  const setup = fixture("#analysis");
  setup.controller.initialize();

  swipe(setup, {
    fromX: 300,
    fromY: 400,
    toX: 210,
    toY: 405,
  });

  assert.equal(setup.animations.length, 1);
  assert.equal(
    setup.animations[0].keyframes[1].transform,
    "translate3d(-32px, 0, 0) scale(0.99)",
  );
  assert.deepEqual(setup.animations[0].options, VIEW_EXIT_TRANSITION_OPTIONS);

  await finishAnimation(setup.animations[0]);
  setup.listeners.get("hashchange")();

  assert.equal(setup.animations.length, 2);
  assert.equal(setup.animations[0].cancelled, true);
  assert.equal(
    setup.animations[1].keyframes[0].transform,
    "translate3d(40px, 0, 0) scale(0.99)",
  );
  assert.deepEqual(setup.animations[1].options, VIEW_ENTER_TRANSITION_OPTIONS);
  await finishAnimation(setup.animations[1]);

  swipe(setup, {
    fromX: 100,
    fromY: 400,
    toX: 190,
    toY: 405,
  });

  assert.equal(setup.animations.length, 3);
  assert.equal(
    setup.animations[2].keyframes[1].transform,
    "translate3d(32px, 0, 0) scale(0.99)",
  );
  await finishAnimation(setup.animations[2]);
  setup.listeners.get("hashchange")();

  assert.equal(setup.animations.length, 4);
  assert.equal(
    setup.animations[3].keyframes[0].transform,
    "translate3d(-40px, 0, 0) scale(0.99)",
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

test("ignoriert weitere Wischgesten während des Übergangs", async () => {
  const setup = fixture("#analysis");
  setup.controller.initialize();

  swipe(setup, {
    fromX: 300,
    fromY: 400,
    toX: 210,
    toY: 405,
  });
  swipe(setup, {
    fromX: 100,
    fromY: 400,
    toX: 190,
    toY: 405,
  });

  assert.equal(setup.animations.length, 1);
  assert.equal(setup.windowRef.location.hash, "#analysis");
  await finishAnimation(setup.animations[0]);
  assert.equal(setup.windowRef.location.hash, "#history");
});

test("bricht den Wischübergang bei einer direkten Navigation sauber ab", () => {
  const setup = fixture("#analysis");
  setup.controller.initialize();

  swipe(setup, {
    fromX: 300,
    fromY: 400,
    toX: 210,
    toY: 405,
  });
  setup.controller.navigate("today");

  assert.equal(setup.animations[0].cancelled, true);
  assert.equal(setup.windowRef.location.hash, "#today");
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
