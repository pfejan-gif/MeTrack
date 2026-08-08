import {
  DEFAULT_EXERCISES,
  exerciseMetricKey,
} from "../../assets/core.js";

export const catalog = DEFAULT_EXERCISES.map((exercise) => ({ ...exercise }));
export const [plank, pushups, squats] = catalog;
export const plankMetric = exerciseMetricKey(plank.id);
export const pushupsMetric = exerciseMetricKey(pushups.id);

export const day = (date, values = {}) => ({
  date,
  exerciseSets: [
    values.plank && { exerciseId: plank.id, values: values.plank },
    values.pushups && { exerciseId: pushups.id, values: values.pushups },
    values.squats && { exerciseId: squats.id, values: values.squats },
  ].filter(Boolean),
  weight: values.weight ?? null,
  waist: values.waist ?? null,
});
