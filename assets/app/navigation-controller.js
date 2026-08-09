const VIEW_HASHES = {
  today: "#today",
  analysis: "#analysis",
  history: "#history",
};

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
  sections,
  links,
  entrySection,
  beforeNavigate = () => {},
  onViewChange = () => {},
}) {
  let currentView = null;

  function applyRoute({ initial = false } = {}) {
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
    return route.view;
  }

  function navigate(view, { entry = false, replace = false } = {}) {
    const hash = entry ? "#entry" : VIEW_HASHES[view] || VIEW_HASHES.today;
    if (windowRef.location.hash === hash) return applyRoute();
    if (replace) {
      windowRef.history.replaceState(null, "", hash);
      return applyRoute();
    }
    windowRef.location.hash = hash;
    return view;
  }

  function initialize() {
    const view = applyRoute({ initial: true });
    windowRef.addEventListener("hashchange", applyRoute);
    return view;
  }

  function destroy() {
    windowRef.removeEventListener("hashchange", applyRoute);
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
