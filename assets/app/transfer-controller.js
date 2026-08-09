import {
  createBackup,
  entriesToCsv,
  formatDate,
  mergeEntries,
  mergeExerciseCatalog,
  normalizeEntries,
  parseBackup,
  todayLocal,
} from "../core.js";

export function createTransferController({
  state,
  elements,
  persistData,
  showToast,
  saveSettings,
  applyTheme,
  renderExerciseCatalogUi,
  resetForm,
  restoreDraft,
  render,
  reconcileTimer,
}) {
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  
  function timestampForFilename() {
    return new Date().toISOString().slice(0, 19).replaceAll(":", "-");
  }
  
  async function shareOrDownload(content, filename, type, title, success) {
    const file = new File([content], filename, { type });
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, files: [file] });
        showToast(success);
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
    downloadBlob(file, filename);
    showToast(success);
  }
  
  function exportCsv() {
    if (!state.entries.length) return;
    return shareOrDownload(
      entriesToCsv(state.entries, state.exercises),
      `metrack-${todayLocal()}.csv`,
      "text/csv;charset=utf-8",
      "MeTrack CSV-Export",
      "CSV exportiert",
    );
  }
  
  function exportBackup() {
    if (!state.entries.length && !state.exercises.length) return;
    return shareOrDownload(
      JSON.stringify(createBackup(state.entries, state.exercises, state.settings), null, 2),
      `metrack-sicherung-${timestampForFilename()}.json`,
      "application/json",
      "MeTrack Sicherung",
      "Sicherung gespeichert",
    );
  }
  
  function readFileAsText(file) {
    if (typeof file.text === "function") return file.text();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(String(reader.result)));
      reader.addEventListener("error", () => reject(reader.error));
      reader.readAsText(file);
    });
  }
  
  async function readImportFile(file) {
    if (!file) return;
    if (file.size > 2_000_000) {
      showToast("Die Sicherungsdatei ist zu groß.");
      return;
    }
    try {
      const parsed = parseBackup(await readFileAsText(file));
      state.pendingImport = parsed;
      const range = parsed.entries.length
        ? `${formatDate(parsed.entries[0].date)} bis ${formatDate(parsed.entries[parsed.entries.length - 1].date)}`
        : "keine Einträge";
      elements.importSummary.textContent = `Die Sicherung enthält ${parsed.entries.length} ${parsed.entries.length === 1 ? "Tag" : "Tage"} (${range}) und ${parsed.exercises.length} ${parsed.exercises.length === 1 ? "Trainingseintrag" : "Trainingseinträge"}.`;
      if (typeof elements.importDialog.showModal === "function")
        elements.importDialog.showModal();
      else if (window.confirm(`${elements.importSummary.textContent}\n\nVorhandene Daten ersetzen?`))
        applyImport("replace");
      else applyImport("merge");
    } catch (error) {
      showToast(error.message || "Sicherung konnte nicht gelesen werden.");
    } finally {
      elements.importFile.value = "";
    }
  }
  
  function applyImport(mode) {
    if (!state.pendingImport || !["merge", "replace"].includes(mode)) return;
    const previousEntries = state.entries;
    const previousExercises = state.exercises;
    try {
      const exercises =
        mode === "merge"
          ? mergeExerciseCatalog(state.exercises, state.pendingImport.exercises)
          : state.pendingImport.exercises;
      const entries =
        mode === "merge"
          ? mergeEntries(state.entries, state.pendingImport.entries, exercises)
          : normalizeEntries(state.pendingImport.entries, exercises);
      if (!persistData(entries, exercises, { allowRecovery: true })) return;
      reconcileTimer();
      if (THEME_ORDER.includes(state.pendingImport.settings?.theme)) {
        state.settings.theme = state.pendingImport.settings.theme;
        saveSettings();
        applyTheme();
      }
    } catch (error) {
      showToast(error.message || "Sicherung konnte nicht importiert werden.");
      return;
    }
    state.pendingImport = null;
    renderExerciseCatalogUi();
    resetForm({ clearStoredDraft: false });
    restoreDraft();
    render();
    showToast(mode === "merge" ? "Sicherung zusammengeführt ✓" : "Sicherung wiederhergestellt ✓", {
      label: "Rückgängig",
      callback: () => {
        if (persistData(previousEntries, previousExercises, { allowRecovery: true })) {
          renderExerciseCatalogUi();
          resetForm({ clearStoredDraft: false });
          restoreDraft();
          render();
        }
      },
    });
  }
  

  return {
    downloadBlob,
    timestampForFilename,
    exportCsv,
    exportBackup,
    readImportFile,
    applyImport,
  };
}
