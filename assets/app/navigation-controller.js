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
const VIEW_EXIT_DISTANCE = 32;
const VIEW_ENTER_DISTANCE = 40;
export const VIEW_EXIT_TRANSITION_OPTIONS = {
  duration: 170,
  easing: "cubic-bezier(0.4, 0, 1, 1)",
  fill: "forwards",
};
export const VIEW_ENTER_TRANSITION_OPTIONS = {
  duration: 320,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
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
  const scrollPositions = new Map();
  const linkListeners = new Map();
  let previousScrollRestoration = null;

  function scrollPosition() {
    const value = Number(windowRef.scrollY ?? windowRef.pageYOffset ?? 0);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  function restoreScrollPosition(view, fallback) {
    const top = scrollPositions.has(view)
      ? scrollPositions.get(view)
      : fallback;
    windowRef.requestAnimationFrame(() =>
      windowRef.scrollTo({ top, behavior: "auto" }),
    );
  }

  function prefersReducedMotion() {
    return Boolean(
      windowRef.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
    );
  }

  function cancelViewTransition() {
    transitionGeneration += 1;
    const animation = viewAnimation;
    viewAnimation = null;
    swipeTransitionActive = false;
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
        () => {
          if (
            generation !== transitionGeneration ||
            viewAnimation !== incomingAnimation
          )
            return;
          viewAnimation = null;
          swipeTransitionActive = false;
        },
        () => {},
      );
    } catch {
      outgoingAnimation?.cancel?.();
      cancelViewTransition();
    }
  }

  function transitionToView(destination, direction) {
    if (!transitionSurface?.animate || prefersReducedMotion()) {
      navigate(destination, { transitionDirection: direction });
      return;
    }

    cancelViewTransition();
    const generation = transitionGeneration;
    swipeTransitionActive = true;
    try {
      viewAnimation = transitionSurface.animate(
        viewExitKeyframes(direction),
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
    if (!initial && changed && currentView)
      scrollPositions.set(currentView, previousScroll);
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
      restoreScrollPosition(route.view, previousScroll);
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
      transitionToView(destination, deltaX < 0 ? 1 : -1);
  }

  function cancelTouchGesture() {
    swipeStart = null;
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
