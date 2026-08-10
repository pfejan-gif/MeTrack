import {
  DATA_KEY,
  PREVIOUS_DATA_KEY,
  STORAGE_KEY,
  V2_DATA_KEY,
  V3_DATA_KEY,
  V4_DATA_KEY,
  createBackup,
  createDataEnvelope,
  migrateDataEnvelope,
  migrateLegacyEntries,
  validateExerciseCatalog,
} from "../core.js";

export const PRE_IMPORT_BACKUP_KEY = "metrack_pre_import_backup_v1";
export const PRE_RESET_BACKUP_KEY = "metrack_pre_reset_backup_v1";
export const CORRUPT_PAYLOAD_BACKUP_KEY =
  "metrack_corrupt_payload_backup_v1";

export const DATA_STORAGE_KEYS = Object.freeze([
  DATA_KEY,
  PREVIOUS_DATA_KEY,
  V4_DATA_KEY,
  V3_DATA_KEY,
  V2_DATA_KEY,
  STORAGE_KEY,
]);

export const RECOVERY_KEYS = Object.freeze([
  PRE_IMPORT_BACKUP_KEY,
  PRE_RESET_BACKUP_KEY,
  CORRUPT_PAYLOAD_BACKUP_KEY,
]);

const STORAGE_TEST_KEY = "metrack_storage_test";

function verifiedWrite(storage, key, serialized) {
  storage.setItem(key, serialized);
  if (storage.getItem(key) !== serialized)
    throw new Error(`Storage readback failed for ${key}`);
}

export function createStorageController({
  state,
  storage,
  cloneDefaults,
  updateStorageUi,
  showToast,
}) {
  function testStorage() {
    try {
      storage.setItem(STORAGE_TEST_KEY, "1");
      storage.removeItem(STORAGE_TEST_KEY);
      return true;
    } catch {
      return false;
    }
  }

  function markStorageCorrupt(raw, key) {
    state.storageCorrupt = true;
    state.corruptStorageValue = raw;
    state.corruptStorageKey = key;
    state.storageWritable = false;
  }

  function writeMigratedData(data) {
    if (!state.storageWritable) return;
    try {
      const serialized = JSON.stringify(
        createDataEnvelope(data.entries, data.exercises),
      );
      verifiedWrite(storage, DATA_KEY, serialized);
    } catch {
      state.storageWritable = false;
    }
  }

  function loadData() {
    state.storageWritable = testStorage();
    const candidates = DATA_STORAGE_KEYS.map((key) => ({
      key,
      migrate: key === STORAGE_KEY ? migrateLegacyEntries : migrateDataEnvelope,
    }));
    for (const candidate of candidates) {
      let raw;
      try {
        raw = storage.getItem(candidate.key);
      } catch {
        state.storageWritable = false;
        return { entries: [], exercises: cloneDefaults() };
      }
      if (raw === null) continue;
      try {
        const migrated = candidate.migrate(JSON.parse(raw));
        if (candidate.key !== DATA_KEY) writeMigratedData(migrated);
        return migrated;
      } catch {
        markStorageCorrupt(raw, candidate.key);
        return { entries: [], exercises: cloneDefaults() };
      }
    }
    return { entries: [], exercises: cloneDefaults() };
  }

  function persistData(
    nextEntries,
    nextExercises = state.exercises,
    { allowRecovery = false } = {},
  ) {
    if (state.storageCorrupt && !allowRecovery) {
      showToast("Speichern pausiert: Die vorhandenen Daten sind beschädigt.");
      return false;
    }
    if (!validateExerciseCatalog(nextExercises).valid) {
      showToast("Der Übungskatalog konnte nicht gespeichert werden.");
      return false;
    }
    try {
      const envelope = createDataEnvelope(nextEntries, nextExercises);
      const serialized = JSON.stringify(envelope);
      verifiedWrite(storage, DATA_KEY, serialized);
      state.entries = envelope.entries;
      state.exercises = envelope.exercises;
      state.storageWritable = true;
      state.storageCorrupt = false;
      state.corruptStorageValue = null;
      state.corruptStorageKey = null;
      updateStorageUi();
      return true;
    } catch {
      state.storageWritable = false;
      updateStorageUi();
      showToast("Nicht gespeichert. Bitte prüfe den Browser-Speicher.");
      return false;
    }
  }

  function writeRecovery(key, serialized, failureMessage) {
    try {
      verifiedWrite(storage, key, serialized);
      return true;
    } catch {
      state.storageWritable = false;
      updateStorageUi();
      showToast(failureMessage);
      return false;
    }
  }

  function corruptRecoveryPayload() {
    return JSON.stringify({
      app: "MeTrack",
      recoveryType: "corrupt-storage",
      sourceKey: state.corruptStorageKey,
      savedAt: new Date().toISOString(),
      raw: state.corruptStorageValue,
    });
  }

  function backupBeforeImport() {
    if (state.storageCorrupt && state.corruptStorageValue !== null) {
      return writeRecovery(
        CORRUPT_PAYLOAD_BACKUP_KEY,
        corruptRecoveryPayload(),
        "Die beschädigten Rohdaten konnten vor dem Import nicht gesichert werden.",
      );
    }
    return writeRecovery(
      PRE_IMPORT_BACKUP_KEY,
      JSON.stringify(
        createBackup(state.entries, state.exercises, state.settings),
      ),
      "Die vorhandenen Daten konnten vor dem Import nicht gesichert werden.",
    );
  }

  function backupBeforeReset() {
    if (state.storageCorrupt && state.corruptStorageValue !== null) {
      return writeRecovery(
        CORRUPT_PAYLOAD_BACKUP_KEY,
        corruptRecoveryPayload(),
        "Die beschädigten Rohdaten konnten nicht automatisch gesichert werden.",
      );
    }
    return writeRecovery(
      PRE_RESET_BACKUP_KEY,
      JSON.stringify(
        createBackup(state.entries, state.exercises, state.settings),
      ),
      "Die vorhandenen Daten konnten vor dem Zurücksetzen nicht gesichert werden.",
    );
  }

  function removeAllStorageKeys(additionalKeys = []) {
    [...DATA_STORAGE_KEYS, ...additionalKeys].forEach((key) =>
      storage.removeItem(key),
    );
  }

  return {
    testStorage,
    loadData,
    persistData,
    backupBeforeImport,
    backupBeforeReset,
    removeAllStorageKeys,
  };
}
