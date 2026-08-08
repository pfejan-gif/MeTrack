import {
  entryMetricValue,
  metricDefinition,
} from "../core.js";

export function clearCanvas(canvas) {
  const context = canvas.getContext("2d");
  context?.clearRect(0, 0, canvas.width, canvas.height);
}

export function drawChart(
  canvas,
  entries,
  key,
  exercises,
  { compact = false } = {},
) {
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
    entryMetricValue(entry, key, exercises),
  );
  const definition = metricDefinition(key, exercises);
  const completion = definition?.completion === true;
  const min = completion ? 0 : Math.min(...values);
  const max = completion ? 1 : Math.max(...values);
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
  const yFor = (value) => completion
    ? pad + height - value * height
    : pad + height - ((value - min + spread * 0.08) / (spread * 1.16)) * height;
  context.beginPath();
  values.forEach((value, index) => {
    const x = pad + (values.length === 1 ? width / 2 : (index / (values.length - 1)) * width);
    const y = yFor(value);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
  if (!compact) {
    context.fillStyle = mint;
    values.forEach((value, index) => {
      const x = pad + (values.length === 1 ? width / 2 : (index / (values.length - 1)) * width);
      const y = yFor(value);
      context.beginPath();
      context.arc(x, y, 3.5, 0, Math.PI * 2);
      context.fill();
    });
  }
}

