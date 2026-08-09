const VIEW_HASHES = {
  today: "#today",
  analysis: "#analysis",
  history: "#history",
};
const VIEW_ORDER = ["today", "analysis", "history"];
const SWIPE_MIN_DISTANCE = 56;
const SWIPE_MAX_DURATION = 1_000;
const SWIPE_DIRECTION_RATIO = 1.25;
const SWIPE_EDGE_GUARD = 24;
const VIEW_TRANSITION_DISTANCE = 28;
const VIEW_TRANSITION_OPTIONS = {
  duration: 380,
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

export function swipeDestination(
  currentView,
  { deltaX = 0, deltaY = 0, duration = 0 } = {},
) {
  const index = VIEW_ORDER.indexOf(currentView);
  const horizontalDistance = Math.abs(deltaX);
  if (
    index < 0 ||
    horizontalDistance < SWIPE_MIN_DISTANCE ||
    horizontalDistance < Math.abs(deltaY) * SWIPE_DIRECTION_RATIO ||
    duration > SWIPE_MAX_DURATION
  )
    return null;

  const nextIndex = index + (deltaX < 0 ? 1 : -1);
  return VIEW_ORDER[nextIndex] || null;
}

function blocksViewSwipe(target) {
  return Boolean(target?.closest?.(SWIPE_BLOCK_SELECTOR));
}

export function viewTransitionKeyframes(direction = 1) {
  const offset = direction < 0
    ? -VIEW_TRANSITION_DISTANCE
    : VIEW_TRANSITION_DISTANCE;
  return [
    {
      opacity: 0.66,
      transform: `translate3d(${offset}px, 0, 0) scale(0.992)`,
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

  function animateViewTransition(direction) {
    viewAnimation?.cancel?.();
    viewAnimation = null;
    if (
      !transitionSurface?.animate ||
      windowRef.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    )
      return;
    try {
      viewAnimation = transitionSurface.animate(
        viewTransitionKeyframes(direction),
        VIEW_TRANSITION_OPTIONS,
      );
    } catch {
      viewAnimation = null;
    }
  }

  function applyRoute({ initial = false } = {}) {
    const transitionDirection = pendingTransitionDirection;
    pendingTransitionDirection = 0;
    const route = routeFromHash(windowRef.location.hash);
    if (!initial && currentView && route.view !== currentView)
      beforeNavigate(currentView, route.view);

    for (const section of sections)
      section.hidden = section.dataset.appView !== route.view;
    for (const link of links) {
      if (link.dataset.viewLink === route.view)
        link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }

    const changed = currentView !== route.view;
    currentView = route.view;
    onViewChange(route.view, { changed, initial });
    if (route.focusEntry)
      windowRef.requestAnimationFrame(() =>
        entrySection?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    else if (!initial && changed)
      windowRef.scrollTo({ top: 0, behavior: "auto" });
    if (!initial && changed && transitionDirection)
      animateViewTransition(transitionDirection);
    return route.view;
  }

  function navigate(
    view,
    { entry = false, replace = false, transitionDirection = 0 } = {},
  ) {
    const hash = entry ? "#entry" : VIEW_HASHES[view] || VIEW_HASHES.today;
    if (windowRef.location.hash === hash) return applyRoute();
    pendingTransitionDirection = transitionDirection;
    if (replace) {
      windowRef.history.replaceState(null, "", hash);
      return applyRoute();
    }
    windowRef.location.hash = hash;
    return view;
  }

  function handleTouchStart(event) {
    if (event.touches?.length !== 1 || blocksViewSwipe(event.target)) {
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
    };
  }

  function handleTouchEnd(event) {
    const start = swipeStart;
    swipeStart = null;
    if (!start) return;
    const touch = Array.from(event.changedTouches || []).find(
      (item) => item.identifier === start.identifier,
    );
    if (!touch) return;
    const deltaX = touch.clientX - start.x;
    const destination = swipeDestination(currentView, {
      deltaX,
      deltaY: touch.clientY - start.y,
      duration: now() - start.time,
    });
    if (destination)
      navigate(destination, { transitionDirection: deltaX < 0 ? 1 : -1 });
  }

  function cancelTouchGesture() {
    swipeStart = null;
  }

  function initialize() {
    const view = applyRoute({ initial: true });
    windowRef.addEventListener("hashchange", applyRoute);
    gestureSurface?.addEventListener("touchstart", handleTouchStart, {
      passive: true,
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
    gestureSurface?.removeEventListener("touchstart", handleTouchStart);
    gestureSurface?.removeEventListener("touchend", handleTouchEnd);
    gestureSurface?.removeEventListener("touchcancel", cancelTouchGesture);
    viewAnimation?.cancel?.();
    viewAnimation = null;
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
