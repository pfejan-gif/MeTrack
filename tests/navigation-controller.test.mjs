import assert from "node:assert/strict";
import test from "node:test";

import {
  createNavigationController,
  routeFromHash,
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

function fixture(hash = "") {
  const listeners = new Map();
  const sections = ["today", "analysis", "analysis", "history"].map(
    (appView) => new FakeElement({ appView }),
  );
  const links = ["today", "analysis", "history"].map(
    (viewLink) => new FakeElement({ viewLink }),
  );
  const entrySection = new FakeElement();
  const changes = [];
  const transitions = [];
  const windowRef = {
    location: { hash },
    history: {
      replaceState: (_state, _title, nextHash) => {
        windowRef.location.hash = nextHash;
      },
    },
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name) => listeners.delete(name),
    requestAnimationFrame: (callback) => callback(),
    scrollTo() {},
  };
  const controller = createNavigationController({
    windowRef,
    sections,
    links,
    entrySection,
    beforeNavigate: (from, to) => transitions.push([from, to]),
    onViewChange: (view) => changes.push(view),
  });
  return {
    changes,
    controller,
    entrySection,
    links,
    listeners,
    sections,
    transitions,
    windowRef,
  };
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
