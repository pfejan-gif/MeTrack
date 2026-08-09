import {
  BODY_METRIC_KEYS,
  SET_COUNT,
  entryExerciseCompletion,
  entryExerciseValues,
  exerciseCheckFieldName,
  exerciseFieldName,
  formatDate,
  removeEntry,
  todayLocal,
  upsertEntry,
  validateEntry,
} from "../core.js";
import {
  InvalidEntryDraftError,
  createEntryDraft,
  entryDraftHasContent,
  readEntryDraft,
  removeEntryDraft,
  writeEntryDraft,
} from "./entry-draft.js";

export function createEntryController({
  state,
  elements,
  $,
  persistData,
  showToast,
  render,
}) {
  let currentDraft = null;

  function setFormMode(editing) {
    elements.formMode.textContent = editing
      ? "Eintrag bearbeiten"
      : "Neuer Eintrag";
    elements.saveButtonLabel.textContent = editing
      ? "Änderungen speichern"
      : "Eintrag speichern";
    elements.cancelEditButton.hidden = !editing;
  }

  function draftFromForm() {
    const exerciseIds = new Set(state.exercises.map((exercise) => exercise.id));
    const exerciseValues = Object.fromEntries(
      Object.entries(currentDraft?.exerciseValues || {}).filter(([exerciseId]) =>
        exerciseIds.has(exerciseId),
      ),
    );
    const exerciseChecks = Object.fromEntries(
      Object.entries(currentDraft?.exerciseChecks || {}).filter(([exerciseId]) =>
        exerciseIds.has(exerciseId),
      ),
    );
    for (const exercise of state.exercises) {
      if (exercise.kind === "stretch") {
        const input = $(exerciseCheckFieldName(exercise.id));
        if (input) exerciseChecks[exercise.id] = input.checked === true;
        continue;
      }
      const inputs = Array.from({ length: SET_COUNT }, (_, index) =>
        $(exerciseFieldName(exercise.id, index)),
      );
      if (inputs.every(Boolean))
        exerciseValues[exercise.id] = inputs.map((input) => input.value);
    }
    return createEntryDraft({
      date: $("date").value,
      editingDate: state.editingDate,
      bodyMetrics: Object.fromEntries(
        BODY_METRIC_KEYS.map((key) => [key, $(key).value]),
      ),
      exerciseValues,
      exerciseChecks,
    });
  }

  function clearDraft() {
    currentDraft = null;
    try {
      removeEntryDraft(localStorage);
    } catch {
      // Der Entwurf ist optional; der allgemeine Speicherhinweis bleibt maßgeblich.
    }
  }

  function saveDraft() {
    try {
      const draft = draftFromForm();
      if (!entryDraftHasContent(draft, todayLocal())) {
        clearDraft();
        return true;
      }
      currentDraft = writeEntryDraft(localStorage, draft);
      return true;
    } catch {
      return false;
    }
  }

  function restoreDraft() {
    let draft;
    try {
      draft = readEntryDraft(localStorage);
    } catch (error) {
      clearDraft();
      if (error instanceof InvalidEntryDraftError)
        showToast("Beschädigter Entwurf wurde verworfen.");
      return false;
    }
    if (!draft) return false;
    currentDraft = draft;
    state.editingDate =
      draft.editingDate &&
      state.entries.some((entry) => entry.date === draft.editingDate)
        ? draft.editingDate
        : null;
    $("date").value = draft.date;
    for (const key of BODY_METRIC_KEYS) $(key).value = draft.bodyMetrics[key];
    for (const exercise of state.exercises.filter((item) => item.active)) {
      if (exercise.kind === "stretch") {
        const input = $(exerciseCheckFieldName(exercise.id));
        if (input && exercise.id in draft.exerciseChecks)
          input.checked = draft.exerciseChecks[exercise.id];
        continue;
      }
      const values = draft.exerciseValues[exercise.id];
      if (!values) continue;
      values.forEach((value, index) => {
        const input = $(exerciseFieldName(exercise.id, index));
        if (input) input.value = value;
      });
    }
    clearErrors();
    setFormMode(Boolean(state.editingDate));
    return true;
  }

  function allFormFieldIds() {
    return [
      "date",
      ...BODY_METRIC_KEYS,
      ...state.exercises
        .filter((exercise) => exercise.active)
        .flatMap((exercise) => exercise.kind === "stretch"
          ? [exerciseCheckFieldName(exercise.id)]
          : Array.from({ length: SET_COUNT }, (_, index) =>
              exerciseFieldName(exercise.id, index),
            )),
    ];
  }
  
  function clearErrors() {
    elements.formError.textContent = "";
    for (const id of allFormFieldIds()) {
      const field = $(id);
      const error = $(`${id}Error`);
      field?.removeAttribute("aria-invalid");
      if (error) error.textContent = "";
    }
  }
  
  function showErrors(errors) {
    clearErrors();
    elements.formError.textContent = errors.form || "Bitte prüfe die markierten Felder.";
    for (const [key, message] of Object.entries(errors)) {
      if (key === "form" || key === "exerciseSets") continue;
      const field = $(key);
      const error = $(`${key}Error`);
      field?.setAttribute("aria-invalid", "true");
      if (error) error.textContent = message;
    }
    const first = Object.keys(errors).map((key) => $(key)).find(Boolean);
    first?.focus();
  }
  
  function resetForm({ clearStoredDraft = true } = {}) {
    state.editingDate = null;
    elements.entryForm.reset();
    clearErrors();
    $("date").value = todayLocal();
    $("date").max = todayLocal();
    setFormMode(false);
    if (clearStoredDraft) clearDraft();
  }
  
  function startEditing(date) {
    const entry = state.entries.find((item) => item.date === date);
    if (!entry) return;
    clearDraft();
    state.editingDate = date;
    clearErrors();
    $("date").value = entry.date;
    for (const key of BODY_METRIC_KEYS) $(key).value = entry[key] ?? "";
    for (const exercise of state.exercises.filter((item) => item.active)) {
      if (exercise.kind === "stretch") {
        $(exerciseCheckFieldName(exercise.id)).checked =
          entryExerciseCompletion(entry, exercise.id) === true;
        continue;
      }
      const values = entryExerciseValues(entry, exercise.id);
      values.forEach((value, index) => {
        $(exerciseFieldName(exercise.id, index)).value = value ?? "";
      });
    }
    setFormMode(true);
    saveDraft();
    $("entry").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  
  function formCandidate() {
    const date = $("date").value;
    const existing = state.entries.find((entry) => entry.date === date);
    const source = state.editingDate
      ? state.entries.find((entry) => entry.date === state.editingDate)
      : existing;
    const editing = Boolean(state.editingDate);
    const candidate = { date, exerciseSets: [], exerciseChecks: [] };
    for (const exercise of state.exercises) {
      if (exercise.kind === "stretch") {
        const oldCompletion = source
          ? entryExerciseCompletion(source, exercise.id)
          : null;
        let completed = oldCompletion;
        if (exercise.active) {
          const checked = $(exerciseCheckFieldName(exercise.id))?.checked === true;
          completed = !editing && oldCompletion === true ? true : checked;
        }
        if (completed !== null)
          candidate.exerciseChecks.push({ exerciseId: exercise.id, completed });
        continue;
      }
      const oldValues = source ? entryExerciseValues(source, exercise.id) : [null, null, null];
      const values = exercise.active
        ? Array.from({ length: SET_COUNT }, (_, index) => {
            const raw = $(exerciseFieldName(exercise.id, index))?.value ?? "";
            return raw === "" && !editing ? oldValues[index] : raw;
          })
        : oldValues;
      if (values.some((value) => value !== null && value !== ""))
        candidate.exerciseSets.push({ exerciseId: exercise.id, values });
    }
    for (const key of BODY_METRIC_KEYS) {
      const raw = $(key).value;
      candidate[key] = raw === "" && !editing ? source?.[key] ?? "" : raw;
    }
    return { candidate, existing };
  }
  
  function handleSubmit(event) {
    event.preventDefault();
    const { candidate, existing } = formCandidate();
    if (candidate.date > todayLocal()) {
      showErrors({ date: "Einträge in der Zukunft sind nicht möglich." });
      return;
    }
    if (
      state.editingDate &&
      candidate.date !== state.editingDate &&
      existing
    ) {
      showErrors({ date: "Für dieses Datum gibt es bereits einen Eintrag." });
      return;
    }
    const validation = validateEntry(candidate, state.exercises);
    if (!validation.valid) {
      showErrors(validation.errors);
      return;
    }
    const entries = upsertEntry(
      state.entries,
      validation.entry,
      state.editingDate,
      state.exercises,
    );
    if (!persistData(entries)) return;
    const message = state.editingDate
      ? "Änderungen gespeichert"
      : existing
        ? "Tag ergänzt"
        : "Eintrag gespeichert";
    resetForm();
    render();
    showToast(`${message} ✓`);
  }
  
  function handleHistoryAction(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    if (button.dataset.action === "edit") startEditing(button.dataset.date);
    if (button.dataset.action === "delete") deleteEntry(button.dataset.date);
  }
  
  function deleteEntry(date) {
    const deleted = state.entries.find((entry) => entry.date === date);
    if (!deleted) return;
    if (!persistData(removeEntry(state.entries, date, state.exercises))) return;
    if (state.editingDate === date) resetForm();
    render();
    showToast(`Eintrag vom ${formatDate(date)} gelöscht`, {
      label: "Rückgängig",
      callback: () => {
        if (persistData(upsertEntry(state.entries, deleted, null, state.exercises))) {
          render();
          showToast("Eintrag wiederhergestellt");
        }
      },
    });
  }
  

  return {
    saveDraft,
    restoreDraft,
    clearDraft,
    resetForm,
    startEditing,
    handleSubmit,
    handleHistoryAction,
    deleteEntry,
  };
}
