import assert from "node:assert/strict";
import test from "node:test";

import { createEntryController } from "../assets/app/entry-controller.js";
import { ENTRY_DRAFT_KEY } from "../assets/app/entry-draft.js";
import { exerciseFieldName, todayLocal } from "../assets/core.js";

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
  assert.notEqual(storage.getItem(ENTRY_DRAFT_KEY), null);

  const reloaded = controllerFixture(storage);
  assert.equal(reloaded.controller.restoreDraft(), true);
  assert.equal(reloaded.fields.weight.value, "82,0");
  assert.equal(
    reloaded.fields[exerciseFieldName("exercise-plank", 0)].value,
    "60",
  );

  reloaded.controller.resetForm();
  assert.equal(storage.getItem(ENTRY_DRAFT_KEY), null);
});
