import {
  BODY_METRIC_KEYS,
  SET_COUNT,
  entryExerciseCompletion,
  entryExerciseValues,
  exerciseCheckFieldName,
  exerciseFieldName,
  formatDate,
  isCompletionExercise,
  removeEntry,
  todayLocal,
  upsertEntry,
  validateEntry,
} from "../core.js";
import {
  InvalidEntryDraftError,
  createEntryDraft,
  entryDraftHasContent,
  entryDraftHasInputValues,
  entryDraftMatchesEntry,
  entryDraftProgress,
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
  openEntryView,
  onEditingFinished,
}) {
  let currentDraft = null;
  let displayedEntryDate = null;
  let knownToday = todayLocal();

  function setFormMode(mode = "new") {
    const labels = {
      new: ["Neuer Eintrag", "Eintrag speichern"],
      current: ["Aktueller Tagesstand", "Tagesstand aktualisieren"],
      editing: ["Eintrag bearbeiten", "Änderungen speichern"],
    };
    const [status, action] = labels[mode] || labels.new;
    elements.formMode.textContent = status;
    elements.saveButtonLabel.textContent = action;
    elements.cancelEditButton.hidden = mode !== "editing";
  }

  function setDraftStatus(message = "", status = "") {
    elements.draftStatus.textContent = message;
    elements.draftStatus.dataset.state = status;
    elements.draftStatus.hidden = message === "";
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
      if (isCompletionExercise(exercise)) {
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
      baseEntryDate: state.editingDate ? null : displayedEntryDate,
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

  function clearEntryValues() {
    for (const key of BODY_METRIC_KEYS) $(key).value = "";
    for (const exercise of state.exercises.filter((item) => item.active)) {
      if (isCompletionExercise(exercise)) {
        const input = $(exerciseCheckFieldName(exercise.id));
        if (input) input.checked = false;
        continue;
      }
      for (let index = 0; index < SET_COUNT; index += 1) {
        const input = $(exerciseFieldName(exercise.id, index));
        if (input) input.value = "";
      }
    }
  }

  function fillEntryValues(entry) {
    for (const key of BODY_METRIC_KEYS) $(key).value = entry[key] ?? "";
    for (const exercise of state.exercises.filter((item) => item.active)) {
      if (isCompletionExercise(exercise)) {
        const input = $(exerciseCheckFieldName(exercise.id));
        if (input)
          input.checked = entryExerciseCompletion(entry, exercise.id) === true;
        continue;
      }
      entryExerciseValues(entry, exercise.id).forEach((value, index) => {
        const input = $(exerciseFieldName(exercise.id, index));
        if (input) input.value = value ?? "";
      });
    }
  }

  function draftMatchesDisplayedEntry(draft) {
    if (
      !draft.baseEntryDate ||
      draft.date !== draft.baseEntryDate ||
      state.editingDate
    )
      return false;
    const entry = state.entries.find(
      (item) => item.date === draft.baseEntryDate,
    );
    return entryDraftMatchesEntry(draft, entry, state.exercises);
  }

  function loadEntryForDate(date) {
    clearEntryValues();
    currentDraft = null;
    const entry = state.entries.find((item) => item.date === date) || null;
    displayedEntryDate = entry?.date ?? null;
    if (entry) fillEntryValues(entry);
    setFormMode(entry ? "current" : "new");
    clearErrors();
    renderEntryProgress();
    setDraftStatus();
    return entry;
  }

  function renderEntryProgress(draft = null) {
    const progress = entryDraftProgress(draft || draftFromForm(), state.exercises);
    const label = progress.total === 0
      ? "Keine aktiven Trainingseinträge"
      : `${progress.completed} von ${progress.total} erfasst`;
    elements.entryProgressWrap.hidden = progress.total === 0;
    elements.entryProgressLabel.textContent = label;
    elements.entryProgress.max = Math.max(progress.total, 1);
    elements.entryProgress.value = progress.completed;
    elements.entryProgress.textContent = label;
    elements.entryProgress.setAttribute("aria-label", label);
    return progress;
  }

  function saveDraft() {
    try {
      const draft = draftFromForm();
      renderEntryProgress(draft);
      if (draftMatchesDisplayedEntry(draft)) {
        clearDraft();
        setDraftStatus();
        return true;
      }
      if (!entryDraftHasContent(draft, todayLocal())) {
        clearDraft();
        setDraftStatus();
        return true;
      }
      currentDraft = writeEntryDraft(localStorage, draft);
      setDraftStatus("Entwurf gespeichert", "saved");
      return true;
    } catch {
      setDraftStatus("Entwurf nicht gespeichert", "error");
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
    if (!draft) {
      if (
        !state.editingDate &&
        displayedEntryDate &&
        displayedEntryDate === $("date").value
      ) {
        loadEntryForDate(displayedEntryDate);
        return false;
      }
      renderEntryProgress();
      setDraftStatus();
      return false;
    }
    currentDraft = draft;
    state.editingDate =
      draft.editingDate &&
      state.entries.some((entry) => entry.date === draft.editingDate)
        ? draft.editingDate
        : null;
    displayedEntryDate =
      !state.editingDate &&
      draft.baseEntryDate === draft.date &&
      state.entries.some((entry) => entry.date === draft.baseEntryDate)
        ? draft.baseEntryDate
        : null;
    clearEntryValues();
    $("date").value = draft.date;
    for (const key of BODY_METRIC_KEYS) $(key).value = draft.bodyMetrics[key];
    for (const exercise of state.exercises.filter((item) => item.active)) {
      if (isCompletionExercise(exercise)) {
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
    setFormMode(
      state.editingDate
        ? "editing"
        : displayedEntryDate
          ? "current"
          : "new",
    );
    renderEntryProgress(draft);
    setDraftStatus("Entwurf wiederhergestellt", "restored");
    return true;
  }

  function allFormFieldIds() {
    return [
      "date",
      ...BODY_METRIC_KEYS,
      ...state.exercises
        .filter((exercise) => exercise.active)
        .flatMap((exercise) => isCompletionExercise(exercise)
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
    displayedEntryDate = null;
    elements.entryForm.reset();
    knownToday = todayLocal();
    $("date").value = knownToday;
    $("date").max = knownToday;
    loadEntryForDate(knownToday);
    if (clearStoredDraft) clearDraft();
  }

  function cancelEditing() {
    const wasEditing = Boolean(state.editingDate);
    resetForm();
    if (wasEditing) onEditingFinished?.();
  }

  function handleDateChange() {
    if (state.editingDate) return;
    const draft = draftFromForm();
    const displayed = state.entries.find(
      (entry) => entry.date === displayedEntryDate,
    );
    const pristine = displayed
      ? entryDraftMatchesEntry(draft, displayed, state.exercises)
      : !entryDraftHasInputValues(draft);
    if (!pristine) {
      displayedEntryDate = null;
      setFormMode("new");
      return;
    }
    loadEntryForDate(draft.date);
  }

  function refreshTodayEntry(today = todayLocal()) {
    $("date").max = today;
    if (today === knownToday) return false;
    const previousToday = knownToday;
    if (state.editingDate) {
      knownToday = today;
      return false;
    }
    if (
      $("date").value !== previousToday &&
      displayedEntryDate !== previousToday
    ) {
      knownToday = today;
      return false;
    }
    const draft = draftFromForm();
    const displayed = state.entries.find(
      (entry) => entry.date === displayedEntryDate,
    );
    const pristine = displayed
      ? entryDraftMatchesEntry(draft, displayed, state.exercises)
      : !entryDraftHasInputValues(draft);
    if (!pristine) return false;
    knownToday = today;
    $("date").value = today;
    loadEntryForDate(today);
    clearDraft();
    return true;
  }
  
  function startEditing(date) {
    const entry = state.entries.find((item) => item.date === date);
    if (!entry) return;
    clearDraft();
    state.editingDate = date;
    displayedEntryDate = null;
    elements.entryForm.reset();
    clearErrors();
    $("date").value = entry.date;
    $("date").max = todayLocal();
    fillEntryValues(entry);
    setFormMode("editing");
    saveDraft();
    if (openEntryView) openEntryView();
    else $("entry").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  
  function formCandidate() {
    const date = $("date").value;
    const existing = state.entries.find((entry) => entry.date === date);
    const source = state.editingDate
      ? state.entries.find((entry) => entry.date === state.editingDate)
      : existing;
    const editing = Boolean(state.editingDate);
    const replacing = editing || displayedEntryDate === date;
    const candidate = { date, exerciseSets: [], exerciseChecks: [] };
    for (const exercise of state.exercises) {
      if (isCompletionExercise(exercise)) {
        const oldCompletion = source
          ? entryExerciseCompletion(source, exercise.id)
          : null;
        let completed = oldCompletion;
        if (exercise.active) {
          const checked = $(exerciseCheckFieldName(exercise.id))?.checked === true;
          completed = !replacing && oldCompletion === true ? true : checked;
        }
        if (completed !== null)
          candidate.exerciseChecks.push({ exerciseId: exercise.id, completed });
        continue;
      }
      const oldValues = source ? entryExerciseValues(source, exercise.id) : [null, null, null];
      const values = exercise.active
        ? Array.from({ length: SET_COUNT }, (_, index) => {
            const raw = $(exerciseFieldName(exercise.id, index))?.value ?? "";
            return raw === "" && !replacing ? oldValues[index] : raw;
          })
        : oldValues;
      if (values.some((value) => value !== null && value !== ""))
        candidate.exerciseSets.push({ exerciseId: exercise.id, values });
    }
    for (const key of BODY_METRIC_KEYS) {
      const raw = $(key).value;
      candidate[key] = raw === "" && !replacing ? source?.[key] ?? "" : raw;
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
    const wasEditing = Boolean(state.editingDate);
    const wasCurrent = !wasEditing && displayedEntryDate === candidate.date;
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
        ? wasCurrent
          ? "Tagesstand aktualisiert"
          : "Tag ergänzt"
        : "Eintrag gespeichert";
    resetForm();
    render();
    showToast(`${message} ✓`);
    if (wasEditing) onEditingFinished?.();
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
    if (state.editingDate === date || displayedEntryDate === date) resetForm();
    render();
    showToast(`Eintrag vom ${formatDate(date)} gelöscht`, {
      label: "Rückgängig",
      callback: () => {
        if (persistData(upsertEntry(state.entries, deleted, null, state.exercises))) {
          if (deleted.date === todayLocal() && !state.editingDate) resetForm();
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
    renderEntryProgress,
    resetForm,
    cancelEditing,
    handleDateChange,
    refreshTodayEntry,
    startEditing,
    handleSubmit,
    handleHistoryAction,
    deleteEntry,
  };
}
