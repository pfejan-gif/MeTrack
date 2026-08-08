const svg = (id, label, group, shapes) =>
  Object.freeze({
    id,
    label,
    group,
    shapes: Object.freeze(
      shapes.map(([tag, attributes]) =>
        Object.freeze([tag, Object.freeze({ ...attributes })]),
      ),
    ),
  });

export const EXERCISE_ICONS = Object.freeze([
  svg("activity", "Allgemein", "exercise", [
    ["path", { d: "M3 12h4l2-6 4 12 2-6h6" }],
  ]),
  svg("plank", "Plank", "exercise", [
    ["circle", { cx: "5", cy: "8", r: "2" }],
    ["path", { d: "M7 10l5 2 5-1 3 4M9 11l-3 6M14 12l3 5M3 18h19" }],
  ]),
  svg("push-up", "Liegestütz", "exercise", [
    ["circle", { cx: "5", cy: "10", r: "2" }],
    ["path", { d: "M7 11l5 2 5-1 3 3M10 13l-3 4M15 12l3 5M3 18h19" }],
  ]),
  svg("squat", "Kniebeuge", "exercise", [
    ["circle", { cx: "12", cy: "4", r: "2" }],
    ["path", { d: "M12 7v5l-4 3m4-5 4 4M8 15l-3 4m11-5 3 5M9 9l-4 3m10-3 4 3" }],
  ]),
  svg("sit-up", "Sit-Up", "exercise", [
    ["circle", { cx: "7", cy: "11", r: "2" }],
    ["path", { d: "M9 12l4 3 5-1M12 15l-3 3m9-4 3 4M3 19h19" }],
  ]),
  svg("dumbbell", "Hantel", "exercise", [
    ["path", { d: "M6 8v8M3.5 10v4M18 8v8m2.5-6v4M6 12h12" }],
  ]),
  svg("kettlebell", "Kettlebell", "exercise", [
    ["path", { d: "M9 8a3 3 0 0 1 6 0M8 9h8l2 4a6 6 0 1 1-12 0z" }],
  ]),
  svg("running", "Laufen", "exercise", [
    ["circle", { cx: "15", cy: "4", r: "2" }],
    ["path", { d: "M13 7l-3 4 4 2 2 4m-6-6-3 2m7 0-4 6m6-9 3 2" }],
  ]),
  svg("cycling", "Radfahren", "exercise", [
    ["circle", { cx: "6", cy: "17", r: "4" }],
    ["circle", { cx: "18", cy: "17", r: "4" }],
    ["circle", { cx: "14", cy: "4", r: "1.7" }],
    ["path", { d: "M10 17l3-7 3 3h3M9 8h4l-2 4 4 5" }],
  ]),
  svg("pull-up", "Klimmzug", "exercise", [
    ["path", { d: "M4 4h16M6 4v3m12-3v3" }],
    ["circle", { cx: "12", cy: "10", r: "2" }],
    ["path", { d: "M10 9 7 6m7 3 3-3m-5 6v5m0-2-4 5m4-5 4 5" }],
  ]),
  svg("lunge", "Ausfallschritt", "exercise", [
    ["circle", { cx: "12", cy: "4", r: "2" }],
    ["path", { d: "M12 7v6m0-4-4 3m4-2 4 3m-4 0-5 3-3 4m8-7 4 4h4" }],
  ]),
  svg("jump-rope", "Seilspringen", "exercise", [
    ["circle", { cx: "12", cy: "5", r: "2" }],
    ["path", { d: "M12 8v6m0-4-4 3m4-3 4 3m-4 1-3 6m3-6 3 6M7 9C2 12 3 20 7 21m10-12c5 3 4 11 0 12" }],
  ]),
  svg("rowing", "Rudern", "exercise", [
    ["circle", { cx: "8", cy: "7", r: "2" }],
    ["path", { d: "M9 9l4 4 6 1m-7-2-4 4m7-3 4-6M3 18h18l-3 3H6z" }],
  ]),
  svg("target", "Freies Training", "exercise", [
    ["circle", { cx: "12", cy: "12", r: "8" }],
    ["circle", { cx: "12", cy: "12", r: "3" }],
    ["path", { d: "m14 10 6-6m0 0v4m0-4h-4" }],
  ]),
  svg("stretch", "Allgemein", "stretch", [
    ["circle", { cx: "12", cy: "4", r: "2" }],
    ["path", { d: "M12 7v7m0-5L6 6m6 3 6-3m-6 8-4 6m4-6 4 6" }],
  ]),
  svg("hip-stretch", "Hüfte", "stretch", [
    ["circle", { cx: "10", cy: "4", r: "2" }],
    ["path", { d: "M10 7v6l4 3h6m-10-5-4 4-3 5m11-4-3 4" }],
  ]),
  svg("hamstring", "Beinrückseite", "stretch", [
    ["circle", { cx: "7", cy: "6", r: "2" }],
    ["path", { d: "M9 7l4 5 7 2M12 12l-4 6H3m10-6-1-5" }],
  ]),
  svg("shoulder-stretch", "Schulter", "stretch", [
    ["circle", { cx: "12", cy: "4", r: "2" }],
    ["path", { d: "M12 7v7m-7-4 14 2m-10-1 8-4m-5 7-3 6m3-6 3 6" }],
  ]),
  svg("neck-stretch", "Nacken", "stretch", [
    ["circle", { cx: "13", cy: "5", r: "3" }],
    ["path", { d: "M11 8v3m4-3v3m-4 0c-4 1-6 4-6 9m10-9c4 1 5 4 5 9M8 5l3-3" }],
  ]),
  svg("side-stretch", "Seite", "stretch", [
    ["circle", { cx: "11", cy: "4", r: "2" }],
    ["path", { d: "M11 7c0 5 2 7 5 9m-5-7L7 5m4 9-3 6m3-6 5 6M7 5l1-3" }],
  ]),
  svg("butterfly", "Schmetterling", "stretch", [
    ["circle", { cx: "12", cy: "5", r: "2" }],
    ["path", { d: "M12 8v6m0-3-5 3-4 4m9-7 5 3 4 4m-9-4-5 5m5-5 5 5" }],
  ]),
  svg("calf-stretch", "Wade", "stretch", [
    ["circle", { cx: "8", cy: "4", r: "2" }],
    ["path", { d: "M8 7v6l5 2 4 5m-9-9-4 4m9 0-3 5m7 0h4" }],
  ]),
  svg("back-stretch", "Rücken", "stretch", [
    ["circle", { cx: "7", cy: "7", r: "2" }],
    ["path", { d: "M9 8c4 0 6 2 7 6l1 5M9 10l-4 5-2 4m7-4h10M10 12l2 7" }],
  ]),
  svg("yoga", "Yoga", "stretch", [
    ["circle", { cx: "12", cy: "4", r: "2" }],
    ["path", { d: "M12 7v6m0-4L6 6m6 3 6-3m-6 7-5 5m5-5 5 5M5 20c2-3 5-3 7 0m0 0c2-3 5-3 7 0" }],
  ]),
]);

const ICON_BY_ID = new Map(EXERCISE_ICONS.map((icon) => [icon.id, icon]));

export function iconOptionsForKind(kind) {
  const group = kind === "stretch" ? "stretch" : "exercise";
  return EXERCISE_ICONS.filter((icon) => icon.group === group);
}

export function defaultExerciseIcon(kind, exerciseId = "") {
  const defaults = {
    "exercise-plank": "plank",
    "exercise-pushups": "push-up",
    "exercise-squats": "squat",
  };
  return defaults[exerciseId] || (kind === "stretch" ? "stretch" : "activity");
}

export function isExerciseIconAllowed(iconId, kind) {
  const icon = ICON_BY_ID.get(String(iconId || ""));
  return Boolean(icon && icon.group === (kind === "stretch" ? "stretch" : "exercise"));
}

export function exerciseIconDefinition(iconId) {
  return ICON_BY_ID.get(String(iconId || "")) || ICON_BY_ID.get("activity");
}

export function createExerciseIconSvg(iconId) {
  const definition = exerciseIconDefinition(iconId);
  const element = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  element.setAttribute("viewBox", "0 0 24 24");
  element.setAttribute("aria-hidden", "true");
  element.setAttribute("focusable", "false");
  for (const [tag, attributes] of definition.shapes) {
    const shape = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [name, value] of Object.entries(attributes))
      shape.setAttribute(name, value);
    element.append(shape);
  }
  return element;
}
