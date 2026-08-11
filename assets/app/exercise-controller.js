import {
  EXERCISE_TYPES,
  MAX_EXERCISES,
  SET_COUNT,
  exerciseCheckFieldName,
  exerciseDefinition,
  exerciseFieldName,
  exerciseMetricKey,
  exerciseUsageCount,
  removeExerciseFromEntries,
  reorderExerciseCatalog,
  validateExercise,
} from "../core.js";
import {
  createExerciseIconImage,
  defaultExerciseIcon,
  iconOptionsForKind,
  isExerciseIconAllowed,
} from "../exercise-icons.js";
import { exerciseIconBadge } from "./exercise-icon-ui.js";
import { createExerciseReorderController } from "./exercise-reorder-controller.js";

export function createExerciseController({
  state,
  elements,
  $,
  $$,
  persistData,
  showToast,
  askForConfirmation,
  timer,
  dashboard,
  saveEntryDraft,
  restoreEntryDraft,
}) {
  const {
    clearTimer,
    createTimerButton,
    timerHasValue,
    updateTimerButtons,
  } = timer;
  const { metricFallback, render, renderMetricTabs } = dashboard;
  const exerciseReorder = createExerciseReorderController({
    list: elements.exerciseManagerList,
    scrollContainer: elements.exerciseDialog,
    statusElement: elements.exerciseReorderStatus,
    onReorder: reorderExercises,
  });

  function makeExerciseId() {
    return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
  
  function selectedExerciseIcon() {
    return elements.exerciseForm.querySelector(
      'input[name="exerciseIcon"]:checked',
    )?.value;
  }
  
  function renderExerciseIconPalette(kind, preferredIcon = "") {
    const options = iconOptionsForKind(kind);
    const selected = isExerciseIconAllowed(preferredIcon, kind)
      ? preferredIcon
      : defaultExerciseIcon(kind);
    elements.exerciseIconPalette.replaceChildren();
    for (const option of options) {
      const label = document.createElement("label");
      label.className = "exercise-icon-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "exerciseIcon";
      input.value = option.id;
      input.checked = option.id === selected;
      const tile = document.createElement("span");
      tile.className = "exercise-icon-tile";
      tile.append(createExerciseIconImage(option.id));
      const name = document.createElement("small");
      name.textContent = option.label;
      tile.append(name);
      label.append(input, tile);
      elements.exerciseIconPalette.append(label);
    }
  }
  
  function createStretchCard(exercise, checked = false) {
    const id = exerciseCheckFieldName(exercise.id);
    const card = document.createElement("article");
    card.className = "stretch-card";
    const header = document.createElement("div");
    header.className = "stretch-card-header";
    const title = document.createElement("strong");
    title.className = "stretch-card-title";
    title.textContent = exercise.name;
    header.append(exerciseIconBadge(exercise), title);
    const label = document.createElement("label");
    label.className = "stretch-check";
    label.htmlFor = id;
    const input = document.createElement("input");
    input.id = id;
    input.name = id;
    input.type = "checkbox";
    input.checked = checked;
    input.dataset.exerciseCheck = "true";
    const mark = document.createElement("span");
    mark.className = "stretch-check-mark";
    mark.setAttribute("aria-hidden", "true");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    const iconPath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    iconPath.setAttribute("d", "m5 12 4 4L19 6");
    icon.append(iconPath);
    mark.append(icon);
    const copy = document.createElement("span");
    copy.className = "stretch-check-copy";
    const action = document.createElement("strong");
    action.textContent = "Heute durchgeführt";
    const hint = document.createElement("small");
    hint.textContent = "Zum Abhaken antippen";
    copy.append(action, hint);
    label.append(input, mark, copy);
    card.append(header, label);
    if (exercise.instructions) {
      const details = document.createElement("details");
      details.className = "stretch-instructions";
      const summary = document.createElement("summary");
      summary.textContent = "Anleitung anzeigen";
      const instructions = document.createElement("p");
      instructions.textContent = exercise.instructions;
      details.append(summary, instructions);
      card.append(details);
    }
    return card;
  }
  
  function renderExerciseFields() {
    const values = new Map(
      $$('input[data-exercise-input="true"]', elements.exerciseFields).map(
        (input) => [input.id, input.value],
      ),
    );
    const checks = new Map(
      $$('input[data-exercise-check="true"]', elements.stretchFields).map(
        (input) => [input.id, input.checked],
      ),
    );
    elements.exerciseFields.replaceChildren();
    elements.stretchFields.replaceChildren();
    const active = state.exercises.filter((exercise) => exercise.active);
    const measured = active.filter((exercise) => exercise.kind !== "stretch");
    const stretches = active.filter((exercise) => exercise.kind === "stretch");
    elements.exerciseEmpty.hidden = active.length > 0;
    elements.exerciseFields.hidden = measured.length === 0;
    elements.stretchSection.hidden = stretches.length === 0;
    for (const exercise of measured) {
      const definition = exerciseDefinition(exercise);
      const type = EXERCISE_TYPES[exercise.kind];
      const fieldset = document.createElement("fieldset");
      fieldset.className = "set-card";
      const legend = document.createElement("legend");
      const heading = document.createElement("span");
      heading.className = "set-card-heading";
      const headingCopy = document.createElement("span");
      headingCopy.className = "set-card-heading-copy";
      const title = document.createElement("span");
      title.className = "set-card-title";
      title.textContent = exercise.name;
      const subtitle = document.createElement("small");
      subtitle.className = "set-card-subtitle";
      subtitle.textContent = `3 Sätze · ${type.label}`;
      headingCopy.append(title, subtitle);
      heading.append(exerciseIconBadge(exercise), headingCopy);
      legend.append(heading);
      const inputs = document.createElement("div");
      inputs.className = "set-inputs";
      for (let index = 0; index < SET_COUNT; index += 1) {
        const id = exerciseFieldName(exercise.id, index);
        const field = document.createElement("div");
        field.className = "field";
        const label = document.createElement("label");
        label.htmlFor = id;
        label.textContent = `Satz ${index + 1}`;
        const input = document.createElement("input");
        input.id = id;
        input.name = id;
        input.type = "number";
        input.min = String(definition.min);
        input.max = String(definition.max);
        input.step = "1";
        input.inputMode = "numeric";
        input.placeholder = exercise.kind === "seconds" ? "60" : "20";
        input.dataset.exerciseInput = "true";
        input.value = values.get(id) ?? "";
        const error = document.createElement("small");
        error.className = "field-error";
        error.id = `${id}Error`;
        const fieldHeader = document.createElement("div");
        fieldHeader.className = "set-field-header";
        fieldHeader.append(label);
        if (exercise.kind === "seconds") {
          fieldHeader.classList.add("has-timer");
          fieldHeader.append(createTimerButton(exercise, index));
        }
        field.append(fieldHeader, input, error);
        inputs.append(field);
      }
      fieldset.append(legend, inputs);
      elements.exerciseFields.append(fieldset);
    }
    for (const exercise of stretches) {
      const id = exerciseCheckFieldName(exercise.id);
      elements.stretchFields.append(
        createStretchCard(exercise, checks.get(id) ?? false),
      );
    }
    updateTimerButtons();
  }
  
  function managerButton(label, className, dataset, value, ariaLabel) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.dataset[dataset] = value;
    button.setAttribute("aria-label", ariaLabel);
    return button;
  }

  function reorderState() {
    const stateLabel = document.createElement("span");
    stateLabel.className = "exercise-reorder-state";
    stateLabel.textContent = "Verschieben";
    stateLabel.setAttribute("aria-hidden", "true");
    return stateLabel;
  }
  
  function renderExerciseManager() {
    exerciseReorder.cancel();
    elements.exerciseManagerList.replaceChildren();
    elements.exerciseManagerEmpty.hidden = state.exercises.length > 0;
    elements.exerciseForm.querySelector('button[type="submit"]').disabled =
      state.exercises.length >= MAX_EXERCISES && !state.editingExerciseId;
    for (const exercise of state.exercises) {
      const item = document.createElement("div");
      item.className = `exercise-manager-item${exercise.active ? "" : " archived"}`;
      item.dataset.exerciseId = exercise.id;
      item.dataset.exerciseName = exercise.name;
      if (state.exercises.length > 1) {
        item.dataset.exerciseReorder = "true";
        item.tabIndex = 0;
        item.setAttribute("role", "group");
        item.setAttribute("aria-roledescription", "sortierbarer Eintrag");
        item.setAttribute("aria-describedby", "exerciseReorderHint");
        item.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown Home End");
        item.setAttribute(
          "aria-label",
          `${exercise.name}. Gedrückt halten und verschieben. Mit Pfeiltasten ebenfalls sortierbar.`,
        );
      }
      const copy = document.createElement("div");
      copy.className = "exercise-manager-copy";
      const details = document.createElement("div");
      details.className = "exercise-manager-details";
      const name = document.createElement("strong");
      name.textContent = exercise.name;
      const detail = document.createElement("small");
      detail.textContent = `${EXERCISE_TYPES[exercise.kind].label} · ${exercise.active ? "aktiv" : "deaktiviert"}`;
      details.append(name, detail);
      if (exercise.kind === "stretch" && exercise.instructions) {
        const instructions = document.createElement("p");
        instructions.className = "exercise-manager-instructions";
        instructions.textContent = exercise.instructions;
        details.append(instructions);
      }
      copy.append(exerciseIconBadge(exercise), details);
      const actions = document.createElement("div");
      actions.className = "exercise-manager-actions";
      actions.append(
        managerButton(
          "Bearbeiten",
          "exercise-edit-button",
          "exerciseEdit",
          exercise.id,
          `${exercise.name} bearbeiten`,
        ),
        managerButton(
          exercise.active ? "Deaktivieren" : "Aktivieren",
          "exercise-toggle-button",
          "exerciseToggle",
          exercise.id,
          `${exercise.name} ${exercise.active ? "deaktivieren" : "aktivieren"}`,
        ),
        managerButton(
          "Ganz löschen",
          "exercise-delete-button",
          "exerciseDelete",
          exercise.id,
          `${exercise.name} und alle gespeicherten Werte ganz löschen`,
        ),
      );
      item.append(copy, reorderState(), actions);
      elements.exerciseManagerList.append(item);
    }
  }

  function reorderExercises(orderedIds) {
    const nextExercises = reorderExerciseCatalog(state.exercises, orderedIds);
    if (nextExercises === state.exercises) return true;
    saveEntryDraft();
    if (!persistData(state.entries, nextExercises)) {
      renderExerciseManager();
      return false;
    }
    renderExerciseCatalogUi();
    restoreEntryDraft();
    render();
    showToast("Reihenfolge gespeichert ✓");
    return true;
  }
  
  function renderExerciseCatalogUi() {
    renderExerciseFields();
    renderExerciseManager();
    renderMetricTabs();
  }
  
  function updateExerciseKindUi(preferredIcon = selectedExerciseIcon()) {
    const kind = elements.exerciseForm.querySelector(
      'input[name="exerciseKind"]:checked',
    )?.value;
    elements.exerciseInstructionsField.hidden = kind !== "stretch";
    elements.exerciseInstructions.disabled = kind !== "stretch";
    renderExerciseIconPalette(kind, preferredIcon);
  }
  
  function resetExerciseEditor() {
    state.editingExerciseId = null;
    elements.exerciseForm.reset();
    elements.exerciseNameError.textContent = "";
    elements.exerciseIconError.textContent = "";
    elements.exerciseInstructionsError.textContent = "";
    elements.exerciseSubmitLabel.textContent = "Hinzufügen";
    elements.exerciseCancelEditButton.hidden = true;
    elements.exerciseForm.querySelector('button[type="submit"]').disabled =
      state.exercises.length >= MAX_EXERCISES;
    $$('input[name="exerciseKind"]', elements.exerciseForm).forEach((input) => {
      input.disabled = false;
    });
    updateExerciseKindUi();
  }
  
  function openExerciseDialog() {
    resetExerciseEditor();
    if (typeof elements.exerciseDialog.showModal === "function") {
      elements.exerciseDialog.showModal();
      setTimeout(() => elements.exerciseName.focus(), 80);
      return;
    }
    const name = window.prompt("Wie heißt der neue Trainingseintrag?", "Sit-Ups");
    if (!name) return;
    const kindInput = window.prompt(
      "Typ eingeben: Wiederholungen, Zeit oder Dehnung",
      "Wiederholungen",
    );
    const normalizedKind = String(kindInput || "").trim().toLocaleLowerCase("de-DE");
    const kind = normalizedKind.startsWith("d")
      ? "stretch"
      : normalizedKind.startsWith("z")
        ? "seconds"
        : "reps";
    const instructions = kind === "stretch"
      ? window.prompt("Optionale Anleitung zur Dehnung:", "") || ""
      : "";
    addExercise(name, kind, instructions, defaultExerciseIcon(kind));
  }
  
  function startEditingExercise(exerciseId) {
    const exercise = state.exercises.find((item) => item.id === exerciseId);
    if (!exercise) return;
    state.editingExerciseId = exercise.id;
    elements.exerciseName.value = exercise.name;
    elements.exerciseInstructions.value = exercise.instructions || "";
    elements.exerciseNameError.textContent = "";
    elements.exerciseIconError.textContent = "";
    elements.exerciseInstructionsError.textContent = "";
    $$('input[name="exerciseKind"]', elements.exerciseForm).forEach((input) => {
      input.checked = input.value === exercise.kind;
      input.disabled = true;
    });
    elements.exerciseSubmitLabel.textContent = "Änderungen speichern";
    elements.exerciseCancelEditButton.hidden = false;
    elements.exerciseForm.querySelector('button[type="submit"]').disabled = false;
    updateExerciseKindUi(exercise.icon);
    elements.exerciseForm.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => elements.exerciseName.focus(), 80);
  }
  
  function addExercise(name, kind, instructions = "", icon = "") {
    const current = state.exercises.find(
      (exercise) => exercise.id === state.editingExerciseId,
    );
    const validation = validateExercise({
      id: current?.id || makeExerciseId(),
      name,
      kind,
      icon,
      active: current?.active ?? true,
      instructions,
    });
    elements.exerciseNameError.textContent = "";
    elements.exerciseIconError.textContent = "";
    elements.exerciseInstructionsError.textContent = "";
    if (!validation.valid) {
      elements.exerciseNameError.textContent =
        validation.errors.name || validation.errors.kind || "Ungültiger Eintrag.";
      elements.exerciseIconError.textContent = validation.errors.icon || "";
      elements.exerciseInstructionsError.textContent =
        validation.errors.instructions || "";
      return false;
    }
    if (
      state.exercises.some(
        (exercise) =>
          exercise.id !== validation.exercise.id &&
          exercise.name.toLocaleLowerCase("de-DE") ===
          validation.exercise.name.toLocaleLowerCase("de-DE"),
      )
    ) {
      elements.exerciseNameError.textContent =
        "Ein Trainingseintrag mit diesem Namen ist bereits vorhanden.";
      return false;
    }
    if (!current && state.exercises.length >= MAX_EXERCISES) {
      elements.exerciseNameError.textContent = `Du kannst höchstens ${MAX_EXERCISES} Einträge anlegen.`;
      return false;
    }
    const nextExercises = current
      ? state.exercises.map((exercise) =>
          exercise.id === current.id ? validation.exercise : exercise,
        )
      : [...state.exercises, validation.exercise];
    saveEntryDraft();
    if (!persistData(state.entries, nextExercises))
      return false;
    const edited = Boolean(current);
    resetExerciseEditor();
    renderExerciseCatalogUi();
    restoreEntryDraft();
    render();
    if (!edited && elements.exerciseDialog.open) elements.exerciseDialog.close();
    if (!edited) {
      const fieldId = validation.exercise.kind === "stretch"
        ? exerciseCheckFieldName(validation.exercise.id)
        : exerciseFieldName(validation.exercise.id, 0);
      setTimeout(() => $(fieldId)?.focus(), 100);
    }
    showToast(
      edited
        ? `${validation.exercise.name} aktualisiert ✓`
        : `${validation.exercise.name} hinzugefügt ✓`,
    );
    return true;
  }
  
  function performToggleExercise(exerciseId) {
    const current = state.exercises.find((exercise) => exercise.id === exerciseId);
    if (!current) return;
    const next = state.exercises.map((exercise) =>
      exercise.id === exerciseId
        ? { ...exercise, active: !exercise.active }
        : exercise,
    );
    saveEntryDraft();
    if (!persistData(state.entries, next)) return;
    renderExerciseCatalogUi();
    restoreEntryDraft();
    render();
    showToast(
      current.active
        ? `${current.name} deaktiviert – Werte bleiben erhalten`
        : `${current.name} aktiviert ✓`,
    );
  }
  
  function toggleExercise(exerciseId) {
    const current = state.exercises.find((exercise) => exercise.id === exerciseId);
    if (!current) return;
    if (
      current.active &&
      state.timer.exerciseId === exerciseId &&
      timerHasValue()
    ) {
      askForConfirmation({
        title: "Timer stoppen und Übung deaktivieren?",
        text: "Die noch nicht übernommene Timerzeit wird verworfen. Bereits gespeicherte Trainingswerte bleiben erhalten.",
        actionLabel: "Deaktivieren",
        callback: () => {
          clearTimer();
          performToggleExercise(exerciseId);
        },
      });
      return;
    }
    if (current.active && state.timer.exerciseId === exerciseId) clearTimer();
    performToggleExercise(exerciseId);
  }
  
  function deleteExercise(exerciseId) {
    const exercise = state.exercises.find((item) => item.id === exerciseId);
    if (!exercise) return;
    const usage = exerciseUsageCount(state.entries, exerciseId);
    askForConfirmation({
      title: `„${exercise.name}“ ganz löschen?`,
      text:
        usage > 0
          ? `Der Trainingseintrag und seine Daten an ${usage} ${usage === 1 ? "Trainingstag" : "Trainingstagen"} werden unwiderruflich entfernt. Deaktivieren würde alle Daten behalten.`
          : "Der Trainingseintrag wird unwiderruflich entfernt. Du kannst ihn stattdessen ohne Datenverlust deaktivieren.",
      actionLabel: "Ganz löschen",
      callback: () => {
        if (state.timer.exerciseId === exerciseId) clearTimer();
        const remaining = state.exercises.filter((item) => item.id !== exerciseId);
        const entries = removeExerciseFromEntries(
          state.entries,
          exerciseId,
          remaining,
        );
        saveEntryDraft();
        if (!persistData(entries, remaining)) return;
        if (state.editingExerciseId === exerciseId) resetExerciseEditor();
        if (state.metric === exerciseMetricKey(exerciseId))
          state.metric = metricFallback();
        renderExerciseCatalogUi();
        restoreEntryDraft();
        render();
        showToast(`${exercise.name} ganz gelöscht`);
      },
    });
  }
  

  return {
    renderExerciseFields,
    renderExerciseManager,
    renderExerciseCatalogUi,
    updateExerciseKindUi,
    resetExerciseEditor,
    openExerciseDialog,
    startEditingExercise,
    addExercise,
    toggleExercise,
    deleteExercise,
  };
}
