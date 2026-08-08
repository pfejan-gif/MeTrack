import {
  BODY_METRIC_KEYS,
  METRICS,
  calculateStreak,
  entryExerciseCompletion,
  entryExerciseValues,
  entryMetricValue,
  exerciseCompletionSummary,
  exerciseDefinition,
  exerciseMetricKey,
  formatDate,
  formatNumber,
  metricDefinition,
  todayLocal,
} from "../core.js";
import { createExerciseIconSvg } from "../exercise-icons.js";
import {
  clearCanvas,
  drawChart as drawChartCanvas,
} from "./chart-renderer.js";
import { exerciseIconBadge } from "./exercise-icon-ui.js";

export function createDashboardController({ state, elements, setText }) {
  const drawChart = (canvas, entries, key, options = {}) =>
    drawChartCanvas(canvas, entries, key, state.exercises, options);

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
      button.append(createExerciseIconSvg(exercise.icon));
      const label = document.createElement("span");
      label.textContent = exercise.name;
      button.append(label);
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
      elements.spotlightExerciseIcon.replaceChildren(
        createExerciseIconSvg(spotlight.icon),
      );
      elements.spotlightExerciseIcon.hidden = false;
      const definition = exerciseDefinition(spotlight);
      if (definition.completion) {
        const summary = exerciseCompletionSummary(
          state.entries,
          spotlight.id,
          state.exercises,
        );
        setText("spotlightExerciseLabel", `${spotlight.name} durchgeführt`);
        setText("spotlightExerciseValue", formatNumber(summary.completed));
        setText("spotlightExerciseUnit", "×");
        setText(
          "spotlightExerciseTrend",
          summary.tracked
            ? `${summary.rate} % · Serie ${summary.currentStreak} ${summary.currentStreak === 1 ? "Tag" : "Tage"}`
            : "Noch kein Tagesstatus",
        );
      } else {
        const summary = metricSummary(exerciseMetricKey(spotlight.id));
        setText("spotlightExerciseLabel", `${spotlight.name} Bestwert`);
        setText("spotlightExerciseValue", formatNumber(summary.best));
        setText("spotlightExerciseUnit", definition.unit);
        setText(
          "spotlightExerciseTrend",
          signed(summary.fromPrevious, 0, definition.unit) || "Noch kein Vergleich",
        );
      }
      drawChart(
        elements.overviewChart,
        filteredMetricEntries(exerciseMetricKey(spotlight.id), "all").slice(-8),
        exerciseMetricKey(spotlight.id),
        { compact: true },
      );
    } else {
      elements.spotlightExerciseIcon.replaceChildren();
      elements.spotlightExerciseIcon.hidden = true;
      setText("spotlightExerciseLabel", "Kein Training aktiv");
      setText("spotlightExerciseValue", "—");
      setText("spotlightExerciseUnit", "");
      setText("spotlightExerciseTrend", "Aktiviere einen Eintrag unter „Verwalten“");
      clearCanvas(elements.overviewChart);
    }
  
    elements.exerciseOverviewCards.replaceChildren();
    for (const exercise of active.slice(1)) {
      const definition = exerciseDefinition(exercise);
      const card = document.createElement("article");
      card.className = "card metric-card compact-metric-card";
      const icon = exerciseIconBadge(
        exercise,
        "metric-icon exercise-symbol metric-exercise-icon",
      );
      const body = document.createElement("div");
      const label = document.createElement("p");
      label.className = "metric-label";
      label.textContent = exercise.name;
      const value = document.createElement("p");
      value.className = "metric-value";
      const number = document.createElement("span");
      const unit = document.createElement("small");
      const note = document.createElement("p");
      note.className = "metric-change";
      if (definition.completion) {
        const summary = exerciseCompletionSummary(
          state.entries,
          exercise.id,
          state.exercises,
        );
        number.textContent = formatNumber(summary.completed);
        unit.textContent = "×";
        note.textContent = summary.tracked
          ? `${summary.rate} % der erfassten Tage · Serie ${summary.currentStreak}`
          : "Noch kein Tagesstatus";
      } else {
        const summary = metricSummary(exerciseMetricKey(exercise.id));
        number.textContent = formatNumber(summary.best);
        unit.textContent = definition.unit;
        note.textContent = "Persönlicher Bestwert";
      }
      value.append(number, " ", unit);
      body.append(label, value, note);
      card.append(icon, body);
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
      elements.chartSummary.textContent = definition.completion
        ? `Noch kein Tagesstatus für ${definition.label}.`
        : `Noch keine Werte für ${definition.label}.`;
    } else if (definition.completion) {
      const summary = exerciseCompletionSummary(
        entries,
        definition.exerciseId,
        state.exercises,
      );
      elements.chartSummary.textContent = `${summary.completed} von ${summary.tracked} erfassten ${summary.tracked === 1 ? "Tag" : "Tagen"} durchgeführt (${summary.rate} %). Aktuelle Serie: ${summary.currentStreak} ${summary.currentStreak === 1 ? "Tag" : "Tage"}.`;
    } else {
      const first = entryMetricValue(entries[0], state.metric, state.exercises);
      const last = entryMetricValue(entries[entries.length - 1], state.metric, state.exercises);
      elements.chartSummary.textContent = `${entries.length} ${entries.length === 1 ? "Wert" : "Werte"}. Zuletzt ${formatNumber(last, definition.decimals)} ${definition.unit}${entries.length > 1 ? ` · Veränderung ${signed(last - first, definition.decimals, definition.unit)}` : ""}.`;
    }
    elements.progressChart.setAttribute("aria-label", `${definition.label}-Verlauf: ${elements.chartSummary.textContent}`);
  }
  
  function exerciseDisplay(entry, exercise) {
    if (exercise.kind === "stretch") {
      const completed = entryExerciseCompletion(entry, exercise.id);
      return completed === null ? null : completed ? "Erledigt ✓" : "Nicht erledigt";
    }
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
      line.append(createExerciseIconSvg(exercise.icon));
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
        ...state.exercises.map((exercise) => ({
          label: exercise.name,
          value: exerciseDisplay(entry, exercise),
          icon: exercise.icon,
        })),
        { label: "Gewicht", value: entry.weight === null ? null : `${formatNumber(entry.weight, 1)} kg` },
        { label: "Bauch", value: entry.waist === null ? null : `${formatNumber(entry.waist, 1)} cm` },
      ].filter((item) => item.value);
      for (const { label, value, icon } of items) {
        const metric = document.createElement("div");
        metric.className = "history-metric";
        const small = document.createElement("span");
        if (icon) small.append(createExerciseIconSvg(icon));
        small.append(label);
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
  

  return {
    metricFallback,
    renderMetricTabs,
    renderOverview,
    filteredMetricEntries,
    renderCharts,
    renderHistory,
    render,
  };
}
