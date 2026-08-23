const ICON_BASE_PATH = "./assets/icons/exercises";

const icon = (id, label, ...groups) =>
  Object.freeze({
    id,
    label,
    group: groups[0],
    groups: Object.freeze(groups),
    src: `${ICON_BASE_PATH}/${id}.webp`,
  });

export const EXERCISE_ICONS = Object.freeze([
  icon("activity", "Allgemeines Training", "exercise", "training"),
  icon("plank", "Plank", "exercise"),
  icon("push-up", "Liegestütz", "exercise"),
  icon("squat", "Kniebeuge", "exercise"),
  icon("pistol-squat", "Einbeinige Kniebeuge", "exercise"),
  icon("sit-up", "Sit-up", "exercise"),
  icon("dumbbell", "Hantel", "exercise", "training"),
  icon("kettlebell", "Kettlebell", "exercise", "training"),
  icon("running", "Laufen", "exercise", "training"),
  icon("cycling", "Radfahren", "exercise", "training"),
  icon("pull-up", "Klimmzug", "exercise"),
  icon("lunge", "Ausfallschritt", "exercise"),
  icon("jump-rope", "Seilspringen", "exercise", "training"),
  icon("rowing", "Rudern", "exercise", "training"),
  icon("target", "Freies Training", "exercise", "training"),
  icon("burpee", "Burpee", "exercise"),
  icon("jumping-jack", "Hampelmann", "exercise"),
  icon("mountain-climber", "Mountain-Climber", "exercise"),
  icon("stretch", "Allgemeine Dehnung", "stretch"),
  icon("hip-stretch", "Hüftbeuger", "stretch"),
  icon("hamstring", "Beinrückseite", "stretch"),
  icon("standing-forward-fold", "Vorbeuge im Stehen", "stretch"),
  icon("shoulder-stretch", "Schulter", "stretch"),
  icon("neck-stretch", "Nacken", "stretch"),
  icon("side-stretch", "Rumpfseite", "stretch"),
  icon("butterfly", "Schmetterling", "stretch"),
  icon("calf-stretch", "Wade", "stretch"),
  icon("back-stretch", "Rücken", "stretch"),
  icon("yoga", "Yoga", "stretch", "training"),
  icon("quadriceps-stretch", "Oberschenkelvorderseite", "stretch"),
  icon("chest-stretch", "Brust", "stretch"),
  icon("wrist-stretch", "Handgelenk & Unterarm", "stretch"),
  icon("bouldering", "Bouldern", "training"),
  icon("swimming", "Schwimmen", "training"),
]);

const ICON_BY_ID = new Map(EXERCISE_ICONS.map((definition) => [definition.id, definition]));

function iconGroupForKind(kind) {
  if (kind === "stretch") return "stretch";
  if (kind === "training") return "training";
  if (kind === "reps" || kind === "seconds") return "exercise";
  return null;
}

export function iconOptionsForKind(kind) {
  const group = iconGroupForKind(kind);
  return group
    ? EXERCISE_ICONS.filter((definition) => definition.groups.includes(group))
    : [];
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
  const group = iconGroupForKind(kind);
  return Boolean(definition && group && definition.groups.includes(group));
}

export function exerciseIconDefinition(iconId) {
  return ICON_BY_ID.get(String(iconId || "")) || ICON_BY_ID.get("activity");
}

export function exerciseIconSource(iconId) {
  return exerciseIconDefinition(iconId).src;
}

export function createExerciseIconImage(iconId) {
  const definition = exerciseIconDefinition(iconId);
  const image = document.createElement("img");
  image.className = "exercise-icon-image";
  image.src = definition.src;
  image.dataset.exerciseIcon = definition.id;
  image.alt = "";
  image.width = 256;
  image.height = 256;
  image.decoding = "async";
  image.draggable = false;
  image.setAttribute("aria-hidden", "true");
  return image;
}
