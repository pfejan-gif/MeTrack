import assert from "node:assert/strict";
import test from "node:test";

import { createEntryController } from "../assets/app/entry-controller.js";
import {
  ENTRY_DRAFT_KEY,
  readEntryDraft,
} from "../assets/app/entry-draft.js";
import {
  entryExerciseCompletion,
  entryExerciseValues,
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
  let currentValue = String(value);
  return {
    get value() {
      return currentValue;
    },
    set value(nextValue) {
      currentValue = String(nextValue);
    },
    checked: false,
    max: "",
    removeAttribute() {},
    setAttribute() {},
    focus() {},
  };
}

function controllerFixture(storage, { entries = [], persistData } = {}) {
  const fields = {
    date: input(todayLocal()),
    weight: input(),
    waist: input(),
    entry: { scrollIntoView() {} },
  };
  for (let index = 0; index < 3; index += 1)
    fields[exerciseFieldName("exercise-plank", index)] = input();
  fields[exerciseCheckFieldName("custom-stretch-hips")] = input();
  fields[exerciseCheckFieldName("custom-training-swimming")] = input();
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
    entries,
    exercises: [
      {
        id: "exercise-plank",
        name: "Plank",
        kind: "seconds",
        active: true,
      },
      {
        id: "custom-stretch-hips",
        name: "Hüftdehnung",
        kind: "stretch",
        active: true,
      },
      {
        id: "custom-training-swimming",
        name: "Schwimmen",
        kind: "training",
        active: true,
      },
    ],
    editingDate: null,
  };
  let persistedEntries = null;
  const controller = createEntryController({
    state,
    elements,
    $: (id) => fields[id] || null,
    persistData: persistData || ((nextEntries) => {
      persistedEntries = nextEntries;
      state.entries = nextEntries;
      return true;
    }),
    showToast: () => {},
    render: () => {},
  });
  return {
    controller,
    elements,
    fields,
    state,
    storage,
    get persistedEntries() {
      return persistedEntries;
    },
  };
}

function savedEntry(date = todayLocal()) {
  return {
    date,
    exerciseSets: [
      { exerciseId: "exercise-plank", values: [60, 55, null] },
    ],
    exerciseChecks: [
      { exerciseId: "custom-stretch-hips", completed: true },
      { exerciseId: "custom-training-swimming", completed: true },
    ],
    weight: 82.1,
    waist: 95,
  };
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
  assert.equal(first.elements.entryProgressLabel.textContent, "1 von 3 erfasst");
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

test("zeigt den gespeicherten Tagesstand für heute direkt im Formular", (t) => {
  const originalLocalStorage = globalThis.localStorage;
  t.after(() => {
    if (originalLocalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalLocalStorage;
  });
  const storage = memoryStorage();
  globalThis.localStorage = storage;
  const setup = controllerFixture(storage, { entries: [savedEntry()] });

  setup.controller.resetForm();

  assert.equal(setup.elements.formMode.textContent, "Aktueller Tagesstand");
  assert.equal(
    setup.elements.saveButtonLabel.textContent,
    "Tagesstand aktualisieren",
  );
  assert.equal(setup.elements.cancelEditButton.hidden, true);
  assert.equal(setup.fields.weight.value, "82.1");
  assert.equal(setup.fields.waist.value, "95");
  assert.deepEqual(
    Array.from({ length: 3 }, (_, index) =>
      setup.fields[exerciseFieldName("exercise-plank", index)].value),
    ["60", "55", ""],
  );
  assert.equal(
    setup.fields[exerciseCheckFieldName("custom-stretch-hips")].checked,
    true,
  );
  assert.equal(
    setup.fields[exerciseCheckFieldName("custom-training-swimming")].checked,
    true,
  );

  assert.equal(setup.controller.saveDraft(), true);
  assert.equal(storage.getItem(ENTRY_DRAFT_KEY), null);

  setup.fields.weight.value = "";
  setup.fields[exerciseFieldName("exercise-plank", 0)].value = "";
  setup.fields[exerciseCheckFieldName("custom-stretch-hips")].checked = false;
  assert.equal(setup.controller.restoreDraft(), false);
  assert.equal(setup.fields.weight.value, "82.1");
  assert.equal(
    setup.fields[exerciseFieldName("exercise-plank", 0)].value,
    "60",
  );
  assert.equal(
    setup.fields[exerciseCheckFieldName("custom-stretch-hips")].checked,
    true,
  );

  setup.fields.waist.value = "96";
  assert.equal(setup.controller.saveDraft(), true);
  assert.equal(readEntryDraft(storage).baseEntryDate, todayLocal());
});

test("lädt beim Datumswechsel nur einen unveränderten Tagesstand weiter", (t) => {
  const originalLocalStorage = globalThis.localStorage;
  t.after(() => {
    if (originalLocalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalLocalStorage;
  });
  const storage = memoryStorage();
  globalThis.localStorage = storage;
  const previousDate = new Date(`${todayLocal()}T12:00:00`);
  previousDate.setDate(previousDate.getDate() - 1);
  const previous = savedEntry(todayLocal(previousDate));
  previous.weight = 81.4;
  previous.exerciseSets[0].values = [58, null, null];
  const setup = controllerFixture(storage, {
    entries: [previous, savedEntry()],
  });
  setup.controller.resetForm();

  setup.fields.date.value = previous.date;
  setup.controller.handleDateChange();

  assert.equal(setup.fields.weight.value, "81.4");
  assert.equal(
    setup.fields[exerciseFieldName("exercise-plank", 0)].value,
    "58",
  );
  assert.equal(setup.elements.formMode.textContent, "Aktueller Tagesstand");
});

test("wechselt nach einem Tageswechsel auf den neuen heutigen Stand", (t) => {
  const originalLocalStorage = globalThis.localStorage;
  t.after(() => {
    if (originalLocalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalLocalStorage;
  });
  const storage = memoryStorage();
  globalThis.localStorage = storage;
  const setup = controllerFixture(storage, { entries: [savedEntry()] });
  setup.controller.resetForm();
  const tomorrowDate = new Date(`${todayLocal()}T12:00:00`);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = todayLocal(tomorrowDate);

  assert.equal(setup.controller.refreshTodayEntry(tomorrow), true);
  assert.equal(setup.fields.date.value, tomorrow);
  assert.equal(setup.fields.weight.value, "");
  assert.equal(setup.elements.formMode.textContent, "Neuer Eintrag");
});

test("aktualisiert den angezeigten Tagesstand einschließlich gelöschter Werte", (t) => {
  const originalLocalStorage = globalThis.localStorage;
  t.after(() => {
    if (originalLocalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalLocalStorage;
  });
  const storage = memoryStorage();
  globalThis.localStorage = storage;
  const setup = controllerFixture(storage, { entries: [savedEntry()] });
  setup.controller.resetForm();
  setup.fields.weight.value = "";
  setup.fields[exerciseFieldName("exercise-plank", 1)].value = "";
  setup.fields[exerciseCheckFieldName("custom-stretch-hips")].checked = false;

  setup.controller.handleSubmit({ preventDefault() {} });

  assert.equal(setup.elements.formError.textContent, "");
  const updated = setup.persistedEntries.find(
    (entry) => entry.date === todayLocal(),
  );
  assert.equal(updated.weight, null);
  assert.deepEqual(
    entryExerciseValues(updated, "exercise-plank"),
    [60, null, null],
  );
  assert.equal(
    entryExerciseCompletion(updated, "custom-stretch-hips"),
    false,
  );
  assert.equal(
    entryExerciseCompletion(updated, "custom-training-swimming"),
    true,
  );
  assert.equal(setup.fields.weight.value, "");
  assert.equal(
    setup.fields[exerciseFieldName("exercise-plank", 1)].value,
    "",
  );
  assert.equal(setup.elements.formMode.textContent, "Aktueller Tagesstand");
});

test("zeigt einen geprüften Fortschritt inklusive Dehnung und Training", (t) => {
  const originalLocalStorage = globalThis.localStorage;
  t.after(() => {
    if (originalLocalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalLocalStorage;
  });
  globalThis.localStorage = memoryStorage();
  const setup = controllerFixture(globalThis.localStorage);
  setup.fields[exerciseFieldName("exercise-plank", 0)].value = "0";
  setup.fields[exerciseCheckFieldName("custom-stretch-hips")].checked = true;
  setup.fields[exerciseCheckFieldName("custom-training-swimming")].checked = true;

  assert.equal(setup.controller.saveDraft(), true);
  assert.equal(setup.elements.entryProgressLabel.textContent, "3 von 3 erfasst");
  assert.equal(setup.elements.entryProgress.value, 3);
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
