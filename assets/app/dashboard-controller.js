import {
  BODY_METRIC_KEYS,
  METRICS,
  calculateStreak,
  entryMetricValue,
  exerciseCompletionSummary,
  exerciseDefinition,
  exerciseMetricKey,
  formatNumber,
  metricDefinition,
  todayLocal,
} from "../core.js";
import { createBodyMetricIconImage } from "../body-metric-icons.js";
import { createExerciseIconImage } from "../exercise-icons.js";
import {
  clearCanvas,
  drawChart as drawChartCanvas,
} from "./chart-renderer.js";
import { exerciseIconBadge } from "./exercise-icon-ui.js";
import { createHistoryController } from "./history-controller.js";

export function createDashboardController({ state, elements, setText }) {
  const drawChart = (canvas, entries, key, options = {}) =>
    drawChartCanvas(canvas, entries, key, state.exercises, options);
  const { renderHistory } = createHistoryController({ state, elements });

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
      button.append(createExerciseIconImage(exercise.icon));
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
      button.append(createBodyMetricIconImage(key));
      const label = document.createElement("span");
      label.textContent = METRICS[key].shortLabel;
      button.append(label);
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

  function summaryItem(label, value, { detail = "", tone = "" } = {}) {
    const item = document.createElement("div");
    item.className = "chart-summary-item";
    if (tone) item.dataset.tone = tone;
    const itemLabel = document.createElement("span");
    itemLabel.textContent = label;
    const itemValue = document.createElement("strong");
    itemValue.textContent = value;
    item.append(itemLabel, itemValue);
    if (detail) {
      const itemDetail = document.createElement("small");
      itemDetail.textContent = detail;
      item.append(itemDetail);
    }
    return item;
  }

  function renderChartSummary(entries, definition) {
    elements.chartSummary.replaceChildren();
    if (!entries.length) {
      const message = document.createElement("p");
      message.className = "chart-summary-message";
      message.textContent = definition.completion
        ? `${definition.label} wurde im ausgewählten Zeitraum noch nicht durchgeführt.`
        : `Noch keine Werte für ${definition.label}.`;
      elements.chartSummary.append(message);
      return message.textContent;
    }

    if (definition.completion) {
      const summary = exerciseCompletionSummary(
        entries,
        definition.exerciseId,
        state.exercises,
      );
      const count = summary.completed;
      elements.chartSummary.append(
        summaryItem("Durchgeführt", `${count}×`, { tone: "accent" }),
        summaryItem("Einträge", formatNumber(entries.length)),
      );
      return count === 1
        ? "1-mal im ausgewählten Zeitraum durchgeführt"
        : `${count}-mal im ausgewählten Zeitraum durchgeführt`;
    }

    const first = entryMetricValue(entries[0], state.metric, state.exercises);
    const last = entryMetricValue(entries.at(-1), state.metric, state.exercises);
    const change = entries.length > 1 ? last - first : null;
    const percentage = change !== null && first !== 0
      ? `${change > 0 ? "+" : ""}${formatNumber((change / Math.abs(first)) * 100, 1)} %`
      : "";
    elements.chartSummary.append(
      summaryItem("Zuletzt", `${formatNumber(last, definition.decimals)} ${definition.unit}`),
      summaryItem(
        "Veränderung",
        signed(change, definition.decimals, definition.unit) || "Noch offen",
        {
          detail: percentage || (entries.length === 1 ? "Weiterer Wert nötig" : ""),
          tone: change === null || change === 0 ? "" : "accent",
        },
      ),
      summaryItem("Messungen", formatNumber(entries.length)),
    );
    const parts = [
      `${entries.length} ${entries.length === 1 ? "Wert" : "Werte"}`,
      `zuletzt ${formatNumber(last, definition.decimals)} ${definition.unit}`,
    ];
    if (change !== null)
      parts.push(`Veränderung ${signed(change, definition.decimals, definition.unit)}`);
    return parts.join(" · ");
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
        createExerciseIconImage(spotlight.icon),
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
        setText("spotlightExerciseTrend", "Insgesamt durchgeführt");
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
        note.textContent = "Insgesamt durchgeführt";
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
    elements.chartEmpty.hidden = entries.length > 0;
    drawChart(elements.progressChart, entries, state.metric, {
      period: state.period,
      today: todayLocal(),
    });
    const summaryText = renderChartSummary(entries, definition);
    elements.progressChart.setAttribute(
      "aria-label",
      `${definition.label}-Verlauf: ${summaryText}`,
    );
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
