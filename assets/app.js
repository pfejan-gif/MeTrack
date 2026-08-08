import {
  BODY_METRIC_KEYS,
  DATA_KEY,
  DATA_SCHEMA_VERSION,
  DEFAULT_EXERCISES,
  EXERCISE_TYPES,
  MAX_EXERCISES,
  METRICS,
  PREVIOUS_DATA_KEY,
  SET_COUNT,
  SETTINGS_KEY,
  STORAGE_KEY,
  V2_DATA_KEY,
  calculateStreak,
  createBackup,
  createDataEnvelope,
  entriesToCsv,
  entryExerciseValues,
  entryMetricValue,
  exerciseDefinition,
  exerciseFieldName,
  exerciseMetricKey,
  exerciseUsageCount,
  formatDate,
  formatNumber,
  mergeEntries,
  mergeExerciseCatalog,
  metricDefinition,
  migrateDataEnvelope,
  migrateLegacyEntries,
  normalizeEntries,
  parseBackup,
  removeEntry,
  removeExerciseFromEntries,
  sanitizeExerciseCatalog,
  todayLocal,
  upsertEntry,
  validateEntry,
  validateExercise,
  validateExerciseCatalog,
} from "./core.js";

const APP_VERSION = "2.2.1";
const RECOVERY_KEYS = [
  "metrack_pre_import_backup_v1",
  "metrack_pre_reset_backup_v1",
  "metrack_corrupt_payload_backup_v1",
];
const THEME_ORDER = ["system", "light", "dark"];
const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const cloneDefaults = () => DEFAULT_EXERCISES.map((item) => ({ ...item }));

const elements = {
  themeMeta: document.querySelector('meta[name="theme-color"]'),
  themeButton: $("themeButton"),
  updateButton: $("updateButton"),
  updateBanner: $("updateBanner"),
  updateBannerButton: $("updateBannerButton"),
  dismissUpdateBannerButton: $("dismissUpdateBannerButton"),
  installButton: $("installButton"),
  iosInstallCard: $("iosInstallCard"),
  dismissInstallButton: $("dismissInstallButton"),
  dataAlert: $("dataAlert"),
  dataAlertText: $("dataAlertText"),
  dataAlertActions: $("dataAlertActions"),
  downloadRawButton: $("downloadRawButton"),
  recoverImportButton: $("recoverImportButton"),
  discardCorruptButton: $("discardCorruptButton"),
  networkBanner: $("networkBanner"),
  entryForm: $("entryForm"),
  exerciseFields: $("customExerciseFields"),
  exerciseEmpty: $("customExerciseEmpty"),
  exerciseOverviewCards: $("exerciseOverviewCards"),
  openExerciseDialogButton: $("openExerciseDialogButton"),
  exerciseDialog: $("exerciseDialog"),
  exerciseForm: $("exerciseForm"),
  exerciseName: $("exerciseName"),
  exerciseNameError: $("exerciseNameError"),
  exerciseManagerList: $("exerciseManagerList"),
  exerciseManagerEmpty: $("exerciseManagerEmpty"),
  closeExerciseDialogButton: $("closeExerciseDialogButton"),
  formMode: $("formMode"),
  saveButtonLabel: $("saveButtonLabel"),
  cancelEditButton: $("cancelEditButton"),
  formError: $("formError"),
  metricTabs: $("metricTabs"),
  progressChart: $("progressChart"),
  overviewChart: $("overviewChart"),
  chartEmpty: $("chartEmpty"),
  chartSummary: $("chartSummary"),
  chartSubtitle: $("chartSubtitle"),
  historyEmpty: $("historyEmpty"),
  desktopHistory: $("desktopHistory"),
  mobileHistory: $("mobileHistory"),
  historyRows: $("historyRows"),
  showMoreHistoryButton: $("showMoreHistoryButton"),
  entryCount: $("entryCount"),
  csvButton: $("csvButton"),
  backupButton: $("backupButton"),
  importButton: $("importButton"),
  importFile: $("importFile"),
  importDialog: $("importDialog"),
  importSummary: $("importSummary"),
  confirmDialog: $("confirmDialog"),
  confirmDialogTitle: $("confirmDialogTitle"),
  confirmDialogText: $("confirmDialogText"),
  confirmActionButton: $("confirmActionButton"),
  resetButton: $("resetButton"),
  toast: $("toast"),
};

const state = {
  entries: [],
  exercises: cloneDefaults(),
  metric: exerciseMetricKey(DEFAULT_EXERCISES[0].id),
  period: "30",
  historyLimit: 50,
  editingDate: null,
  settings: { theme: "system", installHintDismissed: false },
  storageWritable: true,
  storageCorrupt: false,
  corruptStorageValue: null,
  corruptStorageKey: null,
  pendingImport: null,
  pendingConfirm: null,
  deferredInstallPrompt: null,
  waitingWorker: null,
  toastTimer: null,
};

function readSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return {
      theme: THEME_ORDER.includes(parsed.theme) ? parsed.theme : "system",
      installHintDismissed: parsed.installHintDismissed === true,
    };
  } catch {
    return { theme: "system", installHintDismissed: false };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    return true;
  } catch {
    showToast("Einstellung konnte nicht gespeichert werden.");
    return false;
  }
}

function testStorage() {
  try {
    localStorage.setItem("metrack_storage_test", "1");
    localStorage.removeItem("metrack_storage_test");
    return true;
  } catch {
    return false;
  }
}

function markStorageCorrupt(raw, key) {
  state.storageCorrupt = true;
  state.corruptStorageValue = raw;
  state.corruptStorageKey = key;
  state.storageWritable = false;
}

function writeMigratedData(data) {
  if (!state.storageWritable) return;
  try {
    const serialized = JSON.stringify(
      createDataEnvelope(data.entries, data.exercises),
    );
    localStorage.setItem(DATA_KEY, serialized);
    if (localStorage.getItem(DATA_KEY) !== serialized)
      throw new Error("Migration verification failed");
  } catch {
    state.storageWritable = false;
  }
}

function loadData() {
  state.storageWritable = testStorage();
  const candidates = [
    { key: DATA_KEY, migrate: migrateDataEnvelope },
    { key: PREVIOUS_DATA_KEY, migrate: migrateDataEnvelope },
    { key: V2_DATA_KEY, migrate: migrateDataEnvelope },
    { key: STORAGE_KEY, migrate: migrateLegacyEntries },
  ];
  for (const candidate of candidates) {
    let raw;
    try {
      raw = localStorage.getItem(candidate.key);
    } catch {
      state.storageWritable = false;
      return { entries: [], exercises: cloneDefaults() };
    }
    if (raw === null) continue;
    try {
      const parsed = JSON.parse(raw);
      const migrated = candidate.migrate(parsed);
      if (candidate.key !== DATA_KEY) writeMigratedData(migrated);
      return migrated;
    } catch {
      markStorageCorrupt(raw, candidate.key);
      return { entries: [], exercises: cloneDefaults() };
    }
  }
  return { entries: [], exercises: cloneDefaults() };
}

function persistData(
  nextEntries,
  nextExercises = state.exercises,
  { allowRecovery = false } = {},
) {
  if (state.storageCorrupt && !allowRecovery) {
    showToast("Speichern pausiert: Die vorhandenen Daten sind beschädigt.");
    return false;
  }
  if (!validateExerciseCatalog(nextExercises).valid) {
    showToast("Der Übungskatalog konnte nicht gespeichert werden.");
    return false;
  }
  try {
    const envelope = createDataEnvelope(nextEntries, nextExercises);
    const serialized = JSON.stringify(envelope);
    localStorage.setItem(DATA_KEY, serialized);
    if (localStorage.getItem(DATA_KEY) !== serialized)
      throw new Error("Storage verification failed");
    state.entries = envelope.entries;
    state.exercises = envelope.exercises;
    state.storageWritable = true;
    state.storageCorrupt = false;
    state.corruptStorageValue = null;
    state.corruptStorageKey = null;
    updateStorageUi();
    return true;
  } catch {
    state.storageWritable = false;
    updateStorageUi();
    showToast("Nicht gespeichert. Bitte prüfe den Browser-Speicher.");
    return false;
  }
}

function showToast(message, action = null) {
  clearTimeout(state.toastTimer);
  elements.toast.replaceChildren();
  const copy = document.createElement("span");
  copy.textContent = message;
  elements.toast.append(copy);
  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toast-action";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      action.callback();
      hideToast();
    }, { once: true });
    elements.toast.append(button);
  }
  elements.toast.classList.add("visible");
  state.toastTimer = setTimeout(hideToast, action ? 6000 : 2800);
}

function hideToast() {
  clearTimeout(state.toastTimer);
  elements.toast.classList.remove("visible");
}

function setText(id, value) {
  const node = $(id);
  if (node) node.textContent = value;
}

function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme;
  const labels = {
    system: "Darstellung: automatisch",
    light: "Darstellung: hell",
    dark: "Darstellung: dunkel",
  };
  elements.themeButton.setAttribute(
    "aria-label",
    `${labels[state.settings.theme]}. Zum Wechseln tippen.`,
  );
  requestAnimationFrame(() => {
    const color = getComputedStyle(document.documentElement)
      .getPropertyValue("--bg")
      .trim();
    if (color) elements.themeMeta.content = color;
    renderCharts();
  });
}

function cycleTheme() {
  const index = THEME_ORDER.indexOf(state.settings.theme);
  state.settings.theme = THEME_ORDER[(index + 1) % THEME_ORDER.length];
  saveSettings();
  applyTheme();
  showToast("Darstellung gewechselt ✓");
}

function makeExerciseId() {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function renderExerciseFields() {
  const values = new Map(
    $$('input[data-exercise-input="true"]', elements.exerciseFields).map(
      (input) => [input.id, input.value],
    ),
  );
  elements.exerciseFields.replaceChildren();
  const active = state.exercises.filter((exercise) => exercise.active);
  elements.exerciseEmpty.hidden = active.length > 0;
  for (const exercise of active) {
    const definition = exerciseDefinition(exercise);
    const type = EXERCISE_TYPES[exercise.kind];
    const fieldset = document.createElement("fieldset");
    fieldset.className = "set-card";
    const legend = document.createElement("legend");
    const title = document.createElement("span");
    title.textContent = exercise.name;
    const subtitle = document.createElement("small");
    subtitle.textContent = `3 Sätze · ${type.label}`;
    legend.append(title, subtitle);
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
      field.append(label, input, error);
      inputs.append(field);
    }
    fieldset.append(legend, inputs);
    elements.exerciseFields.append(fieldset);
  }
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

function renderExerciseManager() {
  elements.exerciseManagerList.replaceChildren();
  elements.exerciseManagerEmpty.hidden = state.exercises.length > 0;
  elements.exerciseForm.querySelector('button[type="submit"]').disabled =
    state.exercises.length >= MAX_EXERCISES;
  for (const exercise of state.exercises) {
    const item = document.createElement("div");
    item.className = `exercise-manager-item${exercise.active ? "" : " archived"}`;
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = exercise.name;
    const detail = document.createElement("small");
    detail.textContent = `${EXERCISE_TYPES[exercise.kind].label} · ${exercise.active ? "aktiv" : "deaktiviert"}`;
    copy.append(name, detail);
    const actions = document.createElement("div");
    actions.className = "exercise-manager-actions";
    actions.append(
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
    item.append(copy, actions);
    elements.exerciseManagerList.append(item);
  }
}

function renderExerciseCatalogUi() {
  renderExerciseFields();
  renderExerciseManager();
  renderMetricTabs();
}

function openExerciseDialog() {
  elements.exerciseNameError.textContent = "";
  if (typeof elements.exerciseDialog.showModal === "function") {
    elements.exerciseDialog.showModal();
    setTimeout(() => elements.exerciseName.focus(), 80);
    return;
  }
  const name = window.prompt("Wie heißt die neue Übung?", "Sit-Ups");
  if (!name) return;
  addExercise(name, window.confirm("Mit Zeit messen?") ? "seconds" : "reps");
}

function addExercise(name, kind) {
  const validation = validateExercise({
    id: makeExerciseId(),
    name,
    kind,
    active: true,
  });
  if (!validation.valid) {
    elements.exerciseNameError.textContent =
      validation.errors.name || validation.errors.kind || "Ungültige Übung.";
    return false;
  }
  if (
    state.exercises.some(
      (exercise) =>
        exercise.name.toLocaleLowerCase("de-DE") ===
        validation.exercise.name.toLocaleLowerCase("de-DE"),
    )
  ) {
    elements.exerciseNameError.textContent =
      "Eine Übung mit diesem Namen ist bereits vorhanden.";
    return false;
  }
  if (state.exercises.length >= MAX_EXERCISES) {
    elements.exerciseNameError.textContent = `Du kannst höchstens ${MAX_EXERCISES} Übungen anlegen.`;
    return false;
  }
  if (!persistData(state.entries, [...state.exercises, validation.exercise]))
    return false;
  elements.exerciseForm.reset();
  renderExerciseCatalogUi();
  resetForm();
  render();
  if (elements.exerciseDialog.open) elements.exerciseDialog.close();
  setTimeout(
    () => $(exerciseFieldName(validation.exercise.id, 0))?.focus(),
    100,
  );
  showToast(`${validation.exercise.name} hinzugefügt ✓`);
  return true;
}

function toggleExercise(exerciseId) {
  const current = state.exercises.find((exercise) => exercise.id === exerciseId);
  if (!current) return;
  const next = state.exercises.map((exercise) =>
    exercise.id === exerciseId
      ? { ...exercise, active: !exercise.active }
      : exercise,
  );
  if (!persistData(state.entries, next)) return;
  renderExerciseCatalogUi();
  resetForm();
  render();
  showToast(
    current.active
      ? `${current.name} deaktiviert – Werte bleiben erhalten`
      : `${current.name} aktiviert ✓`,
  );
}

function deleteExercise(exerciseId) {
  const exercise = state.exercises.find((item) => item.id === exerciseId);
  if (!exercise) return;
  const usage = exerciseUsageCount(state.entries, exerciseId);
  askForConfirmation({
    title: `„${exercise.name}“ ganz löschen?`,
    text:
      usage > 0
        ? `Die Übung und ihre Werte an ${usage} ${usage === 1 ? "Trainingstag" : "Trainingstagen"} werden unwiderruflich entfernt. Deaktivieren würde alle Werte behalten.`
        : "Die Übung wird unwiderruflich entfernt. Du kannst sie stattdessen ohne Datenverlust deaktivieren.",
    actionLabel: "Ganz löschen",
    callback: () => {
      const remaining = state.exercises.filter((item) => item.id !== exerciseId);
      const entries = removeExerciseFromEntries(
        state.entries,
        exerciseId,
        remaining,
      );
      if (!persistData(entries, remaining)) return;
      if (state.metric === exerciseMetricKey(exerciseId))
        state.metric = metricFallback();
      renderExerciseCatalogUi();
      resetForm();
      render();
      showToast(`${exercise.name} ganz gelöscht`);
    },
  });
}

function metricFallback() {
  return state.exercises.length
    ? exerciseMetricKey(state.exercises[0].id)
    : "weight";
}

function renderMetricTabs() {
  const valid = new Set([
    ...state.exercises.map((exercise) => exerciseMetricKey(exercise.id)),
    ...BODY_METRIC_KEYS,
  ]);
  if (!valid.has(state.metric)) state.metric = metricFallback();
  elements.metricTabs.replaceChildren();
  for (const exercise of state.exercises) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.metric = exerciseMetricKey(exercise.id);
    button.textContent = exercise.name;
    button.setAttribute("aria-pressed", String(state.metric === button.dataset.metric));
    if (!exercise.active) button.title = "Deaktivierte Übung";
    elements.metricTabs.append(button);
  }
  for (const key of BODY_METRIC_KEYS) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.metric = key;
    button.textContent = METRICS[key].shortLabel;
    button.setAttribute("aria-pressed", String(state.metric === key));
    elements.metricTabs.append(button);
  }
}

function metricSummary(key) {
  const values = state.entries
    .map((entry) => entryMetricValue(entry, key, state.exercises))
    .filter((value) => value !== null);
  const latest = values.length ? values[values.length - 1] : null;
  const previous = values.length > 1 ? values[values.length - 2] : null;
  return {
    latest,
    best: values.length ? Math.max(...values) : null,
    fromPrevious:
      latest === null || previous === null ? null : latest - previous,
  };
}

function signed(value, decimals, unit) {
  if (value === null) return null;
  return `${value > 0 ? "+" : ""}${formatNumber(value, decimals)} ${unit}`;
}

function renderOverview() {
  const weight = metricSummary("weight");
  const waist = metricSummary("waist");
  setText("lastWeight", formatNumber(weight.latest, 1));
  setText("lastWaist", formatNumber(waist.latest, 1));
  setText(
    "weightChange",
    signed(weight.fromPrevious, 1, "kg") || "Noch kein Vergleich",
  );
  setText(
    "waistChange",
    signed(waist.fromPrevious, 1, "cm") || "Noch kein Vergleich",
  );
  const streak = calculateStreak(state.entries, todayLocal(), state.exercises);
  setText("streakValue", `${streak} ${streak === 1 ? "Tag" : "Tage"}`);

  const active = state.exercises.filter((exercise) => exercise.active);
  const spotlight = active[0] || state.exercises[0] || null;
  if (spotlight) {
    const definition = exerciseDefinition(spotlight);
    const summary = metricSummary(exerciseMetricKey(spotlight.id));
    setText("spotlightExerciseLabel", `${spotlight.name} Bestwert`);
    setText("spotlightExerciseValue", formatNumber(summary.best));
    setText("spotlightExerciseUnit", definition.unit);
    setText(
      "spotlightExerciseTrend",
      signed(summary.fromPrevious, 0, definition.unit) || "Noch kein Vergleich",
    );
    drawChart(
      elements.overviewChart,
      filteredMetricEntries(exerciseMetricKey(spotlight.id), "all").slice(-8),
      exerciseMetricKey(spotlight.id),
      { compact: true },
    );
  } else {
    setText("spotlightExerciseLabel", "Keine Übung aktiv");
    setText("spotlightExerciseValue", "—");
    setText("spotlightExerciseUnit", "");
    setText("spotlightExerciseTrend", "Aktiviere eine Übung unter „Verwalten“");
    clearCanvas(elements.overviewChart);
  }

  elements.exerciseOverviewCards.replaceChildren();
  for (const exercise of active.slice(1)) {
    const definition = exerciseDefinition(exercise);
    const summary = metricSummary(exerciseMetricKey(exercise.id));
    const card = document.createElement("article");
    card.className = "card metric-card compact-metric-card";
    const label = document.createElement("p");
    label.className = "metric-label";
    label.textContent = exercise.name;
    const value = document.createElement("p");
    value.className = "metric-value";
    const number = document.createElement("span");
    number.textContent = formatNumber(summary.best);
    const unit = document.createElement("small");
    unit.textContent = definition.unit;
    value.append(number, " ", unit);
    const note = document.createElement("p");
    note.className = "metric-change";
    note.textContent = "Persönlicher Bestwert";
    card.append(label, value, note);
    elements.exerciseOverviewCards.append(card);
  }
}

function filteredMetricEntries(key = state.metric, period = state.period) {
  let entries = state.entries.filter(
    (entry) => entryMetricValue(entry, key, state.exercises) !== null,
  );
  if (period !== "all") {
    const boundary = new Date(`${todayLocal()}T12:00:00`);
    boundary.setDate(boundary.getDate() - Number(period) + 1);
    const iso = todayLocal(boundary);
    entries = entries.filter((entry) => entry.date >= iso);
  }
  return entries;
}

function clearCanvas(canvas) {
  const context = canvas.getContext("2d");
  context?.clearRect(0, 0, canvas.width, canvas.height);
}

function drawChart(canvas, entries, key, { compact = false } = {}) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  const context = canvas.getContext("2d");
  context.scale(ratio, ratio);
  context.clearRect(0, 0, rect.width, rect.height);
  if (!entries.length) return;
  const values = entries.map((entry) =>
    entryMetricValue(entry, key, state.exercises),
  );
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || Math.max(max * 0.1, 1);
  const pad = compact ? 8 : 26;
  const width = Math.max(1, rect.width - pad * 2);
  const height = Math.max(1, rect.height - pad * 2);
  const styles = getComputedStyle(document.documentElement);
  const mint = styles.getPropertyValue("--mint").trim() || "#0a8f65";
  context.lineWidth = compact ? 3 : 2.5;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.strokeStyle = mint;
  context.beginPath();
  values.forEach((value, index) => {
    const x = pad + (values.length === 1 ? width / 2 : (index / (values.length - 1)) * width);
    const y = pad + height - ((value - min + spread * 0.08) / (spread * 1.16)) * height;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
  if (!compact) {
    context.fillStyle = mint;
    values.forEach((value, index) => {
      const x = pad + (values.length === 1 ? width / 2 : (index / (values.length - 1)) * width);
      const y = pad + height - ((value - min + spread * 0.08) / (spread * 1.16)) * height;
      context.beginPath();
      context.arc(x, y, 3.5, 0, Math.PI * 2);
      context.fill();
    });
  }
}

function renderCharts() {
  const definition = metricDefinition(state.metric, state.exercises);
  if (!definition) {
    state.metric = metricFallback();
    return renderCharts();
  }
  const entries = filteredMetricEntries();
  const periodLabel = state.period === "all" ? "gesamter Zeitraum" : `letzte ${state.period} Tage`;
  elements.chartSubtitle.textContent = `${definition.label} · ${periodLabel}`;
  elements.chartEmpty.hidden = entries.length >= 2;
  drawChart(elements.progressChart, entries, state.metric);
  if (!entries.length) {
    elements.chartSummary.textContent = `Noch keine Werte für ${definition.label}.`;
  } else {
    const first = entryMetricValue(entries[0], state.metric, state.exercises);
    const last = entryMetricValue(entries[entries.length - 1], state.metric, state.exercises);
    elements.chartSummary.textContent = `${entries.length} ${entries.length === 1 ? "Wert" : "Werte"}. Zuletzt ${formatNumber(last, definition.decimals)} ${definition.unit}${entries.length > 1 ? ` · Veränderung ${signed(last - first, definition.decimals, definition.unit)}` : ""}.`;
  }
  elements.progressChart.setAttribute("aria-label", `${definition.label}-Verlauf: ${elements.chartSummary.textContent}`);
}

function exerciseDisplay(entry, exercise) {
  const values = entryExerciseValues(entry, exercise.id);
  if (values.every((value) => value === null)) return null;
  const unit = exerciseDefinition(exercise).unit;
  return `${values.map((value) => formatNumber(value)).join(" · ")} ${unit}`;
}

function exerciseCell(entry) {
  const cell = document.createElement("td");
  cell.className = "custom-history-cell";
  let count = 0;
  for (const exercise of state.exercises) {
    const value = exerciseDisplay(entry, exercise);
    if (!value) continue;
    const line = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = exercise.name;
    line.append(name, ` ${value}`);
    cell.append(line);
    count += 1;
  }
  if (!count) cell.textContent = "—";
  return cell;
}

function actionButton(action, date, label, danger = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `row-action${danger ? " danger" : ""}`;
  button.dataset.action = action;
  button.dataset.date = date;
  button.setAttribute("aria-label", label);
  button.textContent = action === "edit" ? "✎" : "×";
  return button;
}

function renderHistory() {
  const entries = [...state.entries].reverse();
  const visible = entries.slice(0, state.historyLimit);
  const empty = entries.length === 0;
  elements.historyEmpty.hidden = !empty;
  elements.desktopHistory.hidden = empty;
  elements.mobileHistory.hidden = empty;
  elements.showMoreHistoryButton.hidden = entries.length <= visible.length;
  elements.entryCount.textContent = empty
    ? "Noch keine Einträge"
    : `${entries.length} ${entries.length === 1 ? "Eintrag" : "Einträge"}`;
  elements.historyRows.replaceChildren();
  elements.mobileHistory.replaceChildren();
  for (const entry of visible) {
    const row = document.createElement("tr");
    const date = document.createElement("td");
    date.textContent = formatDate(entry.date);
    const weight = document.createElement("td");
    weight.textContent = entry.weight === null ? "—" : `${formatNumber(entry.weight, 1)} kg`;
    const waist = document.createElement("td");
    waist.textContent = entry.waist === null ? "—" : `${formatNumber(entry.waist, 1)} cm`;
    const actions = document.createElement("td");
    actions.className = "row-actions";
    actions.append(
      actionButton("edit", entry.date, `Eintrag vom ${formatDate(entry.date)} bearbeiten`),
      actionButton("delete", entry.date, `Eintrag vom ${formatDate(entry.date)} löschen`, true),
    );
    row.append(date, exerciseCell(entry), weight, waist, actions);
    elements.historyRows.append(row);

    const card = document.createElement("article");
    card.className = "history-item";
    const header = document.createElement("div");
    header.className = "history-item-header";
    const dateLabel = document.createElement("span");
    dateLabel.className = "history-date";
    dateLabel.textContent = formatDate(entry.date);
    const mobileActions = document.createElement("div");
    mobileActions.className = "history-item-actions";
    mobileActions.append(
      actionButton("edit", entry.date, "Eintrag bearbeiten"),
      actionButton("delete", entry.date, "Eintrag löschen", true),
    );
    header.append(dateLabel, mobileActions);
    const metrics = document.createElement("div");
    metrics.className = "history-metrics";
    const items = [
      ...state.exercises.map((exercise) => [exercise.name, exerciseDisplay(entry, exercise)]),
      ["Gewicht", entry.weight === null ? null : `${formatNumber(entry.weight, 1)} kg`],
      ["Bauch", entry.waist === null ? null : `${formatNumber(entry.waist, 1)} cm`],
    ].filter(([, value]) => value);
    for (const [label, value] of items) {
      const metric = document.createElement("div");
      metric.className = "history-metric";
      const small = document.createElement("span");
      small.textContent = label;
      const strong = document.createElement("strong");
      strong.textContent = value;
      metric.append(small, strong);
      metrics.append(metric);
    }
    card.append(header, metrics);
    elements.mobileHistory.append(card);
  }
}

function render() {
  renderOverview();
  renderHistory();
  renderMetricTabs();
  renderCharts();
  elements.csvButton.disabled = state.entries.length === 0;
  elements.backupButton.disabled = state.entries.length === 0 && state.exercises.length === 0;
}

function allFormFieldIds() {
  return [
    "date",
    ...BODY_METRIC_KEYS,
    ...state.exercises
      .filter((exercise) => exercise.active)
      .flatMap((exercise) =>
        Array.from({ length: SET_COUNT }, (_, index) =>
          exerciseFieldName(exercise.id, index),
        ),
      ),
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

function resetForm() {
  state.editingDate = null;
  elements.entryForm.reset();
  clearErrors();
  $("date").value = todayLocal();
  $("date").max = todayLocal();
  elements.formMode.textContent = "Neuer Eintrag";
  elements.saveButtonLabel.textContent = "Eintrag speichern";
  elements.cancelEditButton.hidden = true;
}

function startEditing(date) {
  const entry = state.entries.find((item) => item.date === date);
  if (!entry) return;
  state.editingDate = date;
  clearErrors();
  $("date").value = entry.date;
  for (const key of BODY_METRIC_KEYS) $(key).value = entry[key] ?? "";
  for (const exercise of state.exercises.filter((item) => item.active)) {
    const values = entryExerciseValues(entry, exercise.id);
    values.forEach((value, index) => {
      $(exerciseFieldName(exercise.id, index)).value = value ?? "";
    });
  }
  elements.formMode.textContent = "Eintrag bearbeiten";
  elements.saveButtonLabel.textContent = "Änderungen speichern";
  elements.cancelEditButton.hidden = false;
  $("entry").scrollIntoView({ behavior: "smooth", block: "start" });
}

function formCandidate() {
  const date = $("date").value;
  const existing = state.entries.find((entry) => entry.date === date);
  const source = state.editingDate
    ? state.entries.find((entry) => entry.date === state.editingDate)
    : existing;
  const editing = Boolean(state.editingDate);
  const candidate = { date, exerciseSets: [] };
  for (const exercise of state.exercises) {
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

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function timestampForFilename() {
  return new Date().toISOString().slice(0, 19).replaceAll(":", "-");
}

async function shareOrDownload(content, filename, type, title, success) {
  const file = new File([content], filename, { type });
  try {
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title, files: [file] });
      showToast(success);
      return;
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
  }
  downloadBlob(file, filename);
  showToast(success);
}

function exportCsv() {
  if (!state.entries.length) return;
  return shareOrDownload(
    entriesToCsv(state.entries, state.exercises),
    `metrack-${todayLocal()}.csv`,
    "text/csv;charset=utf-8",
    "MeTrack CSV-Export",
    "CSV exportiert",
  );
}

function exportBackup() {
  if (!state.entries.length && !state.exercises.length) return;
  return shareOrDownload(
    JSON.stringify(createBackup(state.entries, state.exercises, state.settings), null, 2),
    `metrack-sicherung-${timestampForFilename()}.json`,
    "application/json",
    "MeTrack Sicherung",
    "Sicherung gespeichert",
  );
}

function readFileAsText(file) {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(file);
  });
}

async function readImportFile(file) {
  if (!file) return;
  if (file.size > 2_000_000) {
    showToast("Die Sicherungsdatei ist zu groß.");
    return;
  }
  try {
    const parsed = parseBackup(await readFileAsText(file));
    state.pendingImport = parsed;
    const range = parsed.entries.length
      ? `${formatDate(parsed.entries[0].date)} bis ${formatDate(parsed.entries[parsed.entries.length - 1].date)}`
      : "keine Einträge";
    elements.importSummary.textContent = `Die Sicherung enthält ${parsed.entries.length} ${parsed.entries.length === 1 ? "Tag" : "Tage"} (${range}) und ${parsed.exercises.length} ${parsed.exercises.length === 1 ? "Übung" : "Übungen"}.`;
    if (typeof elements.importDialog.showModal === "function")
      elements.importDialog.showModal();
    else if (window.confirm(`${elements.importSummary.textContent}\n\nVorhandene Daten ersetzen?`))
      applyImport("replace");
    else applyImport("merge");
  } catch (error) {
    showToast(error.message || "Sicherung konnte nicht gelesen werden.");
  } finally {
    elements.importFile.value = "";
  }
}

function applyImport(mode) {
  if (!state.pendingImport || !["merge", "replace"].includes(mode)) return;
  const previousEntries = state.entries;
  const previousExercises = state.exercises;
  try {
    const exercises =
      mode === "merge"
        ? mergeExerciseCatalog(state.exercises, state.pendingImport.exercises)
        : state.pendingImport.exercises;
    const entries =
      mode === "merge"
        ? mergeEntries(state.entries, state.pendingImport.entries, exercises)
        : normalizeEntries(state.pendingImport.entries, exercises);
    if (!persistData(entries, exercises, { allowRecovery: true })) return;
    if (THEME_ORDER.includes(state.pendingImport.settings?.theme)) {
      state.settings.theme = state.pendingImport.settings.theme;
      saveSettings();
      applyTheme();
    }
  } catch (error) {
    showToast(error.message || "Sicherung konnte nicht importiert werden.");
    return;
  }
  state.pendingImport = null;
  renderExerciseCatalogUi();
  resetForm();
  render();
  showToast(mode === "merge" ? "Sicherung zusammengeführt ✓" : "Sicherung wiederhergestellt ✓", {
    label: "Rückgängig",
    callback: () => {
      if (persistData(previousEntries, previousExercises, { allowRecovery: true })) {
        renderExerciseCatalogUi();
        resetForm();
        render();
      }
    },
  });
}

function askForConfirmation({ title, text, actionLabel, callback }) {
  state.pendingConfirm = callback;
  elements.confirmDialogTitle.textContent = title;
  elements.confirmDialogText.textContent = text;
  elements.confirmActionButton.textContent = actionLabel;
  if (typeof elements.confirmDialog.showModal === "function")
    elements.confirmDialog.showModal();
  else if (window.confirm(`${title}\n\n${text}`)) callback();
}

function removeAllStorageKeys() {
  [DATA_KEY, PREVIOUS_DATA_KEY, V2_DATA_KEY, STORAGE_KEY, ...RECOVERY_KEYS].forEach(
    (key) => localStorage.removeItem(key),
  );
}

function resetAllData() {
  askForConfirmation({
    title: "Alle Daten löschen?",
    text: "Alle Einträge und deine Übungsauswahl auf diesem Gerät werden entfernt. Direkt danach ist Rückgängig möglich.",
    actionLabel: "Alle löschen",
    callback: () => {
      const previousEntries = state.entries;
      const previousExercises = state.exercises;
      try {
        removeAllStorageKeys();
        state.entries = [];
        state.exercises = cloneDefaults();
        state.storageCorrupt = false;
      } catch {
        showToast("Die Daten konnten nicht vollständig gelöscht werden.");
        return;
      }
      renderExerciseCatalogUi();
      resetForm();
      render();
      showToast("Alle Daten gelöscht", {
        label: "Rückgängig",
        callback: () => {
          if (persistData(previousEntries, previousExercises, { allowRecovery: true })) {
            renderExerciseCatalogUi();
            resetForm();
            render();
          }
        },
      });
    },
  });
}

function updateStorageUi() {
  const problem = state.storageCorrupt || !state.storageWritable;
  elements.dataAlert.hidden = !problem;
  if (!problem) return;
  if (state.storageCorrupt) {
    elements.dataAlertText.textContent = "Vorhandene MeTrack-Daten konnten nicht sicher gelesen werden und werden nicht überschrieben. Sichere die Rohdaten oder importiere eine gültige Sicherung.";
    elements.dataAlertActions.hidden = false;
  } else {
    elements.dataAlertText.textContent = "Safari stellt aktuell keinen beschreibbaren lokalen Speicher bereit. Änderungen können nicht zuverlässig gespeichert werden.";
    elements.dataAlertActions.hidden = true;
  }
}

function downloadCorruptPayload() {
  if (state.corruptStorageValue === null) return;
  downloadBlob(
    new Blob([state.corruptStorageValue], { type: "application/json" }),
    `metrack-rohdaten-${timestampForFilename()}.json`,
  );
}

function discardCorruptData() {
  askForConfirmation({
    title: "Beschädigte Daten verwerfen?",
    text: "Sichere vorher die Rohdaten. Danach startet MeTrack mit den Standardübungen und ohne Einträge.",
    actionLabel: "Verwerfen",
    callback: () => {
      try {
        removeAllStorageKeys();
        state.entries = [];
        state.exercises = cloneDefaults();
        state.storageCorrupt = false;
        state.storageWritable = testStorage();
      } catch {
        showToast("Die beschädigten Daten konnten nicht entfernt werden.");
        return;
      }
      updateStorageUi();
      renderExerciseCatalogUi();
      resetForm();
      render();
    },
  });
}

function refreshTodayUi() {
  const today = todayLocal();
  $("date").max = today;
  if (!state.editingDate && !$("date").value) $("date").value = today;
  $("todayLabel").textContent = new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date(`${today}T12:00:00`));
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

function updateInstallUi() {
  elements.iosInstallCard.hidden = !(
    isIos() && !isStandalone() && !state.settings.installHintDismissed
  );
  elements.installButton.hidden =
    isStandalone() || (!state.deferredInstallPrompt && !isIos());
}

async function promptInstall() {
  if (state.deferredInstallPrompt) {
    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    updateInstallUi();
  } else if (isIos()) {
    elements.iosInstallCard.hidden = false;
    elements.iosInstallCard.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  const offerUpdate = (worker) => {
    if (!worker) return;
    state.waitingWorker = worker;
    elements.updateButton.hidden = false;
    elements.updateBanner.hidden = false;
  };
  navigator.serviceWorker.register("./service-worker.js").then((registration) => {
    if (registration.waiting && navigator.serviceWorker.controller)
      offerUpdate(registration.waiting);
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller)
          offerUpdate(worker);
      });
    });
  }).catch(() => {});
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

function bindEvents() {
  elements.themeButton.addEventListener("click", cycleTheme);
  const installUpdate = () => state.waitingWorker?.postMessage({ type: "SKIP_WAITING" });
  elements.updateButton.addEventListener("click", installUpdate);
  elements.updateBannerButton.addEventListener("click", installUpdate);
  elements.dismissUpdateBannerButton.addEventListener("click", () => {
    elements.updateBanner.hidden = true;
  });
  elements.entryForm.addEventListener("submit", handleSubmit);
  elements.cancelEditButton.addEventListener("click", resetForm);
  elements.openExerciseDialogButton.addEventListener("click", openExerciseDialog);
  elements.closeExerciseDialogButton.addEventListener("click", () => elements.exerciseDialog.close());
  elements.exerciseForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(elements.exerciseForm);
    addExercise(data.get("exerciseName"), data.get("exerciseKind"));
  });
  elements.exerciseManagerList.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-exercise-toggle]");
    const remove = event.target.closest("[data-exercise-delete]");
    if (toggle) toggleExercise(toggle.dataset.exerciseToggle);
    if (remove) deleteExercise(remove.dataset.exerciseDelete);
  });
  elements.historyRows.addEventListener("click", handleHistoryAction);
  elements.mobileHistory.addEventListener("click", handleHistoryAction);
  elements.showMoreHistoryButton.addEventListener("click", () => {
    state.historyLimit += 50;
    renderHistory();
  });
  elements.metricTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-metric]");
    if (!button) return;
    state.metric = button.dataset.metric;
    renderMetricTabs();
    renderCharts();
  });
  document.querySelector(".period-control").addEventListener("click", (event) => {
    const button = event.target.closest("[data-period]");
    if (!button) return;
    state.period = button.dataset.period;
    $$('[data-period]').forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    renderCharts();
  });
  elements.csvButton.addEventListener("click", exportCsv);
  elements.backupButton.addEventListener("click", exportBackup);
  elements.importButton.addEventListener("click", () => elements.importFile.click());
  elements.recoverImportButton.addEventListener("click", () => elements.importFile.click());
  elements.importFile.addEventListener("change", () => readImportFile(elements.importFile.files?.[0]));
  elements.resetButton.addEventListener("click", resetAllData);
  elements.downloadRawButton.addEventListener("click", downloadCorruptPayload);
  elements.discardCorruptButton.addEventListener("click", discardCorruptData);
  elements.importDialog.addEventListener("close", () => {
    if (["merge", "replace"].includes(elements.importDialog.returnValue))
      applyImport(elements.importDialog.returnValue);
    else state.pendingImport = null;
  });
  elements.confirmDialog.addEventListener("close", () => {
    const callback = state.pendingConfirm;
    state.pendingConfirm = null;
    if (elements.confirmDialog.returnValue === "confirm") callback?.();
  });
  elements.installButton.addEventListener("click", promptInstall);
  elements.dismissInstallButton.addEventListener("click", () => {
    state.settings.installHintDismissed = true;
    saveSettings();
    updateInstallUi();
  });
  window.addEventListener("online", () => { elements.networkBanner.hidden = true; });
  window.addEventListener("offline", () => { elements.networkBanner.hidden = false; });
  window.addEventListener("resize", renderCharts, { passive: true });
  window.addEventListener("pageshow", refreshTodayUi);
  window.addEventListener("storage", (event) => {
    if (event.key !== DATA_KEY) return;
    if (event.newValue === null) {
      state.entries = [];
      state.exercises = cloneDefaults();
    } else {
      try {
        const loaded = migrateDataEnvelope(JSON.parse(event.newValue));
        state.entries = loaded.entries;
        state.exercises = loaded.exercises;
      } catch {
        showToast("Änderung aus einem anderen Tab konnte nicht gelesen werden.");
        return;
      }
    }
    renderExerciseCatalogUi();
    resetForm();
    render();
  });
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    updateInstallUi();
  });
  window.addEventListener("appinstalled", () => {
    state.deferredInstallPrompt = null;
    updateInstallUi();
    showToast("MeTrack wurde installiert ✓");
  });
}

function initialize() {
  state.settings = readSettings();
  const loaded = loadData();
  state.entries = loaded.entries;
  state.exercises = sanitizeExerciseCatalog(loaded.exercises);
  $("appVersion").textContent = `v${APP_VERSION}`;
  bindEvents();
  renderExerciseCatalogUi();
  resetForm();
  refreshTodayUi();
  applyTheme();
  elements.networkBanner.hidden = navigator.onLine;
  updateStorageUi();
  updateInstallUi();
  render();
  registerServiceWorker();
  if (!state.storageWritable && !state.storageCorrupt)
    showToast("Browser-Speicher ist nicht verfügbar.");
  if (state.storageCorrupt)
    showToast("Gespeicherte Daten sind beschädigt. Bitte Sicherung importieren.");
}

initialize();
