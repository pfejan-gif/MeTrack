import {
  SET_COUNT,
  TIMER_MAX_MS,
  exerciseFieldName,
  formatStopwatch,
  timerElapsedMs,
  timerRecordedSeconds,
} from "../core.js";

export const TIMER_KEY = "metrack_active_timer_v1";

export function createTimerController({
  state,
  elements,
  $,
  $$,
  showToast,
  askForConfirmation,
}) {
  function timerExercise() {
    return state.exercises.find(
      (exercise) => exercise.id === state.timer.exerciseId,
    );
  }
  
  function timerHasValue() {
    return timerElapsedMs(state.timer) > 0;
  }
  
  function saveTimerState() {
    try {
      if (!state.timer.exerciseId) {
        localStorage.removeItem(TIMER_KEY);
        return true;
      }
      localStorage.setItem(
        TIMER_KEY,
        JSON.stringify({
          exerciseId: state.timer.exerciseId,
          setIndex: state.timer.setIndex,
          running: state.timer.running,
          startedAt: state.timer.startedAt,
          accumulatedMs: state.timer.accumulatedMs,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }
  
  function updateTimerButtons() {
    $$('[data-timer-exercise]', elements.exerciseFields).forEach((button) => {
      const selected =
        button.dataset.timerExercise === state.timer.exerciseId &&
        Number(button.dataset.timerSet) === state.timer.setIndex;
      button.classList.toggle("active", selected);
      button.classList.toggle("running", selected && state.timer.running);
      button.setAttribute("aria-pressed", String(selected));
    });
  }
  
  function updateTimerWakeStatus() {
    if (!("wakeLock" in navigator)) {
      elements.timerWakeStatus.textContent =
        "Bildschirm-Wachhalten wird von diesem Browser nicht unterstützt.";
      return;
    }
    if (state.timer.wakeLock) {
      elements.timerWakeStatus.textContent =
        "Der Bildschirm bleibt während der Messung aktiv.";
      return;
    }
    if (state.timer.running && document.visibilityState !== "visible") {
      elements.timerWakeStatus.textContent =
        "Die Zeit läuft per Zeitstempel weiter, solange MeTrack nicht sichtbar ist.";
      return;
    }
    elements.timerWakeStatus.textContent = state.timer.running
      ? "Der Timer läuft; Bildschirm-Wachhalten ist gerade nicht verfügbar."
      : "Beim Start versucht MeTrack, den Bildschirm wach zu halten.";
  }
  
  async function releaseTimerWakeLock() {
    const wakeLock = state.timer.wakeLock;
    state.timer.wakeLock = null;
    updateTimerWakeStatus();
    if (!wakeLock) return;
    try {
      await wakeLock.release();
    } catch {
      // Der Browser kann die Sperre bereits selbst freigegeben haben.
    }
  }
  
  async function requestTimerWakeLock() {
    if (
      !state.timer.running ||
      !("wakeLock" in navigator) ||
      document.visibilityState !== "visible" ||
      state.timer.wakeLock
    ) {
      updateTimerWakeStatus();
      return;
    }
    try {
      const sentinel = await navigator.wakeLock.request("screen");
      if (!state.timer.running) {
        await sentinel.release();
        return;
      }
      state.timer.wakeLock = sentinel;
      sentinel.addEventListener("release", () => {
        if (state.timer.wakeLock === sentinel) state.timer.wakeLock = null;
        updateTimerWakeStatus();
      });
    } catch {
      state.timer.wakeLock = null;
    }
    updateTimerWakeStatus();
  }
  
  function paintTimer() {
    if (!state.timer.exerciseId) return;
    const elapsed = timerElapsedMs(state.timer);
    if (state.timer.running && elapsed >= TIMER_MAX_MS) {
      state.timer.accumulatedMs = TIMER_MAX_MS;
      state.timer.running = false;
      state.timer.startedAt = null;
      cancelAnimationFrame(state.timer.animationFrame);
      state.timer.animationFrame = null;
      saveTimerState();
      releaseTimerWakeLock();
    }
    const tenth = Math.floor(elapsed / 100);
    if (tenth !== state.timer.lastRenderedTenth) {
      elements.timerDisplay.textContent = formatStopwatch(elapsed);
      elements.timerDisplay.setAttribute(
        "aria-label",
        `${timerRecordedSeconds(elapsed)} Sekunden gemessen`,
      );
      state.timer.lastRenderedTenth = tenth;
    }
    elements.timerStatus.textContent = state.timer.running
      ? "Läuft"
      : elapsed >= TIMER_MAX_MS
        ? "Maximalzeit erreicht"
      : elapsed > 0
        ? "Pausiert"
        : "Bereit";
    elements.timerReadout.classList.toggle("running", state.timer.running);
    elements.timerReadout.classList.toggle("long", elapsed >= 3_600_000);
    elements.timerStartPauseLabel.textContent = elapsed >= TIMER_MAX_MS
      ? "Maximum"
      : state.timer.running
      ? "Pause"
      : elapsed > 0
        ? "Fortsetzen"
        : "Start";
    elements.timerControlIcon.setAttribute(
      "d",
      state.timer.running ? "M8 5h3v14H8zM13 5h3v14h-3z" : "M8 5v14l11-7Z",
    );
    elements.timerResetButton.disabled = elapsed === 0;
    elements.timerStartPauseButton.disabled = elapsed >= TIMER_MAX_MS;
    const seconds = timerRecordedSeconds(elapsed);
    elements.timerApplyButton.textContent = seconds
      ? `${seconds} Sek. übernehmen`
      : "Zeit übernehmen";
    updateTimerWakeStatus();
    updateTimerButtons();
  }
  
  function runTimerAnimation() {
    cancelAnimationFrame(state.timer.animationFrame);
    state.timer.animationFrame = null;
    paintTimer();
    if (state.timer.running) {
      state.timer.animationFrame = requestAnimationFrame(runTimerAnimation);
    }
  }
  
  function pauseTimer() {
    if (state.timer.running) {
      state.timer.accumulatedMs = timerElapsedMs(state.timer);
      state.timer.running = false;
      state.timer.startedAt = null;
    }
    cancelAnimationFrame(state.timer.animationFrame);
    state.timer.animationFrame = null;
    saveTimerState();
    releaseTimerWakeLock();
    paintTimer();
  }
  
  function clearTimer({ close = true } = {}) {
    cancelAnimationFrame(state.timer.animationFrame);
    releaseTimerWakeLock();
    state.timer = {
      exerciseId: null,
      setIndex: null,
      running: false,
      startedAt: null,
      accumulatedMs: 0,
      animationFrame: null,
      wakeLock: null,
      lastRenderedTenth: null,
    };
    try {
      localStorage.removeItem(TIMER_KEY);
    } catch {
      // Die Stoppuhr bleibt auch ohne optionalen Wiederherstellungsspeicher nutzbar.
    }
    updateTimerButtons();
    if (close && elements.timerDialog.open) elements.timerDialog.close();
  }
  
  function activateTimer(exerciseId, setIndex) {
    const exercise = state.exercises.find(
      (item) =>
        item.id === exerciseId && item.active && item.kind === "seconds",
    );
    if (!exercise || !Number.isInteger(setIndex) || setIndex < 0 || setIndex >= SET_COUNT)
      return;
    const sameTarget =
      state.timer.exerciseId === exerciseId && state.timer.setIndex === setIndex;
    if (!sameTarget) {
      clearTimer({ close: false });
      state.timer.exerciseId = exerciseId;
      state.timer.setIndex = setIndex;
      saveTimerState();
    }
    elements.timerTitle.textContent = `${exercise.name} · Satz ${setIndex + 1}`;
    state.timer.lastRenderedTenth = null;
    paintTimer();
    if (typeof elements.timerDialog.showModal !== "function") {
      showToast("Die Stoppuhr benötigt einen aktuellen Browser.");
      return;
    }
    if (!elements.timerDialog.open) elements.timerDialog.showModal();
    if (state.timer.running) {
      requestTimerWakeLock();
      runTimerAnimation();
    }
    setTimeout(() => elements.timerStartPauseButton.focus(), 80);
  }
  
  function openTimer(exerciseId, setIndex) {
    const changingTarget =
      state.timer.exerciseId &&
      (state.timer.exerciseId !== exerciseId || state.timer.setIndex !== setIndex);
    if (changingTarget && timerHasValue()) {
      const current = timerExercise();
      askForConfirmation({
        title: "Laufenden Timer wechseln?",
        text: `Die noch nicht übernommene Zeit für ${current?.name || "die aktuelle Übung"} wird verworfen.`,
        actionLabel: "Timer wechseln",
        callback: () => activateTimer(exerciseId, setIndex),
      });
      return;
    }
    activateTimer(exerciseId, setIndex);
  }
  
  function startOrPauseTimer() {
    if (!state.timer.exerciseId) return;
    if (state.timer.running) {
      pauseTimer();
      return;
    }
    state.timer.running = true;
    state.timer.startedAt = Date.now();
    state.timer.lastRenderedTenth = null;
    saveTimerState();
    requestTimerWakeLock();
    runTimerAnimation();
  }
  
  function resetTimer() {
    pauseTimer();
    state.timer.accumulatedMs = 0;
    state.timer.lastRenderedTenth = null;
    saveTimerState();
    paintTimer();
  }
  
  function closeTimer() {
    pauseTimer();
    if (elements.timerDialog.open) elements.timerDialog.close();
  }
  
  function applyTimer() {
    const exercise = timerExercise();
    if (!exercise) return;
    const elapsed = timerElapsedMs(state.timer);
    const seconds = timerRecordedSeconds(elapsed);
    if (seconds < 1) {
      showToast("Starte zuerst die Stoppuhr.");
      return;
    }
    const exerciseId = state.timer.exerciseId;
    const setIndex = state.timer.setIndex;
    pauseTimer();
    const input = $(exerciseFieldName(exerciseId, setIndex));
    if (!input) {
      showToast("Das Satzfeld ist nicht mehr verfügbar.");
      clearTimer();
      return;
    }
    input.value = String(seconds);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.removeAttribute("aria-invalid");
    const error = $(`${input.id}Error`);
    if (error) error.textContent = "";
    const nextSet = setIndex + 1 < SET_COUNT ? setIndex + 1 : null;
    clearTimer();
    showToast(`${seconds} Sek. in Satz ${setIndex + 1} übernommen ✓`,
      nextSet === null
        ? null
        : {
            label: "Nächster Satz",
            callback: () => openTimer(exerciseId, nextSet),
          },
    );
    input.focus();
  }
  
  function restoreTimer() {
    let parsed;
    try {
      const raw = localStorage.getItem(TIMER_KEY);
      if (!raw) return;
      parsed = JSON.parse(raw);
    } catch {
      clearTimer({ close: false });
      return;
    }
    const exercise = state.exercises.find(
      (item) =>
        item.id === parsed?.exerciseId && item.active && item.kind === "seconds",
    );
    const validSet =
      Number.isInteger(parsed?.setIndex) &&
      parsed.setIndex >= 0 &&
      parsed.setIndex < SET_COUNT;
    const validAccumulated =
      Number.isFinite(parsed?.accumulatedMs) &&
      parsed.accumulatedMs >= 0 &&
      parsed.accumulatedMs <= TIMER_MAX_MS;
    const validRunning =
      parsed?.running !== true ||
      (Number.isFinite(parsed?.startedAt) && parsed.startedAt <= Date.now());
    if (!exercise || !validSet || !validAccumulated || !validRunning) {
      clearTimer({ close: false });
      return;
    }
    state.timer.exerciseId = exercise.id;
    state.timer.setIndex = parsed.setIndex;
    state.timer.running = parsed.running === true;
    state.timer.startedAt = state.timer.running ? parsed.startedAt : null;
    state.timer.accumulatedMs = parsed.accumulatedMs;
    state.timer.lastRenderedTenth = null;
    updateTimerButtons();
    showToast("Stoppuhr wiederhergestellt", {
      label: "Öffnen",
      callback: () => activateTimer(exercise.id, parsed.setIndex),
    });
  }
  
  function reconcileTimer() {
    if (!state.timer.exerciseId) return;
    const exercise = timerExercise();
    if (!exercise || !exercise.active || exercise.kind !== "seconds") {
      clearTimer();
      return;
    }
    updateTimerButtons();
  }
  
  function createTimerButton(exercise, index) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "set-timer-button";
    button.dataset.timerExercise = exercise.id;
    button.dataset.timerSet = String(index);
    button.setAttribute("aria-pressed", "false");
    button.setAttribute(
      "aria-label",
      `Stoppuhr für ${exercise.name}, Satz ${index + 1} öffnen`,
    );
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "12");
    circle.setAttribute("cy", "13");
    circle.setAttribute("r", "7");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M9 3h6M12 6V3m0 10 3-2");
    svg.append(circle, path);
    button.append(svg);
    return button;
  }
  
  

  return {
    timerHasValue,
    saveTimerState,
    updateTimerButtons,
    releaseTimerWakeLock,
    requestTimerWakeLock,
    paintTimer,
    runTimerAnimation,
    pauseTimer,
    clearTimer,
    activateTimer,
    openTimer,
    startOrPauseTimer,
    resetTimer,
    closeTimer,
    applyTimer,
    restoreTimer,
    reconcileTimer,
    createTimerButton,
  };
}
