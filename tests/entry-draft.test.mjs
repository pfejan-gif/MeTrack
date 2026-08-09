import assert from "node:assert/strict";
import test from "node:test";

import {
  ENTRY_DRAFT_KEY,
  createEntryDraft,
  entryDraftHasContent,
  parseEntryDraft,
  readEntryDraft,
  removeEntryDraft,
  writeEntryDraft,
} from "../assets/app/entry-draft.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function draft(overrides = {}) {
  return createEntryDraft({
    date: "2026-08-09",
    editingDate: null,
    bodyMetrics: { weight: "82,0", waist: "" },
    exerciseValues: {
      "exercise-plank": ["60", "0", ""],
    },
    exerciseChecks: {
      "stretch-hamstrings": false,
    },
    ...overrides,
  });
}

test("speichert und liest einen unvollständigen Eintragsentwurf verlustfrei", () => {
  const storage = memoryStorage();
  const original = draft();

  assert.deepEqual(writeEntryDraft(storage, original), original);
  assert.deepEqual(readEntryDraft(storage), original);
  assert.equal(storage.getItem(ENTRY_DRAFT_KEY), JSON.stringify(original));

  removeEntryDraft(storage);
  assert.equal(readEntryDraft(storage), null);
});

test("erkennt leere und tatsächlich begonnene Entwürfe", () => {
  const empty = draft({
    bodyMetrics: { weight: "", waist: "" },
    exerciseValues: { "exercise-plank": ["", "", ""] },
    exerciseChecks: { "stretch-hamstrings": false },
  });

  assert.equal(entryDraftHasContent(empty, "2026-08-09"), false);
  assert.equal(
    entryDraftHasContent(
      createEntryDraft({ ...empty, date: "2026-08-08" }),
      "2026-08-09",
    ),
    true,
  );
  assert.equal(
    entryDraftHasContent(
      createEntryDraft({
        ...empty,
        exerciseValues: { "exercise-plank": ["0", "", ""] },
      }),
      "2026-08-09",
    ),
    true,
  );
});

test("weist beschädigte, unbekannte und übergroße Entwürfe zurück", () => {
  assert.throws(() => parseEntryDraft("{"), /ungültig/);
  assert.throws(
    () => parseEntryDraft(JSON.stringify({ ...draft(), version: 2 })),
    /ungültig/,
  );
  assert.throws(
    () =>
      parseEntryDraft(
        JSON.stringify({
          ...draft(),
          exerciseValues: { "exercise-plank": ["60", ""] },
        }),
      ),
    /ungültig/,
  );
  assert.throws(() => parseEntryDraft(" ".repeat(20_001)), /ungültig/);
});

test("akzeptiert einen Entwurf nur nach erfolgreichem Speicher-Readback", () => {
  const storage = {
    getItem: () => "anderer Inhalt",
    setItem: () => {},
    removeItem: () => {},
  };

  assert.throws(() => writeEntryDraft(storage, draft()), /geprüft/);
});
