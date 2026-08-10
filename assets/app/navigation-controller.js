const VIEW_HASHES = {
  today: "#today",
  analysis: "#analysis",
  history: "#history",
};
const VIEW_ORDER = ["today", "analysis", "history"];
const SWIPE_MIN_DISTANCE = 56;
const SWIPE_FLICK_MIN_DISTANCE = 34;
const SWIPE_FLICK_MAX_DURATION = 260;
const SWIPE_FLICK_MIN_VELOCITY = 0.4;
const SWIPE_MAX_DURATION = 1_000;
const SWIPE_DIRECTION_RATIO = 1.25;
const SWIPE_EDGE_GUARD = 24;
const SWIPE_INTENT_DISTANCE = 10;
const SWIPE_INTENT_RATIO = 1.1;
const SWIPE_VISUAL_FACTOR = 0.34;
const SWIPE_VISUAL_LIMIT = 28;
const SWIPE_EDGE_RESISTANCE = 0.24;
const VIEW_EXIT_DISTANCE = 32;
const VIEW_ENTER_DISTANCE = 40;
export const VIEW_EXIT_TRANSITION_OPTIONS = {
  duration: 120,
  easing: "cubic-bezier(0.4, 0, 1, 1)",
  fill: "forwards",
};
export const VIEW_ENTER_TRANSITION_OPTIONS = {
  duration: 240,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
};
const SWIPE_RESET_TRANSITION_OPTIONS = {
  duration: 170,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
};
const SWIPE_BLOCK_SELECTOR = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "dialog",
  '[contenteditable="true"]',
  ".metric-tabs",
  ".segment-control",
  '[data-view-swipe="ignore"]',
].join(",");

function adjacentView(currentView, deltaX) {
  const index = VIEW_ORDER.indexOf(currentView);
  if (index < 0 || !deltaX) return null;
  return VIEW_ORDER[index + (deltaX < 0 ? 1 : -1)] || null;
}

export function swipeDestination(
  currentView,
  { deltaX = 0, deltaY = 0, duration = 0 } = {},
) {
  const horizontalDistance = Math.abs(deltaX);
  const normalizedDuration = Math.max(0, Number(duration) || 0);
  const isQuickFlick =
    horizontalDistance >= SWIPE_FLICK_MIN_DISTANCE &&
    normalizedDuration > 0 &&
    normalizedDuration <= SWIPE_FLICK_MAX_DURATION &&
    horizontalDistance / normalizedDuration >= SWIPE_FLICK_MIN_VELOCITY;
  if (
    !adjacentView(currentView, deltaX) ||
    (horizontalDistance < SWIPE_MIN_DISTANCE && !isQuickFlick) ||
    horizontalDistance < Math.abs(deltaY) * SWIPE_DIRECTION_RATIO ||
    normalizedDuration > SWIPE_MAX_DURATION
  )
    return null;

  return adjacentView(currentView, deltaX);
}

export function swipeGestureIntent({ deltaX = 0, deltaY = 0 } = {}) {
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);
  if (Math.max(horizontalDistance, verticalDistance) < SWIPE_INTENT_DISTANCE)
    return "pending";
  if (horizontalDistance >= verticalDistance * SWIPE_INTENT_RATIO)
    return "horizontal";
  if (verticalDistance >= horizontalDistance * SWIPE_INTENT_RATIO)
    return "vertical";
  return "pending";
}

export function swipeVisualOffset(currentView, deltaX = 0) {
  if (!Number.isFinite(deltaX) || !deltaX || !VIEW_ORDER.includes(currentView))
    return 0;
  const resistance = adjacentView(currentView, deltaX)
    ? 1
    : SWIPE_EDGE_RESISTANCE;
  const offset = deltaX * SWIPE_VISUAL_FACTOR * resistance;
  return Math.max(-SWIPE_VISUAL_LIMIT, Math.min(SWIPE_VISUAL_LIMIT, offset));
}

function blocksViewSwipe(target) {
  return Boolean(target?.closest?.(SWIPE_BLOCK_SELECTOR));
}

function previewOpacity(offset) {
  const progress = Math.min(Math.abs(offset) / SWIPE_VISUAL_LIMIT, 1);
  return 1 - progress * 0.12;
}

function previewTransform(offset) {
  if (!offset) return "translate3d(0, 0, 0) scale(1)";
  return `translate3d(${offset}px, 0, 0) scale(1)`;
}

export function viewExitKeyframes(direction = 1) {
  const offset = direction < 0 ? VIEW_EXIT_DISTANCE : -VIEW_EXIT_DISTANCE;
  return [
    {
      opacity: 1,
      transform: "translate3d(0, 0, 0) scale(1)",
    },
    {
      opacity: 0,
      transform: `translate3d(${offset}px, 0, 0) scale(0.99)`,
    },
  ];
}

export function viewEnterKeyframes(direction = 1) {
  const offset = direction < 0 ? -VIEW_ENTER_DISTANCE : VIEW_ENTER_DISTANCE;
  return [
    {
      opacity: 0,
      transform: `translate3d(${offset}px, 0, 0) scale(0.99)`,
    },
    {
      opacity: 1,
      transform: "translate3d(0, 0, 0) scale(1)",
    },
  ];
}

export function routeFromHash(hash = "") {
  const normalized = String(hash).toLocaleLowerCase("de-DE");
  if (["#analysis", "#overview", "#progress"].includes(normalized))
    return { view: "analysis", focusEntry: false };
  if (normalized === "#history")
    return { view: "history", focusEntry: false };
  return {
    view: "today",
    focusEntry: normalized === "#entry",
  };
}

export function createNavigationController({
  windowRef = window,
  gestureSurface = null,
  transitionSurface = null,
  sections,
  links,
  entrySection,
  beforeNavigate = () => {},
  onViewChange = () => {},
  now = () => Date.now(),
}) {
  let currentView = null;
  let swipeStart = null;
  let pendingTransitionDirection = 0;
  let viewAnimation = null;
  let transitionGeneration = 0;
  let swipeTransitionActive = false;
  const linkListeners = new Map();
  let previousScrollRestoration = null;

  function scrollPosition() {
    const value = Number(windowRef.scrollY ?? windowRef.pageYOffset ?? 0);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  function preserveScrollPosition(top) {
    windowRef.requestAnimationFrame(() =>
      windowRef.scrollTo({ top, behavior: "auto" }),
    );
  }

  function prefersReducedMotion() {
    return Boolean(
      windowRef.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
    );
  }

  function clearSwipePreview() {
    const style = transitionSurface?.style;
    if (!style) return;
    if (typeof style.removeProperty === "function") {
      style.removeProperty("opacity");
      style.removeProperty("transform");
      style.removeProperty("will-change");
      return;
    }
    style.opacity = "";
    style.transform = "";
    style.willChange = "";
  }

  function cancelViewTransition() {
    transitionGeneration += 1;
    swipeStart = null;
    const animation = viewAnimation;
    viewAnimation = null;
    swipeTransitionActive = false;
    clearSwipePreview();
    animation?.cancel?.();
  }

  function afterAnimation(animation, onFinish, onCancel) {
    if (animation?.finished?.then) {
      animation.finished.then(onFinish, onCancel);
      return;
    }
    if (animation?.addEventListener) {
      animation.addEventListener("finish", onFinish, { once: true });
      animation.addEventListener("cancel", onCancel, { once: true });
      return;
    }
    onFinish();
  }

  function settleViewAnimation(animation, generation) {
    if (
      generation !== transitionGeneration ||
      viewAnimation !== animation
    )
      return;
    viewAnimation = null;
    swipeTransitionActive = false;
  }

  function applySwipePreview(offset) {
    if (prefersReducedMotion()) return;
    const style = transitionSurface?.style;
    if (!style) return;
    style.willChange = "transform, opacity";
    style.transform = previewTransform(offset);
    style.opacity = String(previewOpacity(offset));
  }

  function animateSwipeReset(startOffset) {
    clearSwipePreview();
    if (
      !startOffset ||
      !transitionSurface?.animate ||
      prefersReducedMotion()
    )
      return;

    cancelViewTransition();
    const generation = transitionGeneration;
    swipeTransitionActive = true;
    try {
      viewAnimation = transitionSurface.animate(
        [
          {
            opacity: previewOpacity(startOffset),
            transform: previewTransform(startOffset),
          },
          {
            opacity: 1,
            transform: "translate3d(0, 0, 0) scale(1)",
          },
        ],
        SWIPE_RESET_TRANSITION_OPTIONS,
      );
    } catch {
      viewAnimation = null;
      swipeTransitionActive = false;
      return;
    }
    const resetAnimation = viewAnimation;
    afterAnimation(
      resetAnimation,
      () => settleViewAnimation(resetAnimation, generation),
      () => settleViewAnimation(resetAnimation, generation),
    );
  }

  function animateIncomingView(direction) {
    const outgoingAnimation = viewAnimation;
    const generation = transitionGeneration;
    if (!transitionSurface?.animate || prefersReducedMotion()) {
      cancelViewTransition();
      return;
    }
    try {
      viewAnimation = transitionSurface.animate(
        viewEnterKeyframes(direction),
        VIEW_ENTER_TRANSITION_OPTIONS,
      );
      outgoingAnimation?.cancel?.();
      const incomingAnimation = viewAnimation;
      afterAnimation(
        incomingAnimation,
        () => settleViewAnimation(incomingAnimation, generation),
        () => {},
      );
    } catch {
      outgoingAnimation?.cancel?.();
      cancelViewTransition();
    }
  }

  function transitionToView(destination, direction, startOffset = 0) {
    if (!transitionSurface?.animate || prefersReducedMotion()) {
      clearSwipePreview();
      navigate(destination, { transitionDirection: direction });
      return;
    }

    const keyframes = viewExitKeyframes(direction);
    if (startOffset) {
      keyframes[0] = {
        opacity: previewOpacity(startOffset),
        transform: previewTransform(startOffset),
      };
    }
    cancelViewTransition();
    const generation = transitionGeneration;
    swipeTransitionActive = true;
    try {
      viewAnimation = transitionSurface.animate(
        keyframes,
        VIEW_EXIT_TRANSITION_OPTIONS,
      );
    } catch {
      viewAnimation = null;
      swipeTransitionActive = false;
      navigate(destination, { transitionDirection: direction });
      return;
    }

    const outgoingAnimation = viewAnimation;
    afterAnimation(
      outgoingAnimation,
      () => {
        if (
          generation !== transitionGeneration ||
          viewAnimation !== outgoingAnimation
        )
          return;
        if (routeFromHash(windowRef.location.hash).view !== currentView) {
          cancelViewTransition();
          return;
        }
        navigate(destination, { transitionDirection: direction });
      },
      () => {},
    );
  }

  function applyRoute({ initial = false } = {}) {
    const transitionDirection = pendingTransitionDirection;
    pendingTransitionDirection = 0;
    const route = routeFromHash(windowRef.location.hash);
    const previousScroll = scrollPosition();
    const changed = currentView !== route.view;
    if (!initial && currentView && route.view !== currentView)
      beforeNavigate(currentView, route.view);

    for (const section of sections)
      section.hidden = section.dataset.appView !== route.view;
    for (const link of links) {
      if (link.dataset.viewLink === route.view)
        link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }

    currentView = route.view;
    onViewChange(route.view, { changed, initial });
    if (route.focusEntry)
      windowRef.requestAnimationFrame(() =>
        entrySection?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    else if (!initial && changed)
      preserveScrollPosition(previousScroll);
    if (!initial && changed && transitionDirection)
      animateIncomingView(transitionDirection);
    else if (!initial && changed)
      cancelViewTransition();
    return route.view;
  }

  function navigate(
    view,
    { entry = false, replace = false, transitionDirection = 0 } = {},
  ) {
    if (!transitionDirection) cancelViewTransition();
    const hash = entry ? "#entry" : VIEW_HASHES[view] || VIEW_HASHES.today;
    if (windowRef.location.hash === hash) return applyRoute();
    pendingTransitionDirection = transitionDirection;
    if (replace) {
      windowRef.history.replaceState(null, "", hash);
      return applyRoute();
    }
    if (windowRef.history.pushState) {
      windowRef.history.pushState(null, "", hash);
      return applyRoute();
    }
    windowRef.location.hash = hash;
    return view;
  }

  function handleViewLink(link, event) {
    if (
      event.defaultPrevented ||
      (Number.isFinite(event.button) && event.button !== 0) ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    navigate(link.dataset.viewLink);
  }

  function touchByIdentifier(touches, identifier) {
    return Array.from(touches || []).find(
      (item) => item.identifier === identifier,
    );
  }

  function handleTouchStart(event) {
    if (
      swipeTransitionActive ||
      event.touches?.length !== 1 ||
      blocksViewSwipe(event.target)
    ) {
      swipeStart = null;
      return;
    }
    const touch = event.touches[0];
    const viewportWidth = Number(windowRef.innerWidth);
    if (
      touch.clientX <= SWIPE_EDGE_GUARD ||
      (Number.isFinite(viewportWidth) &&
        touch.clientX >= viewportWidth - SWIPE_EDGE_GUARD)
    ) {
      swipeStart = null;
      return;
    }
    swipeStart = {
      identifier: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
      time: now(),
      intent: "pending",
      visualOffset: 0,
    };
  }

  function handleTouchMove(event) {
    const start = swipeStart;
    if (!start) return;
    if (event.touches?.length !== 1) {
      swipeStart = null;
      animateSwipeReset(start.visualOffset);
      return;
    }
    const touch = touchByIdentifier(event.touches, start.identifier);
    if (!touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (start.intent !== "horizontal") {
      const intent = swipeGestureIntent({ deltaX, deltaY });
      if (intent === "vertical") {
        swipeStart = null;
        clearSwipePreview();
        return;
      }
      if (intent !== "horizontal") return;
      start.intent = "horizontal";
    }

    event.preventDefault?.();
    start.visualOffset = swipeVisualOffset(currentView, deltaX);
    applySwipePreview(start.visualOffset);
  }

  function handleTouchEnd(event) {
    const start = swipeStart;
    swipeStart = null;
    if (!start) return;
    const touch = touchByIdentifier(event.changedTouches, start.identifier);
    if (!touch) {
      animateSwipeReset(start.visualOffset);
      return;
    }
    const deltaX = touch.clientX - start.x;
    const destination = swipeDestination(currentView, {
      deltaX,
      deltaY: touch.clientY - start.y,
      duration: now() - start.time,
    });
    if (destination) {
      transitionToView(
        destination,
        deltaX < 0 ? 1 : -1,
        start.visualOffset,
      );
      return;
    }
    animateSwipeReset(start.visualOffset);
  }

  function cancelTouchGesture() {
    const start = swipeStart;
    swipeStart = null;
    if (start) animateSwipeReset(start.visualOffset);
  }

  function initialize() {
    if ("scrollRestoration" in windowRef.history) {
      previousScrollRestoration = windowRef.history.scrollRestoration;
      windowRef.history.scrollRestoration = "manual";
    }
    const view = applyRoute({ initial: true });
    windowRef.addEventListener("hashchange", applyRoute);
    windowRef.addEventListener("popstate", applyRoute);
    for (const link of links) {
      const listener = (event) => handleViewLink(link, event);
      linkListeners.set(link, listener);
      link.addEventListener?.("click", listener);
    }
    gestureSurface?.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    gestureSurface?.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    gestureSurface?.addEventListener("touchend", handleTouchEnd, {
      passive: true,
    });
    gestureSurface?.addEventListener("touchcancel", cancelTouchGesture, {
      passive: true,
    });
    return view;
  }

  function destroy() {
    windowRef.removeEventListener("hashchange", applyRoute);
    windowRef.removeEventListener("popstate", applyRoute);
    for (const [link, listener] of linkListeners)
      link.removeEventListener?.("click", listener);
    linkListeners.clear();
    if (previousScrollRestoration !== null)
      windowRef.history.scrollRestoration = previousScrollRestoration;
    gestureSurface?.removeEventListener("touchstart", handleTouchStart);
    gestureSurface?.removeEventListener("touchmove", handleTouchMove);
    gestureSurface?.removeEventListener("touchend", handleTouchEnd);
    gestureSurface?.removeEventListener("touchcancel", cancelTouchGesture);
    cancelViewTransition();
  }

  return {
    applyRoute,
    destroy,
    initialize,
    navigate,
    get currentView() {
      return currentView;
    },
  };
}
