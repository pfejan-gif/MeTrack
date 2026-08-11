const DEFAULT_LONG_PRESS_MS = 300;
const MOVE_TOLERANCE = 10;
const EDGE_SCROLL_ZONE = 72;
const MAX_SCROLL_STEP = 12;
const ITEM_SELECTOR = "[data-exercise-id]";
const REORDERABLE_SELECTOR = '[data-exercise-reorder="true"]';
const INTERACTIVE_SELECTOR =
  "button, a, input, select, textarea, label, summary, [contenteditable='true']";

export function moveExerciseId(orderedIds, exerciseId, targetIndex) {
  const ids = [...orderedIds];
  const currentIndex = ids.indexOf(exerciseId);
  if (currentIndex < 0 || ids.length < 2) return ids;
  const numericTarget = Number(targetIndex);
  if (!Number.isFinite(numericTarget)) return ids;
  const boundedTarget = Math.max(
    0,
    Math.min(ids.length - 1, numericTarget),
  );
  if (currentIndex === boundedTarget) return ids;
  ids.splice(currentIndex, 1);
  ids.splice(boundedTarget, 0, exerciseId);
  return ids;
}

export function insertionIndexForPointer(midpoints, clientY) {
  const numericY = Number(clientY);
  if (!Array.isArray(midpoints) || !Number.isFinite(numericY))
    return Array.isArray(midpoints) ? midpoints.length : 0;
  const index = midpoints.findIndex(
    (midpoint) => Number.isFinite(midpoint) && numericY < midpoint,
  );
  return index < 0 ? midpoints.length : index;
}

export function createExerciseReorderController({
  list,
  scrollContainer,
  statusElement,
  onReorder,
  documentRef = document,
  windowRef = window,
  longPressMs = DEFAULT_LONG_PRESS_MS,
}) {
  let gesture = null;
  let autoScrollFrame = null;
  let suppressClickUntil = 0;

  const items = () => [...list.querySelectorAll(ITEM_SELECTOR)];
  const orderedIds = () =>
    items().map((item) => item.dataset.exerciseId);

  function announce(message) {
    if (statusElement) statusElement.textContent = message;
  }

  function restoreOrder(ids) {
    const itemsById = new Map(
      items().map((item) => [item.dataset.exerciseId, item]),
    );
    for (const id of ids) {
      const item = itemsById.get(id);
      if (item) list.append(item);
    }
  }

  function createPlaceholder(current) {
    const bounds = current.item.getBoundingClientRect();
    const placeholder = documentRef.createElement("div");
    placeholder.className = "exercise-reorder-placeholder";
    placeholder.style.height = `${bounds.height}px`;
    placeholder.setAttribute("aria-hidden", "true");
    list.insertBefore(placeholder, current.item);
    current.placeholder = placeholder;
    current.item.style.position = "fixed";
    current.item.style.top = `${bounds.top}px`;
    current.item.style.left = `${bounds.left}px`;
    current.item.style.width = `${bounds.width}px`;
    current.item.style.height = `${bounds.height}px`;
    current.item.style.margin = "0";
    current.item.style.setProperty("--exercise-reorder-translate-y", "0px");
  }

  function resetFloatingItem(current) {
    current.item.style.removeProperty("position");
    current.item.style.removeProperty("top");
    current.item.style.removeProperty("left");
    current.item.style.removeProperty("width");
    current.item.style.removeProperty("height");
    current.item.style.removeProperty("margin");
    current.item.style.removeProperty("--exercise-reorder-translate-y");
  }

  function updateFloatingItem(clientY) {
    if (!gesture?.active) return;
    const translateY = clientY - gesture.startY;
    gesture.item.style.setProperty(
      "--exercise-reorder-translate-y",
      `${translateY}px`,
    );
  }

  function placePlaceholder(clientY) {
    if (!gesture?.active || !gesture.placeholder) return;
    const siblings = items().filter((item) => item !== gesture.item);
    const midpoints = siblings.map((item) => {
      const bounds = item.getBoundingClientRect();
      return bounds.top + bounds.height / 2;
    });
    const targetIndex = insertionIndexForPointer(midpoints, clientY);
    const before = siblings[targetIndex];
    if (before) list.insertBefore(gesture.placeholder, before);
    else list.append(gesture.placeholder);
  }

  function settleAtPlaceholder(current) {
    if (!current.placeholder?.parentNode) return;
    list.insertBefore(current.item, current.placeholder);
    current.placeholder.remove();
    current.placeholder = null;
    resetFloatingItem(current);
  }

  function scrollBounds() {
    const bounds = scrollContainer.getBoundingClientRect();
    return {
      top: Math.max(0, bounds.top),
      bottom: Math.min(windowRef.innerHeight, bounds.bottom),
    };
  }

  function scrollStep(clientY) {
    const bounds = scrollBounds();
    if (clientY < bounds.top + EDGE_SCROLL_ZONE) {
      return -Math.min(
        MAX_SCROLL_STEP,
        Math.ceil((bounds.top + EDGE_SCROLL_ZONE - clientY) / 6),
      );
    }
    if (clientY > bounds.bottom - EDGE_SCROLL_ZONE) {
      return Math.min(
        MAX_SCROLL_STEP,
        Math.ceil((clientY - (bounds.bottom - EDGE_SCROLL_ZONE)) / 6),
      );
    }
    return 0;
  }

  function keepPageStill() {
    if (!gesture?.active || !windowRef.scrollTo) return;
    if (
      windowRef.scrollX !== gesture.pageScrollX ||
      windowRef.scrollY !== gesture.pageScrollY
    ) {
      windowRef.scrollTo(gesture.pageScrollX, gesture.pageScrollY);
    }
  }

  function autoScroll() {
    if (!gesture?.active) return;
    keepPageStill();
    const step = scrollStep(gesture.clientY);
    if (step) {
      scrollContainer.scrollTop += step;
      placePlaceholder(gesture.clientY);
    }
    autoScrollFrame = windowRef.requestAnimationFrame(autoScroll);
  }

  function activateGesture() {
    if (!gesture) return;
    gesture.active = true;
    gesture.pageScrollX = windowRef.scrollX;
    gesture.pageScrollY = windowRef.scrollY;
    gesture.item.classList.remove("is-holding");
    createPlaceholder(gesture);
    gesture.item.classList.add("is-reordering");
    list.classList.add("is-reordering");
    scrollContainer.classList.add("exercise-reorder-scroll-lock");
    documentRef.documentElement.classList.add("exercise-reordering-active");
    documentRef.body.classList.add("exercise-reordering-active");
    windowRef.getSelection?.()?.removeAllRanges();
    announce(
      `${gesture.name} wird verschoben. Nach oben oder unten ziehen und loslassen.`,
    );
    autoScrollFrame = windowRef.requestAnimationFrame(autoScroll);
  }

  function clearGesture({ restore = false } = {}) {
    if (!gesture) return null;
    const current = gesture;
    windowRef.clearTimeout(current.longPressTimer);
    if (autoScrollFrame !== null)
      windowRef.cancelAnimationFrame(autoScrollFrame);
    autoScrollFrame = null;
    current.placeholder?.remove();
    current.placeholder = null;
    if (current.active) resetFloatingItem(current);
    if (restore) restoreOrder(current.originalOrder);
    current.item.classList.remove("is-holding", "is-reordering");
    list.classList.remove("is-reordering");
    scrollContainer.classList.remove("exercise-reorder-scroll-lock");
    documentRef.documentElement.classList.remove("exercise-reordering-active");
    documentRef.body.classList.remove("exercise-reordering-active");
    if (current.item.hasPointerCapture?.(current.pointerId))
      current.item.releasePointerCapture(current.pointerId);
    gesture = null;
    return current;
  }

  function findItem(exerciseId) {
    return items().find((item) => item.dataset.exerciseId === exerciseId);
  }

  function markSettled(exerciseId, focus = false) {
    windowRef.requestAnimationFrame(() => {
      const item = findItem(exerciseId);
      if (!item) return;
      item.classList.add("is-reorder-settled");
      if (focus) item.focus();
      windowRef.setTimeout(
        () => item.classList.remove("is-reorder-settled"),
        650,
      );
    });
  }

  function commitOrder(nextOrder, current) {
    const changed = nextOrder.some(
      (id, index) => id !== current.originalOrder[index],
    );
    if (!changed) {
      announce(`${current.name} bleibt an seiner Position.`);
      markSettled(current.exerciseId, current.keyboard);
      return;
    }
    const saved = onReorder(nextOrder);
    if (saved === false) {
      restoreOrder(current.originalOrder);
      announce("Die neue Reihenfolge konnte nicht gespeichert werden.");
      markSettled(current.exerciseId, current.keyboard);
    } else {
      const position = nextOrder.indexOf(current.exerciseId) + 1;
      announce(
        `${current.name} ist jetzt an Position ${position} von ${nextOrder.length}.`,
      );
      markSettled(current.exerciseId, current.keyboard);
    }
  }

  function onPointerDown(event) {
    const item = event.target.closest?.(REORDERABLE_SELECTOR);
    if (
      !item ||
      item.parentElement !== list ||
      event.target.closest?.(INTERACTIVE_SELECTOR) ||
      event.button !== 0 ||
      event.isPrimary === false ||
      gesture
    ) {
      return;
    }
    gesture = {
      pointerId: event.pointerId,
      item,
      exerciseId: item.dataset.exerciseId,
      name: item.dataset.exerciseName || "Trainingseintrag",
      startX: event.clientX,
      startY: event.clientY,
      clientY: event.clientY,
      active: false,
      keyboard: false,
      placeholder: null,
      originalOrder: orderedIds(),
      longPressTimer: windowRef.setTimeout(activateGesture, longPressMs),
    };
    item.classList.add("is-holding");
    item.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    gesture.clientY = event.clientY;
    if (!gesture.active) {
      const distance = Math.hypot(
        event.clientX - gesture.startX,
        event.clientY - gesture.startY,
      );
      if (distance > MOVE_TOLERANCE) clearGesture();
      return;
    }
    if (event.cancelable) event.preventDefault();
    keepPageStill();
    updateFloatingItem(event.clientY);
    placePlaceholder(event.clientY);
  }

  function onPointerUp(event) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const wasActive = gesture.active;
    if (wasActive) settleAtPlaceholder(gesture);
    const nextOrder = wasActive ? orderedIds() : null;
    const current = clearGesture();
    if (!wasActive) return;
    if (event.cancelable) event.preventDefault();
    suppressClickUntil = Date.now() + 500;
    commitOrder(nextOrder, current);
  }

  function onPointerCancel(event) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const name = gesture.name;
    const wasActive = gesture.active;
    clearGesture({ restore: true });
    if (wasActive) announce(`${name} wurde nicht verschoben.`);
  }

  function onKeyDown(event) {
    if (gesture?.active && event.key === "Escape") {
      event.preventDefault();
      const name = gesture.name;
      clearGesture({ restore: true });
      announce(`${name} wurde nicht verschoben.`);
      return;
    }
    const item = event.target.closest?.(REORDERABLE_SELECTOR);
    if (!item || event.target !== item) return;
    const currentOrder = orderedIds();
    const currentIndex = currentOrder.indexOf(item.dataset.exerciseId);
    const destinations = {
      ArrowUp: currentIndex - 1,
      ArrowDown: currentIndex + 1,
      Home: 0,
      End: currentOrder.length - 1,
    };
    if (!(event.key in destinations)) return;
    event.preventDefault();
    const nextOrder = moveExerciseId(
      currentOrder,
      item.dataset.exerciseId,
      destinations[event.key],
    );
    restoreOrder(nextOrder);
    commitOrder(nextOrder, {
      exerciseId: item.dataset.exerciseId,
      name: item.dataset.exerciseName || "Trainingseintrag",
      originalOrder: currentOrder,
      keyboard: true,
    });
  }

  function preventNativeScroll(event) {
    if (!gesture?.active || !event.cancelable) return;
    event.preventDefault();
  }

  list.addEventListener("pointerdown", onPointerDown);
  list.addEventListener("pointermove", onPointerMove);
  list.addEventListener("pointerup", onPointerUp);
  list.addEventListener("pointercancel", onPointerCancel);
  list.addEventListener("keydown", onKeyDown);
  list.addEventListener("dragstart", (event) => event.preventDefault());
  list.addEventListener("contextmenu", (event) => {
    const item = event.target.closest?.(REORDERABLE_SELECTOR);
    if (item && !event.target.closest?.(INTERACTIVE_SELECTOR))
      event.preventDefault();
  });
  documentRef.addEventListener("touchmove", preventNativeScroll, {
    passive: false,
    capture: true,
  });
  documentRef.addEventListener("wheel", preventNativeScroll, {
    passive: false,
    capture: true,
  });
  list.addEventListener(
    "click",
    (event) => {
      if (Date.now() >= suppressClickUntil) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );

  return {
    cancel() {
      clearGesture({ restore: true });
    },
  };
}
