export const STORAGE_KEY = "metrack_entries_v1";
export const V2_DATA_KEY = "metrack_data_v2";
export const V3_DATA_KEY = "metrack_data_v3";
export const V4_DATA_KEY = "metrack_data_v4";
export const PREVIOUS_DATA_KEY = "metrack_data_v5";
export const DATA_KEY = "metrack_data_v6";
export const DATA_SCHEMA_VERSION = 6;
export const SETTINGS_KEY = "metrack_settings_v1";
export const BACKUP_VERSION = 6;
export const SET_COUNT = 3;
export const TIMER_MAX_MS = 86_400_000;
export const MAX_BACKUP_ENTRIES = 5000;
export const MAX_INSTRUCTION_LENGTH = 600;
// v3 erlaubte bis zu 30 zusätzliche Übungen. Zusammen mit den drei
// bisherigen Standardübungen müssen daher mindestens 33 migrierbar bleiben.
export const MAX_EXERCISES = 40;
export const MAX_CUSTOM_EXERCISES = MAX_EXERCISES;
export const EXERCISE_METRIC_PREFIX = "exercise:";
export const CUSTOM_METRIC_PREFIX = EXERCISE_METRIC_PREFIX;

export const EXERCISE_TYPES = Object.freeze({
  reps: {
    label: "Wiederholungen",
    shortUnit: "Wdh.",
    csvUnit: "Wiederholungen",
    min: 0,
    max: 10_000,
  },
  seconds: {
    label: "Zeit",
    shortUnit: "Sek.",
    csvUnit: "Sekunden",
    min: 0,
    max: 86_400,
  },
  stretch: {
    label: "Dehnung",
    shortUnit: "",
    csvUnit: "durchgeführt",
    completion: true,
  },
});

export const CUSTOM_EXERCISE_TYPES = EXERCISE_TYPES;

export const DEFAULT_EXERCISES = Object.freeze([
  Object.freeze({
    id: "exercise-plank",
    name: "Plank",
    kind: "seconds",
    icon: "plank",
    active: true,
  }),
  Object.freeze({
    id: "exercise-pushups",
    name: "Liegestütze",
    kind: "reps",
    icon: "push-up",
    active: true,
  }),
  Object.freeze({
    id: "exercise-squats",
    name: "Kniebeugen",
    kind: "reps",
    icon: "squat",
    active: true,
  }),
]);

export const LEGACY_EXERCISE_BY_ID = Object.freeze({
  "exercise-plank": "plank",
  "exercise-pushups": "pushups",
  "exercise-squats": "squats",
});

export const METRICS = Object.freeze({
  plank: {
    label: "Plank",
    shortLabel: "Plank",
    unit: "Sek.",
    csvLabel: "Plank Sekunden",
    decimals: 0,
    min: 0,
    max: 3600,
    direction: "up",
  },
  pushups: {
    label: "Liegestütze",
    shortLabel: "Liegestütze",
    unit: "Wdh.",
    csvLabel: "Liegestuetze",
    decimals: 0,
    min: 0,
    max: 1000,
    direction: "up",
  },
  squats: {
    label: "Kniebeugen",
    shortLabel: "Kniebeugen",
    unit: "Wdh.",
    csvLabel: "Kniebeugen",
    decimals: 0,
    min: 0,
    max: 2000,
    direction: "up",
  },
  weight: {
    label: "Gewicht",
    shortLabel: "Gewicht",
    unit: "kg",
    csvLabel: "Gewicht kg",
    decimals: 1,
    min: 20,
    max: 400,
    direction: "neutral",
  },
  waist: {
    label: "Bauchumfang",
    shortLabel: "Bauch",
    unit: "cm",
    csvLabel: "Bauch cm",
    decimals: 1,
    min: 30,
    max: 300,
    direction: "neutral",
  },
});

export const EXERCISE_KEYS = Object.freeze(["plank", "pushups", "squats"]);
export const BODY_METRIC_KEYS = Object.freeze(["weight", "waist"]);
export const METRIC_KEYS = Object.freeze([
  ...EXERCISE_KEYS,
  ...BODY_METRIC_KEYS,
]);
