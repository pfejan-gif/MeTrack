import { todayLocal } from "../core.js";

export function createPwaController({ state, elements, $ }) {
  function refreshTodayUi() {
    const today = todayLocal();
    $("date").max = today;
    if (!state.editingDate && !$("date").value) $("date").value = today;
    $("todayLabel").textContent = new Intl.DateTimeFormat("de-DE", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    }).format(new Date(`${today}T12:00:00`));
  }
  
  function isIos() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }
  
  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  }
  
  function updateInstallUi() {
    elements.iosInstallCard.hidden = !(
      isIos() && !isStandalone() && !state.settings.installHintDismissed
    );
    elements.installButton.hidden =
      isStandalone() || (!state.deferredInstallPrompt && !isIos());
  }
  
  async function promptInstall() {
    if (state.deferredInstallPrompt) {
      state.deferredInstallPrompt.prompt();
      await state.deferredInstallPrompt.userChoice;
      state.deferredInstallPrompt = null;
      updateInstallUi();
    } else if (isIos()) {
      elements.iosInstallCard.hidden = false;
      elements.iosInstallCard.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
  
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    const offerUpdate = (worker) => {
      if (!worker) return;
      state.waitingWorker = worker;
      elements.updateButton.hidden = false;
      elements.updateBanner.hidden = false;
    };
    navigator.serviceWorker
      .register("./service-worker.js", { updateViaCache: "none" })
      .then((registration) => {
        let lastUpdateCheck = 0;
        const checkForUpdate = () => {
          if (Date.now() - lastUpdateCheck < 60_000) return;
          lastUpdateCheck = Date.now();
          registration
            .update()
            .then(() => {
              if (registration.waiting && navigator.serviceWorker.controller)
                offerUpdate(registration.waiting);
            })
            .catch(() => {});
        };
        if (registration.waiting && navigator.serviceWorker.controller)
          offerUpdate(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            )
              offerUpdate(worker);
          });
        });
        checkForUpdate();
        window.addEventListener("pageshow", checkForUpdate);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") checkForUpdate();
        });
      })
      .catch(() => {});
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  }
  

  return {
    refreshTodayUi,
    isIos,
    isStandalone,
    updateInstallUi,
    promptInstall,
    registerServiceWorker,
  };
}
