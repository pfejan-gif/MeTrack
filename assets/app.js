import {
  BODY_METRIC_KEYS,
  DATA_KEY,
  EXERCISE_KEYS,
  METRICS,
  METRIC_KEYS,
  SET_COUNT,
  SETTINGS_KEY,
  STORAGE_KEY,
  calculateStreak,
  createBackup,
  entriesToCsv,
  formatDate,
  formatNumber,
  mergeEntries,
  normalizeEntries,
  parseBackup,
  removeEntry,
  setFieldName,
  setsKey,
  todayLocal,
  upsertEntry,
  validateEntry,
} from "./core.js";

const APP_VERSION = "2.0.1";
const RECOVERY_KEYS = [
  "metrack_pre_import_backup_v1",
  "metrack_pre_reset_backup_v1",
  "metrack_corrupt_payload_backup_v1",
];
const THEME_ORDER = ["system", "light", "dark"];

const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const lastItem = (items) => items[items.length - 1];

const elements = {
  themeMeta: document.querySelector('meta[name="theme-color"]'),
  themeButton: $("themeButton"),
  updateButton: $("updateButton"),
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
  metric: "plank",
  period: "30",
  historyLimit: 50,
  editingDate: null,
  settings: {
    theme: "system",
    installHintDismissed: false,
  },
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
  const key = "metrack_storage_test";
  try {
    localStorage.setItem(key, "1");
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function loadEntries() {
  state.storageWritable = testStorage();

  let currentRaw;
  try {
    currentRaw = localStorage.getItem(DATA_KEY);
  } catch {
    state.storageWritable = false;
    return [];
  }
  if (currentRaw !== null) {
    try {
      const parsed = JSON.parse(currentRaw);
      if (
        !parsed ||
        parsed.schemaVersion !== 2 ||
        !Array.isArray(parsed.entries)
      ) {
        throw new Error("Unexpected v2 storage format");
      }
      if (
        parsed.entries.some(
          (entry) => entry?.date > todayLocal() || !validateEntry(entry).valid,
        )
      ) {
        throw new Error("Invalid v2 entry");
      }
      const normalized = normalizeEntries(parsed.entries);
      if (parsed.entries.length > 0 && normalized.length === 0)
        throw new Error("No valid v2 entries");
      return normalized;
    } catch {
      state.storageCorrupt = true;
      state.corruptStorageValue = currentRaw;
      state.corruptStorageKey = DATA_KEY;
      state.storageWritable = false;
      return [];
    }
  }

  let legacyRaw;
  try {
    legacyRaw = localStorage.getItem(STORAGE_KEY);
  } catch {
    state.storageWritable = false;
    return [];
  }
  if (legacyRaw === null) return [];

  let normalized;
  try {
    const parsed = JSON.parse(legacyRaw);
    if (!Array.isArray(parsed)) throw new Error("Unexpected storage format");
    if (
      parsed.some(
        (entry) => entry?.date > todayLocal() || !validateEntry(entry).valid,
      )
    ) {
      throw new Error("Invalid legacy entry");
    }
    normalized = normalizeEntries(parsed);
    if (parsed.length > 0 && normalized.length === 0)
      throw new Error("No valid entries");
  } catch {
    state.storageCorrupt = true;
    state.corruptStorageValue = legacyRaw;
    state.corruptStorageKey = STORAGE_KEY;
    state.storageWritable = false;
    return [];
  }

  if (!state.storageWritable) return normalized;

  try {
    const envelope = JSON.stringify({ schemaVersion: 2, entries: normalized });
    localStorage.setItem(DATA_KEY, envelope);
    if (localStorage.getItem(DATA_KEY) !== envelope)
      throw new Error("Migration verification failed");
  } catch {
    state.storageWritable = false;
  }
  return normalized;
}

function persistEntries(nextEntries, { allowRecovery = false } = {}) {
  if (state.storageCorrupt && !allowRecovery) {
    showToast("Speichern pausiert: Die vorhandenen Daten sind beschädigt.");
    return false;
  }

  const normalized = normalizeEntries(nextEntries);
  try {
    const serialized = JSON.stringify({
      schemaVersion: 2,
      entries: normalized,
    });
    localStorage.setItem(DATA_KEY, serialized);
    if (localStorage.getItem(DATA_KEY) !== serialized)
      throw new Error("Storage verification failed");

    state.entries = normalized;
    state.storageWritable = true;
    state.storageCorrupt = false;
    state.corruptStorageValue = null;
    state.corruptStorageKey = null;
    updateStorageUi();
    return true;
  } catch {
    state.storageWritable = false;
    updateStorageUi();
    showToast(
      "Nicht gespeichert. Bitte prüfe den verfügbaren Browser-Speicher.",
    );
    return false;
  }
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
  elements.themeButton.title = labels[state.settings.theme];

  requestAnimationFrame(() => {
    const background = getComputedStyle(document.documentElement)
      .getPropertyValue("--bg")
      .trim();
    if (background) elements.themeMeta.content = background;
    renderCharts();
  });
}

function cycleTheme() {
  const index = THEME_ORDER.indexOf(state.settings.theme);
  state.settings.theme = THEME_ORDER[(index + 1) % THEME_ORDER.length];
  saveSettings();
  applyTheme();
  const labels = {
    system: "Automatische Darstellung",
    light: "Helles Design",
    dark: "Dunkles Design",
  };
  showToast(`${labels[state.settings.theme]} aktiviert`);
}

function showToast(message, action = null) {
  clearTimeout(state.toastTimer);
  elements.toast.replaceChildren();

  const messageNode = document.createElement("span");
  messageNode.textContent = message;
  elements.toast.append(messageNode);

  if (action?.label && typeof action.callback === "function") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "toast-action";
    button.textContent = action.label;
    button.addEventListener(
      "click",
      () => {
        action.callback();
        hideToast();
      },
      { once: true },
    );
    elements.toast.append(button);
  }

  elements.toast.classList.add("visible");
  state.toastTimer = setTimeout(hideToast, action ? 6000 : 2600);
}

function hideToast() {
  clearTimeout(state.toastTimer);
  elements.toast.classList.remove("visible");
}

function formatSigned(value, decimals, unit) {
  if (value === null) return null;
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, decimals)} ${unit}`;
}

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = value;
}

function metricSummary(key) {
  const values = state.entries
    .filter((entry) => entry[key] !== null)
    .map((entry) => entry[key]);
  const latest = values.length ? values[values.length - 1] : null;
  const previous = values.length > 1 ? values[values.length - 2] : null;
  const first = values.length ? values[0] : null;
  return {
    latest,
    best: values.length ? Math.max(...values) : null,
    fromPrevious:
      latest === null || previous === null ? null : latest - previous,
    fromFirst: latest === null || first === null ? null : latest - first,
  };
}

function renderOverview() {
  const plank = metricSummary("plank");
  const pushups = metricSummary("pushups");
  const squats = metricSummary("squats");
  const weight = metricSummary("weight");
  const waist = metricSummary("waist");
  const streak = calculateStreak(state.entries);

  setText("bestPlank", formatNumber(plank.best));
  setText("bestPushups", formatNumber(pushups.best));
  setText("bestSquats", formatNumber(squats.best));
  setText("lastWeight", formatNumber(weight.latest, 1));
  setText("lastWaist", formatNumber(waist.latest, 1));
  setText("streakValue", `${streak} ${streak === 1 ? "Tag" : "Tage"}`);

  setText(
    "plankTrend",
    plank.fromPrevious === null
      ? plank.best === null
        ? "Noch kein Eintrag"
        : "Erster Plank-Wert"
      : `${formatSigned(plank.fromPrevious, 0, "Sek.")} zum letzten Mal`,
  );
  setText(
    "weightChange",
    weight.fromFirst === null
      ? weight.latest === null
        ? "Noch kein Wert"
        : "Erster Messwert"
      : `${formatSigned(weight.fromFirst, 1, "kg")} seit Start`,
  );
  setText(
    "waistChange",
    waist.fromFirst === null
      ? waist.latest === null
        ? "Noch kein Wert"
        : "Erster Messwert"
      : `${formatSigned(waist.fromFirst, 1, "cm")} seit Start`,
  );

  const latest = lastItem(state.entries);
  const subtitle = latest
    ? `Zuletzt gespeichert am ${formatDate(latest.date)} · nur auf diesem Gerät`
    : "Deine Daten bleiben privat auf diesem Gerät.";
  setText("overviewSubtitle", subtitle);
}

function filterMetricEntries(key, period) {
  const values = state.entries.filter((entry) => entry[key] !== null);
  if (period === "all") return values;
  const reference = new Date(`${todayLocal()}T12:00:00`);
  reference.setDate(reference.getDate() - (Number(period) - 1));
  const threshold = todayLocal(reference);
  return values.filter((entry) => entry.date >= threshold);
}

function canvasSize(canvas) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const context = canvas.getContext("2d");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { context, width: rect.width, height: rect.height };
}

function chartPalette() {
  const styles = getComputedStyle(document.documentElement);
  return {
    line: styles.getPropertyValue("--mint").trim() || "#5ce2ae",
    text: styles.getPropertyValue("--muted").trim() || "#8fa2ba",
    surface: styles.getPropertyValue("--surface-solid").trim() || "#0f1d2f",
  };
}

function drawChart(canvas, entries, key, { compact = false } = {}) {
  const dimensions = canvasSize(canvas);
  if (!dimensions) return false;
  const { context, width, height } = dimensions;
  context.clearRect(0, 0, width, height);
  if (entries.length < 2) return false;

  const colors = chartPalette();
  const padding = compact
    ? { top: 12, right: 7, bottom: 7, left: 7 }
    : { top: 26, right: 25, bottom: 36, left: 51 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const values = entries.map((entry) => entry[key]);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const rawSpan = rawMax - rawMin;
  const visualPadding =
    rawSpan === 0 ? Math.max(Math.abs(rawMax) * 0.08, 1) : rawSpan * 0.12;
  const min = rawMin - visualPadding;
  const max = rawMax + visualPadding;
  const span = max - min || 1;
  const startTime = new Date(`${entries[0].date}T12:00:00`).getTime();
  const endTime = new Date(`${lastItem(entries).date}T12:00:00`).getTime();
  const timeSpan = endTime - startTime || 1;

  const points = entries.map((entry) => {
    const time = new Date(`${entry.date}T12:00:00`).getTime();
    return {
      x: padding.left + ((time - startTime) / timeSpan) * plotWidth,
      y: padding.top + ((max - entry[key]) / span) * plotHeight,
    };
  });

  if (!compact) {
    context.fillStyle = colors.text;
    context.font = "700 11px -apple-system, BlinkMacSystemFont, sans-serif";
    context.textBaseline = "middle";
    context.textAlign = "right";
    for (let index = 0; index < 3; index += 1) {
      const ratio = index / 2;
      const value = max - ratio * span;
      const y = padding.top + ratio * plotHeight;
      context.fillText(
        formatNumber(value, METRICS[key].decimals),
        padding.left - 10,
        y,
      );
    }

    context.textBaseline = "top";
    context.textAlign = "left";
    context.fillText(
      formatDate(entries[0].date).replace(/\s\d{4}$/, ""),
      padding.left,
      height - 24,
    );
    context.textAlign = "right";
    context.fillText(
      formatDate(lastItem(entries).date).replace(/\s\d{4}$/, ""),
      width - padding.right,
      height - 24,
    );
  }

  const gradient = context.createLinearGradient(
    0,
    padding.top,
    0,
    height - padding.bottom,
  );
  gradient.addColorStop(0, `${colors.line}48`);
  gradient.addColorStop(1, `${colors.line}00`);
  context.beginPath();
  context.moveTo(points[0].x, height - padding.bottom);
  points.forEach((point) => context.lineTo(point.x, point.y));
  context.lineTo(lastItem(points).x, height - padding.bottom);
  context.closePath();
  context.fillStyle = gradient;
  context.fill();

  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.strokeStyle = colors.line;
  context.lineWidth = compact ? 2.5 : 3;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.stroke();

  const shownPoints =
    compact && points.length > 14 ? [lastItem(points)] : points;
  shownPoints.forEach((point) => {
    context.beginPath();
    context.arc(point.x, point.y, compact ? 3 : 4, 0, Math.PI * 2);
    context.fillStyle = colors.surface;
    context.fill();
    context.strokeStyle = colors.line;
    context.lineWidth = 2;
    context.stroke();
  });

  return true;
}

function renderCharts() {
  requestAnimationFrame(() => {
    const overviewEntries = state.entries
      .filter((entry) => entry.plank !== null)
      .slice(-12);
    drawChart(elements.overviewChart, overviewEntries, "plank", {
      compact: true,
    });

    const entries = filterMetricEntries(state.metric, state.period);
    const hasChart = drawChart(elements.progressChart, entries, state.metric);
    elements.chartEmpty.hidden = hasChart;

    const definition = METRICS[state.metric];
    const periodLabel =
      state.period === "all"
        ? "gesamter Zeitraum"
        : `letzte ${state.period} Tage`;
    elements.progressChart.setAttribute(
      "aria-label",
      `${definition.label}-Verlauf, ${periodLabel}`,
    );
    elements.chartSubtitle.textContent = `${definition.label} · ${periodLabel}`;

    if (entries.length === 0) {
      elements.chartSummary.textContent = `Noch keine ${definition.label}-Werte in diesem Zeitraum.`;
    } else if (entries.length === 1) {
      elements.chartSummary.textContent = `Ein Wert: ${formatNumber(entries[0][state.metric], definition.decimals)} ${definition.unit} am ${formatDate(entries[0].date)}.`;
    } else {
      const first = entries[0][state.metric];
      const last = lastItem(entries)[state.metric];
      const difference = last - first;
      elements.chartSummary.textContent = `${entries.length} Werte von ${formatDate(entries[0].date)} bis ${formatDate(lastItem(entries).date)} · Veränderung ${formatSigned(difference, definition.decimals, definition.unit)}.`;
    }
  });
}

function metricDisplay(entry, key) {
  const definition = METRICS[key];
  if (EXERCISE_KEYS.includes(key)) {
    const values =
      entry[setsKey(key)] || Array.from({ length: SET_COUNT }, () => null);
    if (values.every((value) => value === null)) return "—";
    return `${values.map((value) => (value === null ? "–" : formatNumber(value))).join(" / ")} ${definition.unit}`;
  }
  return entry[key] === null
    ? "—"
    : `${formatNumber(entry[key], definition.decimals)} ${definition.unit}`;
}

function actionButton(action, date, label, iconPath, danger = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `row-action${danger ? " danger" : ""}`;
  button.dataset.action = action;
  button.dataset.date = date;
  button.setAttribute("aria-label", label);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", iconPath);
  svg.append(path);
  button.append(svg);
  return button;
}

function renderHistory() {
  const allEntries = [...state.entries].reverse();
  const entries = allEntries.slice(0, state.historyLimit);
  const hasEntries = allEntries.length > 0;
  elements.historyEmpty.hidden = hasEntries;
  elements.desktopHistory.hidden = !hasEntries;
  elements.mobileHistory.hidden = !hasEntries;
  elements.entryCount.textContent = hasEntries
    ? `${allEntries.length} ${allEntries.length === 1 ? "gespeicherter Tag" : "gespeicherte Tage"}`
    : "Noch keine Einträge";
  elements.showMoreHistoryButton.hidden =
    !hasEntries || entries.length >= allEntries.length;
  if (!elements.showMoreHistoryButton.hidden) {
    const remaining = allEntries.length - entries.length;
    elements.showMoreHistoryButton.textContent = `Weitere ${Math.min(50, remaining)} Einträge anzeigen`;
  }
  elements.csvButton.disabled = !hasEntries;
  elements.backupButton.disabled = !hasEntries;

  elements.historyRows.replaceChildren();
  elements.mobileHistory.replaceChildren();

  for (const entry of entries) {
    const row = document.createElement("tr");
    const values = [
      formatDate(entry.date),
      metricDisplay(entry, "plank"),
      metricDisplay(entry, "pushups"),
      metricDisplay(entry, "squats"),
      metricDisplay(entry, "weight"),
      metricDisplay(entry, "waist"),
    ];
    values.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    const actionCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "row-actions";
    actions.append(
      actionButton(
        "edit",
        entry.date,
        `Eintrag vom ${formatDate(entry.date)} bearbeiten`,
        "M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4",
      ),
      actionButton(
        "delete",
        entry.date,
        `Eintrag vom ${formatDate(entry.date)} löschen`,
        "M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5",
        true,
      ),
    );
    actionCell.append(actions);
    row.append(actionCell);
    elements.historyRows.append(row);

    const card = document.createElement("article");
    card.className = "history-item";
    const header = document.createElement("div");
    header.className = "history-item-header";
    const date = document.createElement("span");
    date.className = "history-date";
    date.textContent = formatDate(entry.date);
    const mobileActions = document.createElement("div");
    mobileActions.className = "history-item-actions";
    mobileActions.append(
      actionButton(
        "edit",
        entry.date,
        `Eintrag vom ${formatDate(entry.date)} bearbeiten`,
        "M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4",
      ),
      actionButton(
        "delete",
        entry.date,
        `Eintrag vom ${formatDate(entry.date)} löschen`,
        "M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5",
        true,
      ),
    );
    header.append(date, mobileActions);

    const metrics = document.createElement("div");
    metrics.className = "history-metrics";
    for (const key of METRIC_KEYS) {
      if (entry[key] === null) continue;
      const metric = document.createElement("div");
      metric.className = "history-metric";
      const label = document.createElement("span");
      label.textContent = METRICS[key].shortLabel;
      const value = document.createElement("strong");
      value.textContent = metricDisplay(entry, key);
      metric.append(label, value);
      metrics.append(metric);
    }
    card.append(header, metrics);
    elements.mobileHistory.append(card);
  }
}

function render() {
  renderOverview();
  renderHistory();
  renderCharts();
}

function clearFormErrors() {
  elements.formError.textContent = "";
  const fieldIds = [
    "date",
    ...EXERCISE_KEYS.flatMap((key) =>
      Array.from({ length: SET_COUNT }, (_, index) => setFieldName(key, index)),
    ),
    ...BODY_METRIC_KEYS,
  ];
  for (const key of fieldIds) {
    const input = $(key);
    const error = $(`${key}Error`);
    input?.removeAttribute("aria-invalid");
    input?.removeAttribute("aria-errormessage");
    input?.setAttribute("aria-describedby", `${key}Error`);
    if (error) error.textContent = "";
  }
}

function showFormErrors(errors) {
  clearFormErrors();
  for (const [key, message] of Object.entries(errors)) {
    if (key === "form") {
      elements.formError.textContent = message;
      continue;
    }
    const input = $(key);
    const error = $(`${key}Error`);
    input?.setAttribute("aria-invalid", "true");
    input?.setAttribute("aria-errormessage", `${key}Error`);
    if (error) error.textContent = message;
  }
  const firstInvalid = elements.entryForm.querySelector(
    '[aria-invalid="true"]',
  );
  firstInvalid?.focus({ preventScroll: false });
}

function resetForm() {
  state.editingDate = null;
  elements.entryForm.reset();
  $("date").value = todayLocal();
  $("date").max = todayLocal();
  elements.formMode.textContent = "Neuer Eintrag";
  elements.saveButtonLabel.textContent = "Eintrag speichern";
  elements.cancelEditButton.hidden = true;
  clearFormErrors();
}

function startEditing(date) {
  const entry = state.entries.find((item) => item.date === date);
  if (!entry) return;
  state.editingDate = date;
  $("date").value = entry.date;
  for (const key of EXERCISE_KEYS) {
    const values = entry[setsKey(key)] || [];
    for (let index = 0; index < SET_COUNT; index += 1) {
      $(setFieldName(key, index)).value = values[index] ?? "";
    }
  }
  for (const key of BODY_METRIC_KEYS) $(key).value = entry[key] ?? "";
  elements.formMode.textContent = "Bearbeiten";
  elements.saveButtonLabel.textContent = "Änderungen speichern";
  elements.cancelEditButton.hidden = false;
  clearFormErrors();
  $("entry").scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
  setTimeout(() => $("date").focus(), 350);
}

function handleSubmit(event) {
  event.preventDefault();
  const formData = new FormData(elements.entryForm);
  const raw = Object.fromEntries(formData.entries());

  if (raw.date > todayLocal()) {
    showFormErrors({ date: "Ein Datum in der Zukunft ist nicht möglich." });
    return;
  }

  if (
    state.editingDate &&
    raw.date !== state.editingDate &&
    state.entries.some((entry) => entry.date === raw.date)
  ) {
    showFormErrors({
      date: "Für dieses Datum gibt es bereits einen Eintrag. Bearbeite stattdessen den vorhandenen Tag.",
    });
    return;
  }

  const existing = !state.editingDate
    ? state.entries.find((entry) => entry.date === raw.date)
    : null;
  const candidate = { ...raw };
  if (existing) {
    for (const key of EXERCISE_KEYS) {
      const values = existing[setsKey(key)] || [];
      for (let index = 0; index < SET_COUNT; index += 1) {
        const field = setFieldName(key, index);
        if (candidate[field] === "") candidate[field] = values[index] ?? "";
      }
    }
    for (const key of BODY_METRIC_KEYS)
      if (candidate[key] === "") candidate[key] = existing[key];
  }

  const validation = validateEntry(candidate);
  if (!validation.valid) {
    showFormErrors(validation.errors);
    return;
  }

  const previousDate = state.editingDate || validation.entry.date;
  const nextEntries = upsertEntry(
    state.entries,
    validation.entry,
    previousDate,
  );
  if (!persistEntries(nextEntries)) return;

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
  const { action, date } = button.dataset;
  if (action === "edit") startEditing(date);
  if (action === "delete") deleteEntry(date);
}

function deleteEntry(date) {
  const deleted = state.entries.find((entry) => entry.date === date);
  if (!deleted) return;
  const nextEntries = removeEntry(state.entries, date);
  if (!persistEntries(nextEntries)) return;
  if (state.editingDate === date) resetForm();
  render();
  showToast(`Eintrag vom ${formatDate(date)} gelöscht`, {
    label: "Rückgängig",
    callback: () => {
      if (persistEntries(upsertEntry(state.entries, deleted))) {
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

async function exportCsv() {
  if (!state.entries.length) return;
  const filename = `metrack-${todayLocal()}.csv`;
  const file = new File([entriesToCsv(state.entries)], filename, {
    type: "text/csv;charset=utf-8",
  });

  try {
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: "MeTrack CSV-Export",
        text: "Meine MeTrack-Werte als CSV",
        files: [file],
      });
      showToast("CSV geteilt");
      return;
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
  }

  downloadBlob(file, filename);
  showToast("CSV exportiert");
}

async function exportBackup() {
  if (!state.entries.length) return;
  const content = JSON.stringify(
    createBackup(state.entries, state.settings),
    null,
    2,
  );
  const filename = `metrack-sicherung-${timestampForFilename()}.json`;
  const file = new File([content], filename, { type: "application/json" });

  try {
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: "MeTrack Sicherung",
        text: "Meine lokale MeTrack-Datensicherung",
        files: [file],
      });
      showToast("Sicherung geteilt");
      return;
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
  }

  downloadBlob(file, filename);
  showToast("Sicherung gespeichert");
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
    const entries = parsed.entries;
    const range = entries.length
      ? `${formatDate(entries[0].date)} bis ${formatDate(lastItem(entries).date)}`
      : "keine Einträge";
    elements.importSummary.textContent = `Die Sicherung enthält ${entries.length} ${entries.length === 1 ? "Tag" : "Tage"} (${range}). Du kannst sie mit deinen Daten zusammenführen oder deine aktuellen Einträge ersetzen.`;

    if (typeof elements.importDialog.showModal === "function") {
      elements.importDialog.showModal();
    } else {
      const choice = window.prompt(
        `${elements.importSummary.textContent}\n\nM = zusammenführen · E = vorhandene ersetzen`,
        "M",
      );
      if (choice?.trim().toLowerCase() === "m") applyImport("merge");
      if (choice?.trim().toLowerCase() === "e") applyImport("replace");
    }
  } catch (error) {
    showToast(error.message || "Sicherung konnte nicht gelesen werden.");
  } finally {
    elements.importFile.value = "";
  }
}

function applyImport(mode) {
  if (!state.pendingImport || !["merge", "replace"].includes(mode)) return;

  const previousEntries = state.entries;
  const importedSettings = state.pendingImport.settings;
  const nextEntries =
    mode === "merge"
      ? mergeEntries(state.entries, state.pendingImport.entries)
      : state.pendingImport.entries;
  if (!persistEntries(nextEntries, { allowRecovery: true })) return;

  if (THEME_ORDER.includes(importedSettings?.theme)) {
    state.settings.theme = importedSettings.theme;
    saveSettings();
    applyTheme();
  }

  state.pendingImport = null;
  resetForm();
  render();
  showToast(
    mode === "merge"
      ? "Sicherung zusammengeführt ✓"
      : "Sicherung wiederhergestellt ✓",
    {
      label: "Rückgängig",
      callback: () => {
        if (persistEntries(previousEntries, { allowRecovery: true })) {
          render();
          showToast("Import rückgängig gemacht");
        }
      },
    },
  );
}

function askForConfirmation({ title, text, actionLabel, callback }) {
  state.pendingConfirm = callback;
  elements.confirmDialogTitle.textContent = title;
  elements.confirmDialogText.textContent = text;
  elements.confirmActionButton.textContent = actionLabel;

  if (typeof elements.confirmDialog.showModal === "function") {
    elements.confirmDialog.showModal();
  } else if (window.confirm(`${title}\n\n${text}`)) {
    callback();
    state.pendingConfirm = null;
  }
}

function resetAllData() {
  const hasRecoveryData = (() => {
    try {
      return RECOVERY_KEYS.some((key) => localStorage.getItem(key) !== null);
    } catch {
      return false;
    }
  })();

  if (!state.entries.length && !hasRecoveryData) {
    showToast("Es sind keine Daten vorhanden.");
    return;
  }

  askForConfirmation({
    title: "Alle Daten löschen?",
    text: "Alle Einträge auf diesem Gerät werden entfernt. Du kannst die Löschung direkt danach rückgängig machen.",
    actionLabel: "Alle löschen",
    callback: () => {
      const previousEntries = state.entries;
      try {
        if (!persistEntries([], { allowRecovery: true })) return;
        localStorage.removeItem(DATA_KEY);
        localStorage.removeItem(STORAGE_KEY);
        RECOVERY_KEYS.forEach((key) => localStorage.removeItem(key));
      } catch {
        showToast("Die Daten konnten nicht vollständig gelöscht werden.");
        return;
      }
      resetForm();
      render();
      if (previousEntries.length) {
        showToast("Alle Daten gelöscht", {
          label: "Rückgängig",
          callback: () => {
            if (persistEntries(previousEntries, { allowRecovery: true })) {
              render();
              showToast("Daten wiederhergestellt");
            }
          },
        });
      } else {
        showToast("Gespeicherte Rücksicherungen gelöscht");
      }
    },
  });
}

function updateNetworkState() {
  elements.networkBanner.hidden = navigator.onLine;
}

function refreshTodayUi() {
  const today = todayLocal();
  $("date").max = today;
  const measurementFields = [
    ...EXERCISE_KEYS.flatMap((key) =>
      Array.from({ length: SET_COUNT }, (_, index) =>
        $(setFieldName(key, index)),
      ),
    ),
    ...BODY_METRIC_KEYS.map((key) => $(key)),
  ];
  if (
    !state.editingDate &&
    measurementFields.every((field) => field.value === "") &&
    $("date").value < today
  ) {
    $("date").value = today;
  }
  $("todayLabel").textContent = new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date(`${today}T12:00:00`));
}

function updateStorageUi() {
  const hasProblem = state.storageCorrupt || !state.storageWritable;
  elements.dataAlert.hidden = !hasProblem;
  if (!hasProblem) return;

  if (state.storageCorrupt) {
    elements.dataAlertText.textContent =
      "Vorhandene MeTrack-Daten konnten nicht sicher gelesen werden und werden deshalb nicht überschrieben. Sichere die Rohdaten oder importiere eine gültige MeTrack-Sicherung.";
    elements.dataAlertActions.hidden = false;
  } else {
    elements.dataAlertText.textContent =
      "Safari stellt aktuell keinen beschreibbaren lokalen Speicher bereit. Du kannst MeTrack ansehen, Änderungen aber noch nicht zuverlässig speichern.";
    elements.dataAlertActions.hidden = true;
  }
}

function downloadCorruptPayload() {
  if (state.corruptStorageValue === null) return;
  const blob = new Blob([state.corruptStorageValue], {
    type: "application/json;charset=utf-8",
  });
  downloadBlob(blob, `metrack-rohdaten-${timestampForFilename()}.json`);
  showToast("Rohdaten gesichert");
}

function discardCorruptData() {
  askForConfirmation({
    title: "Beschädigte Daten verwerfen?",
    text: "Nutze vorher „Rohdaten sichern“, falls du den Inhalt später prüfen möchtest. Danach startet MeTrack mit einem leeren Datensatz.",
    actionLabel: "Verwerfen",
    callback: () => {
      if (persistEntries([], { allowRecovery: true })) {
        try {
          localStorage.removeItem(DATA_KEY);
          localStorage.removeItem(STORAGE_KEY);
          RECOVERY_KEYS.forEach((key) => localStorage.removeItem(key));
        } catch {
          showToast(
            "Die beschädigten Daten konnten nicht vollständig entfernt werden.",
          );
          return;
        }
        resetForm();
        render();
        showToast("MeTrack wurde mit leerem Datensatz neu gestartet");
      }
    },
  });
}

function isIos() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigator.standalone === true
  );
}

function updateInstallUi() {
  const showIosHint =
    isIos() && !isStandalone() && !state.settings.installHintDismissed;
  elements.iosInstallCard.hidden = !showIosHint;
  elements.installButton.hidden =
    isStandalone() || (!state.deferredInstallPrompt && !isIos());
}

async function promptInstall() {
  if (state.deferredInstallPrompt) {
    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    updateInstallUi();
    return;
  }

  if (isIos()) {
    state.settings.installHintDismissed = false;
    saveSettings();
    updateInstallUi();
    elements.iosInstallCard.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

  const offerUpdate = (worker) => {
    if (!worker) return;
    state.waitingWorker = worker;
    elements.updateButton.hidden = false;
    showToast("Eine neue MeTrack-Version ist bereit.", {
      label: "Aktualisieren",
      callback: () => worker.postMessage({ type: "SKIP_WAITING" }),
    });
  };

  navigator.serviceWorker
    .register("./service-worker.js")
    .then((registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        offerUpdate(registration.waiting);
      }
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (
            worker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            offerUpdate(worker);
          }
        });
      });
    })
    .catch(() => {
      // Die App bleibt ohne Service Worker vollständig nutzbar.
    });

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

function bindEvents() {
  elements.themeButton.addEventListener("click", cycleTheme);
  elements.updateButton.addEventListener("click", () => {
    state.waitingWorker?.postMessage({ type: "SKIP_WAITING" });
  });
  elements.entryForm.addEventListener("submit", handleSubmit);
  elements.cancelEditButton.addEventListener("click", resetForm);
  elements.historyRows.addEventListener("click", handleHistoryAction);
  elements.mobileHistory.addEventListener("click", handleHistoryAction);
  elements.showMoreHistoryButton.addEventListener("click", () => {
    state.historyLimit += 50;
    renderHistory();
  });
  elements.csvButton.addEventListener("click", exportCsv);
  elements.backupButton.addEventListener("click", exportBackup);
  elements.importButton.addEventListener("click", () =>
    elements.importFile.click(),
  );
  elements.importFile.addEventListener("change", () =>
    readImportFile(elements.importFile.files?.[0]),
  );
  elements.resetButton.addEventListener("click", resetAllData);
  elements.installButton.addEventListener("click", promptInstall);
  elements.downloadRawButton.addEventListener("click", downloadCorruptPayload);
  elements.recoverImportButton.addEventListener("click", () =>
    elements.importFile.click(),
  );
  elements.discardCorruptButton.addEventListener("click", discardCorruptData);
  elements.dismissInstallButton.addEventListener("click", () => {
    state.settings.installHintDismissed = true;
    saveSettings();
    updateInstallUi();
  });

  elements.metricTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-metric]");
    if (!button) return;
    state.metric = button.dataset.metric;
    $$("[data-metric]", elements.metricTabs).forEach((item) => {
      item.setAttribute("aria-pressed", String(item === button));
    });
    renderCharts();
  });

  document
    .querySelector(".period-control")
    .addEventListener("click", (event) => {
      const button = event.target.closest("[data-period]");
      if (!button) return;
      state.period = button.dataset.period;
      $$("[data-period]").forEach((item) =>
        item.setAttribute("aria-pressed", String(item === button)),
      );
      renderCharts();
    });

  elements.importDialog.addEventListener("close", () => {
    if (["merge", "replace"].includes(elements.importDialog.returnValue)) {
      applyImport(elements.importDialog.returnValue);
    } else {
      state.pendingImport = null;
    }
  });

  elements.confirmDialog.addEventListener("close", () => {
    if (
      elements.confirmDialog.returnValue === "confirm" &&
      typeof state.pendingConfirm === "function"
    ) {
      const callback = state.pendingConfirm;
      state.pendingConfirm = null;
      callback();
    } else {
      state.pendingConfirm = null;
    }
  });

  window.addEventListener("online", updateNetworkState);
  window.addEventListener("offline", updateNetworkState);
  window.addEventListener("pageshow", refreshTodayUi);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshTodayUi();
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== DATA_KEY) return;
    if (event.newValue === null) {
      state.entries = [];
      resetForm();
      render();
      showToast("Daten wurden in einem anderen Tab gelöscht.");
      return;
    }

    try {
      const parsed = JSON.parse(event.newValue);
      if (
        parsed.schemaVersion !== 2 ||
        !Array.isArray(parsed.entries) ||
        parsed.entries.some(
          (entry) => entry?.date > todayLocal() || !validateEntry(entry).valid,
        )
      ) {
        throw new Error("Invalid storage event");
      }
      state.entries = normalizeEntries(parsed.entries);
      resetForm();
      render();
      showToast("Daten aus einem anderen Tab übernommen.");
    } catch {
      showToast("Änderung aus einem anderen Tab konnte nicht gelesen werden.");
    }
  });
  window.addEventListener("resize", renderCharts, { passive: true });
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

  const colorScheme = window.matchMedia("(prefers-color-scheme: light)");
  colorScheme.addEventListener?.("change", () => {
    if (state.settings.theme === "system") applyTheme();
  });
}

function initialize() {
  state.settings = readSettings();
  state.entries = loadEntries();
  $("appVersion").textContent = `v${APP_VERSION}`;

  bindEvents();
  resetForm();
  refreshTodayUi();
  applyTheme();
  updateNetworkState();
  updateStorageUi();
  updateInstallUi();
  render();
  registerServiceWorker();

  if (!state.storageWritable && !state.storageCorrupt) {
    showToast(
      "Browser-Speicher ist nicht verfügbar. Änderungen können nicht gespeichert werden.",
    );
  }
  if (state.storageCorrupt) {
    showToast(
      "Gespeicherte Daten sind beschädigt. Importiere eine Sicherung, bevor du fortfährst.",
    );
  }
}

initialize();
