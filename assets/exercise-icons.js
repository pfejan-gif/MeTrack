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
    ["circle", { cx: "4", cy: "9", r: "1.7" }],
    ["path", { d: "M5.5 10.5h8.5l5 4h2.5M10 10.5 7 16H3.5m15.5-1.5h2.5M3 18h19" }],
  ]),
  svg("push-up", "Liegestütz", "exercise", [
    ["circle", { cx: "4", cy: "9", r: "1.7" }],
    ["path", { d: "M5.5 10l7.5 2 6 4h2.5M10 11.2 7.5 16H4M3 18h19M17 4v7m-2-2 2 2 2-2" }],
  ]),
  svg("squat", "Kniebeuge", "exercise", [
    ["path", { d: "M4 3v5M2.5 4.5v2M20 3v5m1.5-3.5v2M4 5.5h16" }],
    ["circle", { cx: "12", cy: "9", r: "1.6" }],
    ["path", { d: "M12 10.5v4m0-2-4-3m4 3 4-3m-4 5-4 2 3 4m1-6 4 2-3 4" }],
  ]),
  svg("sit-up", "Sit-Up", "exercise", [
    ["circle", { cx: "7", cy: "9", r: "1.8" }],
    ["path", { d: "M8.5 10.5c3 .8 4 3 5 5l4-1.5 3.5 5M11 12l3-3m-1 6.5-4 3.5M3 20h19M4 13c0-3 1-5 3-7m0 0H4m3 0v3" }],
  ]),
  svg("dumbbell", "Hantel", "exercise", [
    ["path", { d: "M6 8v8M3.5 10v4M18 8v8m2.5-6v4M6 12h12" }],
  ]),
  svg("kettlebell", "Kettlebell", "exercise", [
    ["path", { d: "M9 8a3 3 0 0 1 6 0M8 9h8l2 4a6 6 0 1 1-12 0z" }],
  ]),
  svg("running", "Laufen", "exercise", [
    ["circle", { cx: "15", cy: "4", r: "1.8" }],
    ["path", { d: "M13.5 7 10 11l4 2 2.5 4M10 11l-4 2m8 0-4 6m6-9 3.5 2M4 20h16" }],
  ]),
  svg("cycling", "Radfahren", "exercise", [
    ["circle", { cx: "6", cy: "17", r: "4" }],
    ["circle", { cx: "18", cy: "17", r: "4" }],
    ["circle", { cx: "14", cy: "4", r: "1.7" }],
    ["path", { d: "M10 17l3-7 3 3h3M9 8h4l-2 4 4 5" }],
  ]),
  svg("pull-up", "Klimmzug", "exercise", [
    ["path", { d: "M3 4h18M5 4v3m14-3v3" }],
    ["circle", { cx: "12", cy: "10", r: "2" }],
    ["path", { d: "M10.5 8.5 7 6m6.5 2.5L17 6m-5 6v5m0-2-4 5m4-5 4 5" }],
  ]),
  svg("lunge", "Ausfallschritt", "exercise", [
    ["circle", { cx: "8", cy: "4", r: "1.8" }],
    ["path", { d: "M8 6v7m0-4 5 3m-5-1-4 3m4-1 5 3h7m-7 0-3 4M8 13l-4 4-1 3M3 21h18" }],
  ]),
  svg("jump-rope", "Seilspringen", "exercise", [
    ["circle", { cx: "12", cy: "5", r: "1.8" }],
    ["path", { d: "M12 7v7m0-4-4 3m4-3 4 3m-4 1-3 6m3-6 3 6M7 10C2 12 2 20 6 22m11-12c5 2 5 10 1 12M6 9l1 2m11-2-1 2" }],
  ]),
  svg("rowing", "Rudern", "exercise", [
    ["circle", { cx: "8", cy: "7", r: "1.8" }],
    ["path", { d: "M9 9l4 4 5 1m-6-2-4 4m7-3 4-6M3 17h18l-3 4H6zM17 10l4 9" }],
  ]),
  svg("target", "Freies Training", "exercise", [
    ["circle", { cx: "12", cy: "12", r: "8" }],
    ["circle", { cx: "12", cy: "12", r: "3" }],
    ["path", { d: "m14 10 6-6m0 0v4m0-4h-4" }],
  ]),
  svg("stretch", "Allgemein", "stretch", [
    ["circle", { cx: "12", cy: "6", r: "1.8" }],
    ["path", { d: "M12 8v7m0-5L6 7m6 3 6-3m-6 8-4 6m4-6 4 6M5 5V2m0 0L3 4m2-2 2 2m12 1V2m0 0-2 2m2-2 2 2" }],
  ]),
  svg("hip-stretch", "Hüfte", "stretch", [
    ["circle", { cx: "12", cy: "4", r: "1.8" }],
    ["path", { d: "M12 6v8m0-5-4 4m4-4 4 4m-4 1-3 7m3-7 3 7M8 12c2 2 6 2 8 0M7 10l-2 2 2 2m10-4 2 2-2 2" }],
  ]),
  svg("hamstring", "Beinrückseite", "stretch", [
    ["circle", { cx: "7", cy: "6", r: "1.8" }],
    ["path", { d: "M8.5 7.5 12 12l8 3m-9-4 7 1m-6 0-4 6H3m9-6-1-5M3 20h19" }],
  ]),
  svg("shoulder-stretch", "Schulter", "stretch", [
    ["circle", { cx: "12", cy: "4", r: "1.8" }],
    ["path", { d: "M12 6v14M5 10h12l3-2m-12 0-3 2 3 2m8-4 2 2-2 2M9 14h6" }],
  ]),
  svg("neck-stretch", "Nacken", "stretch", [
    ["circle", { cx: "13", cy: "6", r: "3" }],
    ["path", { d: "M11 9v3m4-3v3m-4 0c-4 1-6 4-6 8m10-8c4 1 5 4 5 8M9 3H5v4m0 0 3-3m-3 3 3 1" }],
  ]),
  svg("side-stretch", "Seite", "stretch", [
    ["circle", { cx: "12", cy: "5", r: "1.8" }],
    ["path", { d: "M12 7c0 5-2 7-6 9m6-7c4-1 6-3 7-6m-7 11-4 7m4-7 4 7M19 3l1-1m-1 1-2 1" }],
  ]),
  svg("butterfly", "Schmetterling", "stretch", [
    ["circle", { cx: "12", cy: "4", r: "1.8" }],
    ["path", { d: "M12 6v7m0-3-4 4-5 2m9-6 4 4 5 2M8 14l4 5 4-5m-8 5h8" }],
  ]),
  svg("calf-stretch", "Wade", "stretch", [
    ["path", { d: "M21 3v18" }],
    ["circle", { cx: "8", cy: "5", r: "1.8" }],
    ["path", { d: "M9 7l4 6m-2-3 5-3 5 1m-8 5 4 7m-4-7-6 7H3M3 21h18" }],
  ]),
  svg("back-stretch", "Rücken", "stretch", [
    ["circle", { cx: "19", cy: "11", r: "1.8" }],
    ["path", { d: "M17 12c-4-5-9-5-13 0m2-1-2 8m11-7 2 7M4 20h15M7 8c2-3 6-4 9-1m0 0-1-3m1 3-3 1" }],
  ]),
  svg("yoga", "Yoga", "stretch", [
    ["circle", { cx: "12", cy: "4", r: "1.8" }],
    ["path", { d: "M12 6v8m0-5-5 4m5-4 5 4m-5 1-4 5m4-5 4 5M4 20c2-3 6-3 8 0m0 0c2-3 6-3 8 0" }],
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
