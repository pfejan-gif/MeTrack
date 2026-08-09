import {
  entryMetricValue,
  formatNumber,
  metricDefinition,
} from "../core.js";

const DAY_MS = 86_400_000;
const chartInteractions = new WeakSet();
const chartPaints = new WeakMap();
const dateTickFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});
const tooltipDateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function dayValue(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ""));
  if (!match) return null;
  const value = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(value) ? Math.round(value / DAY_MS) : null;
}

function dateFromDay(day) {
  return new Date(day * DAY_MS);
}

function niceStep(value) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const factor = normalized <= 1
    ? 1
    : normalized <= 2
      ? 2
      : normalized <= 2.5
        ? 2.5
        : normalized <= 5
          ? 5
          : 10;
  return factor * magnitude;
}

export function chartDateDomain(entries, { period = "all", today } = {}) {
  const entryDays = entries
    .map((entry) => dayValue(entry.date))
    .filter((value) => value !== null);
  const todayDay = dayValue(today);
  const fallbackEnd = todayDay ?? entryDays.at(-1) ?? 0;
  const periodDays = Number(period);

  if (period !== "all" && Number.isFinite(periodDays) && periodDays > 1) {
    return {
      start: fallbackEnd - periodDays + 1,
      end: fallbackEnd,
    };
  }

  if (!entryDays.length) return { start: fallbackEnd - 1, end: fallbackEnd };
  const start = Math.min(...entryDays);
  const end = Math.max(...entryDays);
  return start === end
    ? { start: start - 1, end: end + 1 }
    : { start, end };
}

export function chartValueScale(values, { completion = false } = {}) {
  if (completion) return { min: 0, max: 1, ticks: [0, 1] };
  const finiteValues = values.filter(Number.isFinite);
  if (!finiteValues.length) return { min: 0, max: 1, ticks: [0, 0.5, 1] };

  const sourceMin = Math.min(...finiteValues);
  const sourceMax = Math.max(...finiteValues);
  const sourceRange = sourceMax - sourceMin;
  const targetRange = sourceRange || Math.max(Math.abs(sourceMax) * 0.1, 1);
  const step = niceStep(targetRange / 2);
  let min = sourceRange
    ? Math.floor(sourceMin / step) * step
    : Math.floor((sourceMin - step) / step) * step;
  let max = sourceRange
    ? Math.ceil(sourceMax / step) * step
    : Math.ceil((sourceMax + step) / step) * step;
  if (min === max) {
    min -= step;
    max += step;
  }

  const ticks = [];
  for (let value = min, index = 0; value <= max + step / 2 && index < 7; value += step, index += 1)
    ticks.push(Number(value.toPrecision(12)));
  return { min, max, ticks };
}

export function createChartModel(
  entries,
  values,
  { completion = false, period = "all", today } = {},
) {
  const dateDomain = chartDateDomain(entries, { period, today });
  const valueScale = chartValueScale(values, { completion });
  const dateSpread = Math.max(1, dateDomain.end - dateDomain.start);
  const valueSpread = Math.max(1e-9, valueScale.max - valueScale.min);
  const points = entries
    .map((entry, index) => ({
      date: entry.date,
      day: dayValue(entry.date),
      value: values[index],
    }))
    .filter((point) => point.day !== null && Number.isFinite(point.value))
    .sort((left, right) => left.day - right.day)
    .map((point) => ({
      ...point,
      xRatio: Math.min(1, Math.max(0, (point.day - dateDomain.start) / dateSpread)),
      yRatio: Math.min(1, Math.max(0, (point.value - valueScale.min) / valueSpread)),
    }));

  return { dateDomain, points, valueScale };
}

function themeColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    elevated: styles.getPropertyValue("--bg-elevated").trim() || "#0a1524",
    line: styles.getPropertyValue("--line-strong").trim() || "rgba(145, 169, 198, 0.28)",
    mint: styles.getPropertyValue("--mint").trim() || "#0a8f65",
    muted: styles.getPropertyValue("--muted").trim() || "#8fa2ba",
    surface: styles.getPropertyValue("--surface-solid").trim() || "#0f1d2f",
    text: styles.getPropertyValue("--text").trim() || "#f5f9ff",
  };
}

function roundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function chartDateTicks(domain) {
  const middle = Math.round((domain.start + domain.end) / 2);
  return [domain.start, middle, domain.end];
}

function nearestPointIndex(points, x) {
  if (!points.length) return null;
  let result = 0;
  let distance = Math.abs(points[0].x - x);
  for (let index = 1; index < points.length; index += 1) {
    const candidate = Math.abs(points[index].x - x);
    if (candidate < distance) {
      result = index;
      distance = candidate;
    }
  }
  return result;
}

function updateActivePoint(canvas, clientX) {
  const state = chartPaints.get(canvas);
  if (!state || state.compact || !state.points.length) return;
  const rect = canvas.getBoundingClientRect();
  const index = nearestPointIndex(state.points, clientX - rect.left);
  if (index === state.activeIndex) return;
  state.activeIndex = index;
  state.paint(index);
}

function ensureInteraction(canvas) {
  if (chartInteractions.has(canvas)) return;
  chartInteractions.add(canvas);
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "touch") updateActivePoint(canvas, event.clientX);
  });
  canvas.addEventListener("pointerdown", (event) => {
    updateActivePoint(canvas, event.clientX);
  });
  canvas.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "touch") return;
    const state = chartPaints.get(canvas);
    if (!state || state.activeIndex === null) return;
    state.activeIndex = null;
    state.paint(null);
  });
  canvas.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const state = chartPaints.get(canvas);
    if (!state || state.compact || !state.points.length) return;
    event.preventDefault();
    const last = state.points.length - 1;
    const current = state.activeIndex ?? (event.key === "ArrowLeft" ? last : 0);
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
        ? last
        : Math.min(last, Math.max(0, current + (event.key === "ArrowLeft" ? -1 : 1)));
    state.activeIndex = next;
    state.paint(next);
  });
}

export function clearCanvas(canvas) {
  chartPaints.delete(canvas);
  const context = canvas.getContext("2d");
  context?.clearRect(0, 0, canvas.width, canvas.height);
}

export function drawChart(
  canvas,
  entries,
  key,
  exercises,
  { compact = false, period = "all", today } = {},
) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const values = entries.map((entry) => entryMetricValue(entry, key, exercises));
  const definition = metricDefinition(key, exercises);
  const completion = definition?.completion === true;
  const model = createChartModel(entries, values, { completion, period, today });
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const pad = compact
    ? { top: 8, right: 8, bottom: 8, left: 8 }
    : { top: 30, right: 16, bottom: 38, left: 50 };
  const width = Math.max(1, rect.width - pad.left - pad.right);
  const height = Math.max(1, rect.height - pad.top - pad.bottom);
  const decimals = definition?.decimals ?? 0;
  const unit = definition?.unit || "";

  const points = model.points.map((point) => ({
    ...point,
    x: pad.left + point.xRatio * width,
    y: pad.top + height - point.yRatio * height,
  }));

  function paint(activeIndex = null) {
    const pixelWidth = Math.round(rect.width * ratio);
    const pixelHeight = Math.round(rect.height * ratio);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    if (!points.length) return;
    const colors = themeColors();

    if (!compact) {
      context.save();
      context.strokeStyle = colors.line;
      context.fillStyle = colors.muted;
      context.lineWidth = 1;
      context.font = "650 11px system-ui, sans-serif";
      context.textBaseline = "bottom";
      context.textAlign = "left";
      context.fillText(unit, pad.left, pad.top - 9);
      context.textBaseline = "middle";
      context.textAlign = "right";
      for (const tick of model.valueScale.ticks) {
        const ratioY = (tick - model.valueScale.min) /
          Math.max(1e-9, model.valueScale.max - model.valueScale.min);
        const y = pad.top + height - ratioY * height;
        context.beginPath();
        context.moveTo(pad.left, y);
        context.lineTo(pad.left + width, y);
        context.stroke();
        context.fillText(formatNumber(tick, decimals), pad.left - 9, y);
      }

      const dateTicks = chartDateTicks(model.dateDomain);
      context.textBaseline = "top";
      dateTicks.forEach((tick, index) => {
        const x = pad.left + ((tick - model.dateDomain.start) /
          Math.max(1, model.dateDomain.end - model.dateDomain.start)) * width;
        context.beginPath();
        context.moveTo(x, pad.top);
        context.lineTo(x, pad.top + height);
        context.stroke();
        context.textAlign = index === 0 ? "left" : index === dateTicks.length - 1 ? "right" : "center";
        context.fillText(dateTickFormatter.format(dateFromDay(tick)), x, pad.top + height + 12);
      });
      context.restore();
    }

    if (points.length >= 4 && !completion) {
      const gradient = context.createLinearGradient(0, pad.top, 0, pad.top + height);
      gradient.addColorStop(0, `${colors.mint}2b`);
      gradient.addColorStop(1, `${colors.mint}00`);
      context.save();
      context.fillStyle = gradient;
      context.beginPath();
      context.moveTo(points[0].x, pad.top + height);
      for (const point of points) context.lineTo(point.x, point.y);
      context.lineTo(points.at(-1).x, pad.top + height);
      context.closePath();
      context.fill();
      context.restore();
    }

    if (points.length > 1 && !completion) {
      context.save();
      context.lineWidth = compact ? 3 : 2.5;
      context.lineJoin = "round";
      context.lineCap = "round";
      context.strokeStyle = colors.mint;
      if (!compact && points.length <= 3) {
        context.globalAlpha = 0.68;
        context.setLineDash([6, 6]);
      }
      context.beginPath();
      points.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.stroke();
      context.restore();
    }

    if (!compact) {
      context.save();
      context.fillStyle = colors.mint;
      context.strokeStyle = colors.surface;
      context.lineWidth = 2.5;
      for (const point of points) {
        context.beginPath();
        context.arc(point.x, point.y, points.length <= 3 ? 5 : 3.5, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      }
      context.restore();
    } else {
      context.fillStyle = colors.mint;
      for (const point of points) {
        context.beginPath();
        context.arc(point.x, point.y, 2.5, 0, Math.PI * 2);
        context.fill();
      }
    }

    if (!compact && points.length <= 3 && activeIndex === null) {
      context.save();
      context.fillStyle = colors.text;
      context.font = "800 12px system-ui, sans-serif";
      context.textBaseline = "bottom";
      points.forEach((point, index) => {
        context.textAlign = index === 0 ? "left" : index === points.length - 1 ? "right" : "center";
        const below = point.y < pad.top + 22;
        context.textBaseline = below ? "top" : "bottom";
        context.fillText(
          `${formatNumber(point.value, decimals)} ${unit}`.trim(),
          point.x,
          point.y + (below ? 10 : -10),
        );
      });
      context.restore();
    }

    if (!compact && activeIndex !== null && points[activeIndex]) {
      const point = points[activeIndex];
      const label = `${tooltipDateFormatter.format(dateFromDay(point.day))} · ${formatNumber(point.value, decimals)} ${unit}`.trim();
      context.save();
      context.strokeStyle = colors.mint;
      context.globalAlpha = 0.45;
      context.setLineDash([3, 4]);
      context.beginPath();
      context.moveTo(point.x, pad.top);
      context.lineTo(point.x, pad.top + height);
      context.stroke();
      context.restore();

      context.save();
      context.font = "800 12px system-ui, sans-serif";
      const bubbleWidth = context.measureText(label).width + 22;
      const bubbleHeight = 32;
      const bubbleX = Math.min(
        pad.left + width - bubbleWidth,
        Math.max(pad.left, point.x - bubbleWidth / 2),
      );
      const bubbleY = point.y < pad.top + 50
        ? point.y + 13
        : point.y - bubbleHeight - 13;
      roundedRect(context, bubbleX, bubbleY, bubbleWidth, bubbleHeight, 10);
      context.fillStyle = colors.elevated;
      context.fill();
      context.strokeStyle = colors.mint;
      context.lineWidth = 1;
      context.stroke();
      context.fillStyle = colors.text;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(label, bubbleX + bubbleWidth / 2, bubbleY + bubbleHeight / 2);
      context.restore();
    }
  }

  const interactionState = {
    activeIndex: null,
    compact,
    paint,
    points,
  };
  chartPaints.set(canvas, interactionState);
  if (!compact) {
    canvas.tabIndex = 0;
    ensureInteraction(canvas);
  }
  paint();
  return model;
}
