import { createExerciseIconSvg } from "../exercise-icons.js";

export function exerciseIconBadge(exercise, className = "exercise-symbol") {
  const badge = document.createElement("span");
  badge.className = className;
  badge.setAttribute("aria-hidden", "true");
  badge.append(createExerciseIconSvg(exercise.icon));
  return badge;
}
