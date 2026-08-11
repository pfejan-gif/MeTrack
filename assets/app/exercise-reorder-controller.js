const DEFAULT_LONG_PRESS_MS = 300;
const MOVE_TOLERANCE = 10;
const EDGE_SCROLL_ZONE = 72;
const MAX_SCROLL_STEP = 12;
const ITEM_SELECTOR = "[data-exercise-id]";
const HANDLE_SELECTOR = "[data-exercise-reorder]";

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

  function placeDraggedItem(clientY) {
    if (!gesture?.active) return;
    const siblings = items().filter((item) => item !== gesture.item);
    const before = siblings.find((item) => {
      const bounds = item.getBoundingClientRect();
      return clientY < bounds.top + bounds.height / 2;
    });
    if (before) list.insertBefore(gesture.item, before);
    else list.append(gesture.item);
  }

  function scrollBounds() {
    if (scrollContainer?.getBoundingClientRect) {
      const bounds = scrollContainer.getBoundingClientRect();
      return {
        top: Math.max(0, bounds.top),
        bottom: Math.min(windowRef.innerHeight, bounds.bottom),
      };
    }
    return { top: 0, bottom: windowRef.innerHeight };
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

  function autoScroll() {
    if (!gesture?.active) return;
    const step = scrollStep(gesture.clientY);
    if (step) {
      if (scrollContainer?.scrollTop !== undefined)
        scrollContainer.scrollTop += step;
      else windowRef.scrollBy(0, step);
      placeDraggedItem(gesture.clientY);
    }
    autoScrollFrame = windowRef.requestAnimationFrame(autoScroll);
  }

  function activateGesture() {
    if (!gesture) return;
    gesture.active = true;
    gesture.handle.classList.remove("is-holding");
    gesture.handle.setAttribute("aria-pressed", "true");
    gesture.item.classList.add("is-reordering");
    list.classList.add("is-reordering");
    documentRef.body.classList.add("exercise-reordering-active");
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
    if (restore) restoreOrder(current.originalOrder);
    current.handle.classList.remove("is-holding");
    current.handle.setAttribute("aria-pressed", "false");
    current.item.classList.remove("is-reordering");
    list.classList.remove("is-reordering");
    documentRef.body.classList.remove("exercise-reordering-active");
    if (current.handle.hasPointerCapture?.(current.pointerId))
      current.handle.releasePointerCapture(current.pointerId);
    gesture = null;
    return current;
  }

  function focusHandle(exerciseId) {
    windowRef.requestAnimationFrame(() => {
      const handle = items()
        .find((item) => item.dataset.exerciseId === exerciseId)
        ?.querySelector(HANDLE_SELECTOR);
      handle?.focus();
    });
  }

  function commitOrder(nextOrder, current) {
    const changed = nextOrder.some(
      (id, index) => id !== current.originalOrder[index],
    );
    if (!changed) {
      announce(`${current.name} bleibt an seiner Position.`);
      focusHandle(current.exerciseId);
      return;
    }
    const saved = onReorder(nextOrder);
    if (saved === false) {
      restoreOrder(current.originalOrder);
      announce("Die neue Reihenfolge konnte nicht gespeichert werden.");
    } else {
      const position = nextOrder.indexOf(current.exerciseId) + 1;
      announce(
        `${current.name} ist jetzt an Position ${position} von ${nextOrder.length}.`,
      );
    }
    focusHandle(current.exerciseId);
  }

  function onPointerDown(event) {
    const handle = event.target.closest?.(HANDLE_SELECTOR);
    if (!handle || handle.disabled || event.button !== 0 || gesture) return;
    const item = handle.closest(ITEM_SELECTOR);
    if (!item) return;
    const exerciseId = item.dataset.exerciseId;
    gesture = {
      pointerId: event.pointerId,
      handle,
      item,
      exerciseId,
      name: item.dataset.exerciseName || "Trainingseintrag",
      startX: event.clientX,
      startY: event.clientY,
      clientY: event.clientY,
      active: false,
      originalOrder: orderedIds(),
      longPressTimer: windowRef.setTimeout(activateGesture, longPressMs),
    };
    handle.classList.add("is-holding");
    handle.setPointerCapture?.(event.pointerId);
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
    event.preventDefault();
    placeDraggedItem(event.clientY);
  }

  function onPointerUp(event) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const wasActive = gesture.active;
    const nextOrder = wasActive ? orderedIds() : null;
    const current = clearGesture();
    if (!wasActive) return;
    event.preventDefault();
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
    const handle = event.target.closest?.(HANDLE_SELECTOR);
    if (!handle || handle.disabled) return;
    const item = handle.closest(ITEM_SELECTOR);
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
    });
  }

  list.addEventListener("pointerdown", onPointerDown);
  list.addEventListener("pointermove", onPointerMove);
  list.addEventListener("pointerup", onPointerUp);
  list.addEventListener("pointercancel", onPointerCancel);
  list.addEventListener("keydown", onKeyDown);
  list.addEventListener("contextmenu", (event) => {
    if (event.target.closest?.(HANDLE_SELECTOR)) event.preventDefault();
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
