const ICON_BASE_PATH = "./assets/icons/exercises";

const icon = (id, label, group) =>
  Object.freeze({
    id,
    label,
    group,
    src: `${ICON_BASE_PATH}/${id}.webp`,
  });

export const EXERCISE_ICONS = Object.freeze([
  icon("activity", "Allgemeines Training", "exercise"),
  icon("plank", "Plank", "exercise"),
  icon("push-up", "Liegestütz", "exercise"),
  icon("squat", "Kniebeuge", "exercise"),
  icon("sit-up", "Sit-up", "exercise"),
  icon("dumbbell", "Hantel", "exercise"),
  icon("kettlebell", "Kettlebell", "exercise"),
  icon("running", "Laufen", "exercise"),
  icon("cycling", "Radfahren", "exercise"),
  icon("pull-up", "Klimmzug", "exercise"),
  icon("lunge", "Ausfallschritt", "exercise"),
  icon("jump-rope", "Seilspringen", "exercise"),
  icon("rowing", "Rudern", "exercise"),
  icon("target", "Freies Training", "exercise"),
  icon("burpee", "Burpee", "exercise"),
  icon("jumping-jack", "Hampelmann", "exercise"),
  icon("mountain-climber", "Mountain-Climber", "exercise"),
  icon("stretch", "Allgemeine Dehnung", "stretch"),
  icon("hip-stretch", "Hüftbeuger", "stretch"),
  icon("hamstring", "Beinrückseite", "stretch"),
  icon("shoulder-stretch", "Schulter", "stretch"),
  icon("neck-stretch", "Nacken", "stretch"),
  icon("side-stretch", "Rumpfseite", "stretch"),
  icon("butterfly", "Schmetterling", "stretch"),
  icon("calf-stretch", "Wade", "stretch"),
  icon("back-stretch", "Rücken", "stretch"),
  icon("yoga", "Yoga", "stretch"),
  icon("quadriceps-stretch", "Oberschenkelvorderseite", "stretch"),
  icon("chest-stretch", "Brust", "stretch"),
  icon("wrist-stretch", "Handgelenk & Unterarm", "stretch"),
]);

const ICON_BY_ID = new Map(EXERCISE_ICONS.map((definition) => [definition.id, definition]));

export function iconOptionsForKind(kind) {
  const group = kind === "stretch" ? "stretch" : "exercise";
  return EXERCISE_ICONS.filter((definition) => definition.group === group);
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
  const definition = ICON_BY_ID.get(String(iconId || ""));
  return Boolean(
    definition && definition.group === (kind === "stretch" ? "stretch" : "exercise"),
  );
}

export function exerciseIconDefinition(iconId) {
  return ICON_BY_ID.get(String(iconId || "")) || ICON_BY_ID.get("activity");
}

export function exerciseIconSource(iconId) {
  return exerciseIconDefinition(iconId).src;
}

export function createExerciseIconImage(iconId) {
  const image = document.createElement("img");
  image.className = "exercise-icon-image";
  image.src = exerciseIconSource(iconId);
  image.alt = "";
  image.width = 256;
  image.height = 256;
  image.decoding = "async";
  image.draggable = false;
  image.setAttribute("aria-hidden", "true");
  return image;
}
