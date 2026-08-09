import assert from "node:assert/strict";
import test from "node:test";

import { createEntryController } from "../assets/app/entry-controller.js";
import { ENTRY_DRAFT_KEY } from "../assets/app/entry-draft.js";
import {
  exerciseCheckFieldName,
  exerciseFieldName,
  todayLocal,
} from "../assets/core.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function input(value = "") {
  return {
    value,
    checked: false,
    max: "",
    removeAttribute() {},
    setAttribute() {},
    focus() {},
  };
}

function controllerFixture(storage) {
  const fields = {
    date: input(todayLocal()),
    weight: input(),
    waist: input(),
    entry: { scrollIntoView() {} },
  };
  for (let index = 0; index < 3; index += 1)
    fields[exerciseFieldName("exercise-plank", index)] = input();
  fields[exerciseCheckFieldName("stretch-hips")] = input();
  const elements = {
    entryForm: {
      reset() {
        for (const field of Object.values(fields)) {
          if ("value" in field) field.value = "";
          if ("checked" in field) field.checked = false;
        }
      },
    },
    formError: { textContent: "" },
    formMode: { textContent: "" },
    saveButtonLabel: { textContent: "" },
    cancelEditButton: { hidden: true },
    draftStatus: { textContent: "", dataset: {}, hidden: true },
    entryProgressWrap: { hidden: false },
    entryProgress: {
      max: 1,
      value: 0,
      textContent: "",
      setAttribute() {},
    },
    entryProgressLabel: { textContent: "" },
  };
  const state = {
    entries: [],
    exercises: [
      {
        id: "exercise-plank",
        name: "Plank",
        kind: "seconds",
        active: true,
      },
      {
        id: "stretch-hips",
        name: "Hüftdehnung",
        kind: "stretch",
        active: true,
      },
    ],
    editingDate: null,
  };
  const controller = createEntryController({
    state,
    elements,
    $: (id) => fields[id] || null,
    persistData: () => true,
    showToast: () => {},
    render: () => {},
  });
  return { controller, elements, fields, state, storage };
}

test("stellt ungespeicherte Formularwerte nach einem Neustart wieder her", (t) => {
  const originalLocalStorage = globalThis.localStorage;
  t.after(() => {
    if (originalLocalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalLocalStorage;
  });

  const storage = memoryStorage();
  globalThis.localStorage = storage;
  const first = controllerFixture(storage);
  first.fields.weight.value = "82,0";
  first.fields[exerciseFieldName("exercise-plank", 0)].value = "60";

  assert.equal(first.controller.saveDraft(), true);
  assert.equal(first.elements.entryProgressLabel.textContent, "1 von 2 erfasst");
  assert.equal(first.elements.draftStatus.textContent, "Entwurf gespeichert");
  assert.notEqual(storage.getItem(ENTRY_DRAFT_KEY), null);

  const reloaded = controllerFixture(storage);
  assert.equal(reloaded.controller.restoreDraft(), true);
  assert.equal(reloaded.fields.weight.value, "82,0");
  assert.equal(
    reloaded.fields[exerciseFieldName("exercise-plank", 0)].value,
    "60",
  );
  assert.equal(
    reloaded.elements.draftStatus.textContent,
    "Entwurf wiederhergestellt",
  );

  reloaded.controller.resetForm();
  assert.equal(storage.getItem(ENTRY_DRAFT_KEY), null);
});

test("zeigt einen geprüften Fortschritt inklusive erledigter Dehnung", (t) => {
  const originalLocalStorage = globalThis.localStorage;
  t.after(() => {
    if (originalLocalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalLocalStorage;
  });
  globalThis.localStorage = memoryStorage();
  const setup = controllerFixture(globalThis.localStorage);
  setup.fields[exerciseFieldName("exercise-plank", 0)].value = "0";
  setup.fields[exerciseCheckFieldName("stretch-hips")].checked = true;

  assert.equal(setup.controller.saveDraft(), true);
  assert.equal(setup.elements.entryProgressLabel.textContent, "2 von 2 erfasst");
  assert.equal(setup.elements.entryProgress.value, 2);
  assert.equal(setup.elements.draftStatus.dataset.state, "saved");
});

test("warnt sichtbar, wenn der Entwurf den Readback nicht besteht", (t) => {
  const originalLocalStorage = globalThis.localStorage;
  t.after(() => {
    if (originalLocalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalLocalStorage;
  });
  globalThis.localStorage = {
    getItem: () => "anderer Inhalt",
    setItem() {},
    removeItem() {},
  };
  const setup = controllerFixture(globalThis.localStorage);
  setup.fields.weight.value = "80";

  assert.equal(setup.controller.saveDraft(), false);
  assert.equal(setup.elements.draftStatus.textContent, "Entwurf nicht gespeichert");
  assert.equal(setup.elements.draftStatus.dataset.state, "error");
  assert.equal(setup.elements.draftStatus.hidden, false);
});
