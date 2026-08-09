const ICON_BASE_PATH = "./assets/icons/metrics";

const icon = (id, label) =>
  Object.freeze({
    id,
    label,
    src: `${ICON_BASE_PATH}/${id}.webp`,
  });

export const BODY_METRIC_ICONS = Object.freeze([
  icon("weight", "Gewicht"),
  icon("waist", "Bauchumfang"),
]);

const ICON_BY_ID = new Map(
  BODY_METRIC_ICONS.map((definition) => [definition.id, definition]),
);

export function bodyMetricIconDefinition(metricId) {
  const definition = ICON_BY_ID.get(String(metricId || ""));
  if (!definition)
    throw new RangeError(`Unbekanntes Körperwert-Symbol: ${metricId}`);
  return definition;
}

export function bodyMetricIconSource(metricId) {
  return bodyMetricIconDefinition(metricId).src;
}

export function createBodyMetricIconImage(metricId) {
  const definition = bodyMetricIconDefinition(metricId);
  const image = document.createElement("img");
  image.className = "body-metric-icon-image";
  image.src = definition.src;
  image.dataset.bodyMetricIcon = definition.id;
  image.alt = "";
  image.width = 256;
  image.height = 256;
  image.decoding = "async";
  image.draggable = false;
  image.setAttribute("aria-hidden", "true");
  return image;
}
