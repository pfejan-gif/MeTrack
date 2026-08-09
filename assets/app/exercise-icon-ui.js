import { createExerciseIconImage } from "../exercise-icons.js";

export function exerciseIconBadge(exercise, className = "exercise-symbol") {
  const badge = document.createElement("span");
  badge.className = className;
  badge.setAttribute("aria-hidden", "true");
  badge.append(createExerciseIconImage(exercise.icon));
  return badge;
}
