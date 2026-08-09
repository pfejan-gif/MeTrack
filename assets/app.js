import {
  DATA_KEY,
  DEFAULT_EXERCISES,
  PREVIOUS_DATA_KEY,
  SETTINGS_KEY,
  STORAGE_KEY,
  V2_DATA_KEY,
  V3_DATA_KEY,
  V4_DATA_KEY,
  createDataEnvelope,
  exerciseMetricKey,
  migrateDataEnvelope,
  migrateLegacyEntries,
  sanitizeExerciseCatalog,
  validateExerciseCatalog,
} from "./core.js";
import { createDashboardController } from "./app/dashboard-controller.js";
import { HISTORY_PAGE_SIZE } from "./app/history-controller.js";
import { ENTRY_DRAFT_KEY } from "./app/entry-draft.js";
import { createEntryController } from "./app/entry-controller.js";
import { createExerciseController } from "./app/exercise-controller.js";
import { createNavigationController } from "./app/navigation-controller.js";
import { createPwaController } from "./app/pwa-controller.js";
import {
  TIMER_KEY,
  createTimerController,
} from "./app/timer-controller.js";
import { createTransferController } from "./app/transfer-controller.js";

const APP_VERSION = "2.11.0";
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
  stretchSection: $("stretchSection"),
  stretchFields: $("stretchFields"),
  exerciseEmpty: $("customExerciseEmpty"),
  exerciseOverviewCards: $("exerciseOverviewCards"),
  spotlightExerciseIcon: $("spotlightExerciseIcon"),
  openExerciseDialogButton: $("openExerciseDialogButton"),
  exerciseDialog: $("exerciseDialog"),
  exerciseForm: $("exerciseForm"),
  exerciseName: $("exerciseName"),
  exerciseNameError: $("exerciseNameError"),
  exerciseIconPalette: $("exerciseIconPalette"),
  exerciseIconError: $("exerciseIconError"),
  exerciseInstructionsField: $("exerciseInstructionsField"),
  exerciseInstructions: $("exerciseInstructions"),
  exerciseInstructionsError: $("exerciseInstructionsError"),
  exerciseSubmitLabel: $("exerciseSubmitLabel"),
  exerciseCancelEditButton: $("exerciseCancelEditButton"),
  exerciseManagerList: $("exerciseManagerList"),
  exerciseManagerEmpty: $("exerciseManagerEmpty"),
  closeExerciseDialogButton: $("closeExerciseDialogButton"),
  timerDialog: $("timerDialog"),
  timerTitle: $("timerTitle"),
  timerDisplay: $("timerDisplay"),
  timerStatus: $("timerStatus"),
  timerReadout: $("timerReadout"),
  timerCloseButton: $("timerCloseButton"),
  timerStartPauseButton: $("timerStartPauseButton"),
  timerStartPauseLabel: $("timerStartPauseLabel"),
  timerControlIcon: $("timerControlIcon"),
  timerResetButton: $("timerResetButton"),
  timerApplyButton: $("timerApplyButton"),
  timerWakeStatus: $("timerWakeStatus"),
  formMode: $("formMode"),
  draftStatus: $("draftStatus"),
  entryProgressWrap: $("entryProgressWrap"),
  entryProgress: $("entryProgress"),
  entryProgressLabel: $("entryProgressLabel"),
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
  historyMonthFilter: $("historyMonthFilter"),
  dataMenuButton: $("dataMenuButton"),
  dataActionsDialog: $("dataActionsDialog"),
  closeDataActionsButton: $("closeDataActionsButton"),
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
  toast: $("toast"),
};

const state = {
  entries: [],
  exercises: cloneDefaults(),
  metric: exerciseMetricKey(DEFAULT_EXERCISES[0].id),
  period: "30",
  historyLimit: HISTORY_PAGE_SIZE,
  historyMonth: "all",
  editingDate: null,
  editingExerciseId: null,
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
  timer: {
    exerciseId: null,
    setIndex: null,
    running: false,
    startedAt: null,
    accumulatedMs: 0,
    animationFrame: null,
    wakeLock: null,
    lastRenderedTenth: null,
  },
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
    { key: V4_DATA_KEY, migrate: migrateDataEnvelope },
    { key: V3_DATA_KEY, migrate: migrateDataEnvelope },
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
      hideToast();
      action.callback();
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


function askForConfirmation({ title, text, actionLabel, callback }) {
  state.pendingConfirm = callback;
  elements.confirmDialogTitle.textContent = title;
  elements.confirmDialogText.textContent = text;
  elements.confirmActionButton.textContent = actionLabel;
  if (typeof elements.confirmDialog.showModal === "function")
    elements.confirmDialog.showModal();
  else if (window.confirm(`${title}\n\n${text}`)) callback();
}


const dashboard = createDashboardController({ state, elements, setText });
const {
  render,
  renderCharts,
  renderHistory,
  renderMetricTabs,
} = dashboard;

const timer = createTimerController({
  state,
  elements,
  $,
  $$,
  showToast,
  askForConfirmation,
});
const {
  applyTimer,
  clearTimer,
  closeTimer,
  openTimer,
  paintTimer,
  pauseTimer,
  reconcileTimer,
  releaseTimerWakeLock,
  requestTimerWakeLock,
  resetTimer,
  restoreTimer,
  runTimerAnimation,
  saveTimerState,
  startOrPauseTimer,
} = timer;

let entryController;
let navigation;
const exerciseController = createExerciseController({
  state,
  elements,
  $,
  $$,
  persistData,
  showToast,
  askForConfirmation,
  timer,
  dashboard,
  saveEntryDraft: (...args) => entryController.saveDraft(...args),
  restoreEntryDraft: (...args) => entryController.restoreDraft(...args),
});
const {
  addExercise,
  deleteExercise,
  openExerciseDialog,
  renderExerciseCatalogUi,
  renderExerciseManager,
  resetExerciseEditor,
  startEditingExercise,
  toggleExercise,
  updateExerciseKindUi,
} = exerciseController;

entryController = createEntryController({
  state,
  elements,
  $,
  persistData,
  showToast,
  render,
  openEntryView: () => navigation.navigate("today", { entry: true }),
  onEditingFinished: () => navigation.navigate("history"),
});
const {
  cancelEditing,
  handleHistoryAction,
  handleSubmit,
  resetForm,
  restoreDraft,
  saveDraft,
} = entryController;

navigation = createNavigationController({
  gestureSurface: document,
  transitionSurface: $("main-content"),
  sections: $$('[data-app-view]'),
  links: $$('[data-view-link]'),
  entrySection: $("entry"),
  beforeNavigate: (from) => {
    if (from === "today") saveDraft();
  },
  onViewChange: (view) => {
    if (view === "analysis") requestAnimationFrame(renderCharts);
  },
});

const transferController = createTransferController({
  state,
  elements,
  persistData,
  showToast,
  saveSettings,
  applyTheme,
  renderExerciseCatalogUi,
  resetForm,
  restoreDraft,
  render,
  reconcileTimer,
});
const {
  applyImport,
  downloadBlob,
  exportBackup,
  exportCsv,
  readImportFile,
  timestampForFilename,
} = transferController;

const pwaController = createPwaController({ state, elements, $ });
const {
  promptInstall,
  refreshTodayUi,
  registerServiceWorker,
  updateInstallUi,
} = pwaController;

function removeAllStorageKeys() {
  [
    DATA_KEY,
    PREVIOUS_DATA_KEY,
    V3_DATA_KEY,
    V2_DATA_KEY,
    STORAGE_KEY,
    TIMER_KEY,
    ENTRY_DRAFT_KEY,
    ...RECOVERY_KEYS,
  ].forEach(
    (key) => localStorage.removeItem(key),
  );
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
        clearTimer();
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

function bindEvents() {
  elements.themeButton.addEventListener("click", cycleTheme);
  const installUpdate = () => state.waitingWorker?.postMessage({ type: "SKIP_WAITING" });
  elements.updateButton.addEventListener("click", installUpdate);
  elements.updateBannerButton.addEventListener("click", installUpdate);
  elements.dismissUpdateBannerButton.addEventListener("click", () => {
    elements.updateBanner.hidden = true;
  });
  elements.entryForm.addEventListener("submit", handleSubmit);
  elements.entryForm.addEventListener("input", saveDraft);
  elements.entryForm.addEventListener("change", saveDraft);
  elements.exerciseFields.addEventListener("click", (event) => {
    const button = event.target.closest("[data-timer-exercise]");
    if (!button) return;
    openTimer(button.dataset.timerExercise, Number(button.dataset.timerSet));
  });
  elements.cancelEditButton.addEventListener("click", cancelEditing);
  elements.openExerciseDialogButton.addEventListener("click", () => {
    saveDraft();
    openExerciseDialog();
  });
  elements.closeExerciseDialogButton.addEventListener("click", () => {
    resetExerciseEditor();
    elements.exerciseDialog.close();
  });
  elements.exerciseDialog.addEventListener("close", resetExerciseEditor);
  elements.exerciseForm.addEventListener("change", (event) => {
    if (event.target.matches('input[name="exerciseKind"]'))
      updateExerciseKindUi();
  });
  elements.exerciseCancelEditButton.addEventListener("click", () => {
    resetExerciseEditor();
    renderExerciseManager();
    elements.exerciseName.focus();
  });
  elements.exerciseForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(elements.exerciseForm);
    const editingExercise = state.exercises.find(
      (exercise) => exercise.id === state.editingExerciseId,
    );
    addExercise(
      data.get("exerciseName"),
      editingExercise?.kind || data.get("exerciseKind"),
      editingExercise?.kind === "stretch"
        ? elements.exerciseInstructions.value
        : data.get("exerciseInstructions"),
      data.get("exerciseIcon"),
    );
  });
  elements.exerciseManagerList.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-exercise-edit]");
    const toggle = event.target.closest("[data-exercise-toggle]");
    const remove = event.target.closest("[data-exercise-delete]");
    if (edit) startEditingExercise(edit.dataset.exerciseEdit);
    if (toggle) toggleExercise(toggle.dataset.exerciseToggle);
    if (remove) deleteExercise(remove.dataset.exerciseDelete);
  });
  elements.timerStartPauseButton.addEventListener("click", startOrPauseTimer);
  elements.timerResetButton.addEventListener("click", resetTimer);
  elements.timerApplyButton.addEventListener("click", applyTimer);
  elements.timerCloseButton.addEventListener("click", closeTimer);
  elements.timerDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeTimer();
  });
  elements.timerDialog.addEventListener("close", () => {
    if (state.timer.running) pauseTimer();
  });
  elements.historyRows.addEventListener("click", handleHistoryAction);
  elements.mobileHistory.addEventListener("click", handleHistoryAction);
  elements.showMoreHistoryButton.addEventListener("click", () => {
    state.historyLimit += HISTORY_PAGE_SIZE;
    renderHistory();
  });
  elements.historyMonthFilter.addEventListener("change", () => {
    state.historyMonth = elements.historyMonthFilter.value;
    state.historyLimit = HISTORY_PAGE_SIZE;
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
  elements.dataMenuButton.addEventListener("click", () => {
    elements.dataActionsDialog.showModal();
  });
  elements.closeDataActionsButton.addEventListener("click", () => {
    elements.dataActionsDialog.close();
  });
  elements.csvButton.addEventListener("click", () => {
    elements.dataActionsDialog.close();
    exportCsv();
  });
  elements.backupButton.addEventListener("click", () => {
    elements.dataActionsDialog.close();
    exportBackup();
  });
  elements.importButton.addEventListener("click", () => {
    elements.dataActionsDialog.close();
    elements.importFile.click();
  });
  elements.recoverImportButton.addEventListener("click", () => elements.importFile.click());
  elements.importFile.addEventListener("change", () => readImportFile(elements.importFile.files?.[0]));
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
  window.addEventListener("pagehide", () => {
    saveDraft();
    saveTimerState();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      paintTimer();
      if (state.timer.running && elements.timerDialog.open) {
        requestTimerWakeLock();
        runTimerAnimation();
      }
    } else {
      releaseTimerWakeLock();
      saveDraft();
      saveTimerState();
    }
  });
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
    reconcileTimer();
    resetForm({ clearStoredDraft: false });
    restoreDraft();
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
  resetForm({ clearStoredDraft: false });
  restoreDraft();
  refreshTodayUi();
  applyTheme();
  elements.networkBanner.hidden = navigator.onLine;
  updateStorageUi();
  updateInstallUi();
  render();
  navigation.initialize();
  restoreTimer();
  registerServiceWorker();
  if (!state.storageWritable && !state.storageCorrupt)
    showToast("Browser-Speicher ist nicht verfügbar.");
  if (state.storageCorrupt)
    showToast("Gespeicherte Daten sind beschädigt. Bitte Sicherung importieren.");
}

initialize();
