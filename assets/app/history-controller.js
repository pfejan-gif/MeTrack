import {
  entryExerciseCompletion,
  entryExerciseValues,
  exerciseDefinition,
  formatDate,
  formatNumber,
} from "../core.js";
import { createExerciseIconSvg } from "../exercise-icons.js";

export const HISTORY_PAGE_SIZE = 20;

export function exerciseHistoryValue(entry, exercise) {
  if (exercise.kind === "stretch") {
    return entryExerciseCompletion(entry, exercise.id) === true
      ? "Erledigt ✓"
      : null;
  }
  const values = entryExerciseValues(entry, exercise.id);
  if (values.every((value) => value === null)) return null;
  const unit = exerciseDefinition(exercise).unit;
  return `${values.map((value) => formatNumber(value)).join(" · ")} ${unit}`;
}

function historyDate(dateString) {
  return new Date(`${dateString}T12:00:00`);
}

export function formatHistoryMonth(dateString, locale = "de-DE") {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(historyDate(dateString));
}

export function formatHistoryDay(dateString, locale = "de-DE") {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(historyDate(dateString));
}

export function groupHistoryEntries(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const key = entry.date.slice(0, 7);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: formatHistoryMonth(entry.date),
        entries: [],
      });
    }
    groups.get(key).entries.push(entry);
  }
  return [...groups.values()];
}

export function historyEntrySummary(entry, exercises) {
  let exercisesCompleted = 0;
  let stretchesCompleted = 0;
  for (const exercise of exercises) {
    if (!exerciseHistoryValue(entry, exercise)) continue;
    if (exercise.kind === "stretch") stretchesCompleted += 1;
    else exercisesCompleted += 1;
  }

  const items = [];
  if (exercisesCompleted) {
    items.push({
      kind: "training",
      label: `${exercisesCompleted} ${
        exercisesCompleted === 1 ? "Übung" : "Übungen"
      }`,
    });
  }
  if (stretchesCompleted) {
    items.push({
      kind: "stretch",
      label: `${stretchesCompleted} ${
        stretchesCompleted === 1 ? "Dehnung" : "Dehnungen"
      }`,
    });
  }
  if (entry.weight !== null) {
    items.push({ kind: "body", label: `${formatNumber(entry.weight, 1)} kg` });
  }
  if (entry.waist !== null) {
    items.push({ kind: "body", label: `${formatNumber(entry.waist, 1)} cm` });
  }
  return items;
}

function createSvgIcon(pathData) {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  for (const data of pathData) {
    const path = document.createElementNS(namespace, "path");
    path.setAttribute("d", data);
    svg.append(path);
  }
  return svg;
}

export function createHistoryController({ state, elements }) {
  function exerciseCell(entry) {
    const cell = document.createElement("td");
    cell.className = "custom-history-cell";
    let count = 0;
    for (const exercise of state.exercises) {
      const value = exerciseHistoryValue(entry, exercise);
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

  function actionButton(
    action,
    date,
    label,
    danger = false,
    visibleLabel = "",
  ) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `row-action${
      visibleLabel ? " history-detail-action" : ""
    }${danger ? " danger" : ""}`;
    button.dataset.action = action;
    button.dataset.date = date;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.append(
      createSvgIcon(
        action === "edit"
          ? [
              "M12 20h9",
              "M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z",
            ]
          : [
              "M4 7h16",
              "M9 7V4h6v3",
              "m8 7-1 10H8L7 7",
              "M10 11v4m4-4v4",
            ],
      ),
    );
    if (visibleLabel) {
      const text = document.createElement("span");
      text.textContent = visibleLabel;
      button.append(text);
    }
    return button;
  }

  function historyMetricItems(entry) {
    return [
      ...state.exercises.map((exercise) => ({
        label: exercise.name,
        value: exerciseHistoryValue(entry, exercise),
        icon: exercise.icon,
      })),
      {
        label: "Gewicht",
        value:
          entry.weight === null ? null : `${formatNumber(entry.weight, 1)} kg`,
      },
      {
        label: "Bauch",
        value:
          entry.waist === null ? null : `${formatNumber(entry.waist, 1)} cm`,
      },
    ].filter((item) => item.value);
  }

  function appendHistoryMetrics(container, entry) {
    for (const { label, value, icon } of historyMetricItems(entry)) {
      const metric = document.createElement("div");
      metric.className = "history-metric";
      const small = document.createElement("span");
      if (icon) small.append(createExerciseIconSvg(icon));
      small.append(label);
      const strong = document.createElement("strong");
      strong.textContent = value;
      metric.append(small, strong);
      container.append(metric);
    }
  }

  function monthCountLabel(visible, total) {
    if (visible < total) return `${visible} von ${total}`;
    return `${total} ${total === 1 ? "Eintrag" : "Einträge"}`;
  }

  function appendDesktopEntry(entry) {
    const row = document.createElement("tr");
    const date = document.createElement("td");
    date.textContent = formatDate(entry.date);
    const weight = document.createElement("td");
    weight.textContent =
      entry.weight === null ? "—" : `${formatNumber(entry.weight, 1)} kg`;
    const waist = document.createElement("td");
    waist.textContent =
      entry.waist === null ? "—" : `${formatNumber(entry.waist, 1)} cm`;
    const actions = document.createElement("td");
    actions.className = "row-actions";
    actions.append(
      actionButton(
        "edit",
        entry.date,
        `Eintrag vom ${formatDate(entry.date)} bearbeiten`,
      ),
      actionButton(
        "delete",
        entry.date,
        `Eintrag vom ${formatDate(entry.date)} löschen`,
        true,
      ),
    );
    row.append(date, exerciseCell(entry), weight, waist, actions);
    elements.historyRows.append(row);
  }

  function mobileEntry(entry, isNewest) {
    const card = document.createElement("details");
    card.className = "history-item";
    card.open = isNewest;
    const summary = document.createElement("summary");
    summary.className = "history-summary";
    const summaryCopy = document.createElement("span");
    summaryCopy.className = "history-summary-copy";
    const dateLabel = document.createElement("strong");
    dateLabel.className = "history-summary-date";
    dateLabel.textContent = formatHistoryDay(entry.date);
    const chips = document.createElement("span");
    chips.className = "history-summary-chips";
    for (const item of historyEntrySummary(entry, state.exercises)) {
      const chip = document.createElement("span");
      chip.className = `history-summary-chip ${item.kind}`;
      chip.textContent = item.label;
      chips.append(chip);
    }
    summaryCopy.append(dateLabel, chips);
    const chevron = document.createElement("span");
    chevron.className = "history-summary-chevron";
    chevron.append(createSvgIcon(["m8 10 4 4 4-4"]));
    summary.append(summaryCopy, chevron);

    const details = document.createElement("div");
    details.className = "history-details";
    const metrics = document.createElement("div");
    metrics.className = "history-metrics";
    appendHistoryMetrics(metrics, entry);
    const actions = document.createElement("div");
    actions.className = "history-detail-actions";
    actions.append(
      actionButton(
        "edit",
        entry.date,
        "Eintrag bearbeiten",
        false,
        "Bearbeiten",
      ),
      actionButton(
        "delete",
        entry.date,
        "Eintrag löschen",
        true,
        "Löschen",
      ),
    );
    details.append(metrics, actions);
    card.append(summary, details);
    return card;
  }

  function renderHistory() {
    const entries = [...state.entries].reverse();
    const visible = entries.slice(0, state.historyLimit);
    const visibleGroups = groupHistoryEntries(visible);
    const monthTotals = new Map(
      groupHistoryEntries(entries).map((group) => [
        group.key,
        group.entries.length,
      ]),
    );
    const empty = entries.length === 0;
    const remaining = entries.length - visible.length;
    elements.historyEmpty.hidden = !empty;
    elements.desktopHistory.hidden = empty;
    elements.mobileHistory.hidden = empty;
    elements.showMoreHistoryButton.hidden = remaining === 0;
    if (remaining > 0) {
      const nextCount = Math.min(HISTORY_PAGE_SIZE, remaining);
      elements.showMoreHistoryButton.textContent = `${nextCount} ${
        nextCount === 1 ? "weiteren Eintrag" : "weitere Einträge"
      } anzeigen`;
    }
    elements.entryCount.textContent = empty
      ? "Noch keine Einträge"
      : `${entries.length} ${
          entries.length === 1 ? "Eintrag" : "Einträge"
        }${remaining > 0 ? ` · ${visible.length} angezeigt` : ""}`;
    elements.historyRows.replaceChildren();
    elements.mobileHistory.replaceChildren();

    for (const group of visibleGroups) {
      const desktopMonth = document.createElement("tr");
      desktopMonth.className = "history-month-row";
      const desktopMonthLabel = document.createElement("th");
      desktopMonthLabel.colSpan = 5;
      desktopMonthLabel.scope = "rowgroup";
      desktopMonthLabel.textContent = group.label;
      desktopMonth.append(desktopMonthLabel);
      elements.historyRows.append(desktopMonth);

      const month = document.createElement("section");
      month.className = "history-month";
      const monthHeading = document.createElement("div");
      monthHeading.className = "history-month-heading";
      const monthTitle = document.createElement("h3");
      monthTitle.textContent = group.label;
      const monthCount = document.createElement("span");
      monthCount.textContent = monthCountLabel(
        group.entries.length,
        monthTotals.get(group.key),
      );
      monthHeading.append(monthTitle, monthCount);
      const monthList = document.createElement("div");
      monthList.className = "history-month-list";

      for (const entry of group.entries) {
        appendDesktopEntry(entry);
        monthList.append(mobileEntry(entry, entry === visible[0]));
      }

      month.append(monthHeading, monthList);
      elements.mobileHistory.append(month);
    }
  }

  return { renderHistory };
}
