import assert from "node:assert/strict";
import test from "node:test";

import {
  HISTORY_PAGE_SIZE,
  createHistoryController,
  exerciseHistoryValue,
  formatHistoryDay,
  formatHistoryMonth,
  groupHistoryEntries,
  historyEntrySummary,
} from "../assets/app/history-controller.js";

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

test("gruppiert die kompakte Historie nach Monaten", () => {
  const groups = groupHistoryEntries([
    { date: "2026-09-01" },
    { date: "2026-08-09" },
    { date: "2026-08-08" },
    { date: "2025-12-31" },
  ]);

  assert.equal(HISTORY_PAGE_SIZE, 20);
  assert.deepEqual(
    groups.map(({ key, entries }) => [key, entries.length]),
    [
      ["2026-09", 1],
      ["2026-08", 2],
      ["2025-12", 1],
    ],
  );
  assert.equal(formatHistoryMonth("2026-08-09"), "August 2026");
  assert.match(formatHistoryDay("2026-08-09"), /09\. Aug/);
});

test("fasst sichtbare Tageswerte für die geschlossene Karte zusammen", () => {
  const plank = {
    id: "exercise-plank",
    name: "Plank",
    kind: "seconds",
    active: true,
  };
  const dailyEntry = {
    date: "2026-08-09",
    exerciseSets: [
      { exerciseId: plank.id, values: [80, 0, null] },
    ],
    exerciseChecks: [{ exerciseId: stretch.id, completed: true }],
    weight: 79.9,
    waist: 95,
  };

  assert.deepEqual(historyEntrySummary(dailyEntry, [plank, stretch]), [
    { kind: "training", label: "1 Übung" },
    { kind: "stretch", label: "1 Dehnung" },
    { kind: "body", label: "79,9 kg" },
    { kind: "body", label: "95,0 cm" },
  ]);
});

test("zählt nicht erledigte Dehnungen nicht in der Tageszusammenfassung", () => {
  const dailyEntry = entry(false);
  dailyEntry.weight = 0;

  assert.deepEqual(historyEntrySummary(dailyEntry, [stretch]), [
    { kind: "body", label: "0,0 kg" },
  ]);
});

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.hidden = false;
    this.open = false;
    this.textContent = "";
    this.className = "";
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = children;
  }

  setAttribute(name, value) {
    this[name] = String(value);
  }
}

function descendantsWithClass(element, className) {
  const matches = [];
  for (const child of element.children) {
    if (!(child instanceof FakeElement)) continue;
    if (child.className.split(" ").includes(className)) matches.push(child);
    matches.push(...descendantsWithClass(child, className));
  }
  return matches;
}

test("rendert viele Einträge kompakt, begrenzt und aufklappbar", () => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
    createElementNS: (_namespace, tagName) => new FakeElement(tagName),
  };

  try {
    const elements = Object.fromEntries(
      [
        "historyEmpty",
        "desktopHistory",
        "mobileHistory",
        "showMoreHistoryButton",
        "entryCount",
        "historyRows",
      ].map((key) => [key, new FakeElement("div")]),
    );
    const entries = Array.from({ length: 21 }, (_, index) => ({
      date: `2026-08-${String(index + 1).padStart(2, "0")}`,
      exerciseSets: [],
      exerciseChecks: [],
      weight: 80,
      waist: null,
    }));
    const controller = createHistoryController({
      state: { entries, exercises: [], historyLimit: HISTORY_PAGE_SIZE },
      elements,
    });

    controller.renderHistory();

    const cards = descendantsWithClass(elements.mobileHistory, "history-item");
    assert.equal(elements.entryCount.textContent, "21 Einträge · 20 angezeigt");
    assert.equal(elements.showMoreHistoryButton.hidden, false);
    assert.equal(
      elements.showMoreHistoryButton.textContent,
      "1 weiteren Eintrag anzeigen",
    );
    assert.equal(cards.length, 20);
    assert.equal(cards.filter((card) => card.open).length, 1);
    assert.equal(elements.mobileHistory.children.length, 1);
  } finally {
    globalThis.document = previousDocument;
  }
});
