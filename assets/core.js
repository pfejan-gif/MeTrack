export const STORAGE_KEY = "metrack_entries_v1";
export const DATA_KEY = "metrack_data_v2";
export const SETTINGS_KEY = "metrack_settings_v1";
export const BACKUP_VERSION = 2;
export const SET_COUNT = 3;
export const MAX_BACKUP_ENTRIES = 5000;

export const METRICS = Object.freeze({
  plank: {
    label: "Plank",
    shortLabel: "Plank",
    unit: "Sek.",
    csvLabel: "Plank Sekunden",
    decimals: 0,
    min: 0,
    max: 3600,
    direction: "up",
  },
  pushups: {
    label: "Liegestütze",
    shortLabel: "Liegestütze",
    unit: "Wdh.",
    csvLabel: "Liegestuetze",
    decimals: 0,
    min: 0,
    max: 1000,
    direction: "up",
  },
  squats: {
    label: "Kniebeugen",
    shortLabel: "Kniebeugen",
    unit: "Wdh.",
    csvLabel: "Kniebeugen",
    decimals: 0,
    min: 0,
    max: 2000,
    direction: "up",
  },
  weight: {
    label: "Gewicht",
    shortLabel: "Gewicht",
    unit: "kg",
    csvLabel: "Gewicht kg",
    decimals: 1,
    min: 20,
    max: 400,
    direction: "neutral",
  },
  waist: {
    label: "Bauchumfang",
    shortLabel: "Bauch",
    unit: "cm",
    csvLabel: "Bauch cm",
    decimals: 1,
    min: 30,
    max: 300,
    direction: "neutral",
  },
});

export const METRIC_KEYS = Object.freeze(Object.keys(METRICS));
export const EXERCISE_KEYS = Object.freeze(["plank", "pushups", "squats"]);
export const BODY_METRIC_KEYS = Object.freeze(["weight", "waist"]);

export function setFieldName(key, index) {
  return `${key}${index + 1}`;
}

export function setsKey(key) {
  return `${key}Sets`;
}

export function exerciseSets(raw, key) {
  const storedSets = raw?.[setsKey(key)];
  if (Array.isArray(storedSets))
    return Array.from(
      { length: SET_COUNT },
      (_, index) => storedSets[index] ?? null,
    );

  const formFields = Array.from(
    { length: SET_COUNT },
    (_, index) => raw?.[setFieldName(key, index)],
  );
  if (formFields.some((value) => value !== undefined)) return formFields;

  return [
    raw?.[key] ?? null,
    ...Array.from({ length: SET_COUNT - 1 }, () => null),
  ];
}

export function todayLocal(now = new Date()) {
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function parseNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(",", ".");
  if (normalized === "") return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function sanitizeEntry(raw) {
  if (!raw || !isIsoDate(raw.date)) return null;
  const entry = { date: raw.date };

  for (const key of EXERCISE_KEYS) {
    const definition = METRICS[key];
    const values = exerciseSets(raw, key).map((rawValue) => {
      const parsed = parseNumber(rawValue);
      if (parsed === null) return null;
      const value = Math.round(parsed);
      return value >= definition.min && value <= definition.max ? value : null;
    });
    entry[setsKey(key)] = values;
    const completed = values.filter((value) => value !== null);
    entry[key] = completed.length ? Math.max(...completed) : null;
  }

  for (const key of BODY_METRIC_KEYS) {
    const definition = METRICS[key];
    const parsed = parseNumber(raw[key]);
    if (parsed === null) {
      entry[key] = null;
      continue;
    }

    const value =
      definition.decimals === 0
        ? Math.round(parsed)
        : Math.round(parsed * 10) / 10;
    entry[key] =
      value >= definition.min && value <= definition.max ? value : null;
  }

  return entry;
}

export function hasMeasurement(entry) {
  return METRIC_KEYS.some(
    (key) => entry?.[key] !== null && entry?.[key] !== undefined,
  );
}

export function validateEntry(raw) {
  const errors = {};

  if (!isIsoDate(raw?.date)) errors.date = "Bitte wähle ein gültiges Datum.";

  for (const key of EXERCISE_KEYS) {
    const definition = METRICS[key];
    exerciseSets(raw, key).forEach((value, index) => {
      if (value === "" || value === null || value === undefined) return;
      const parsed = parseNumber(value);
      if (
        parsed === null ||
        parsed < definition.min ||
        parsed > definition.max ||
        !Number.isInteger(parsed)
      ) {
        errors[setFieldName(key, index)] =
          `Ganze Zahl von ${definition.min}–${definition.max}`;
      }
    });
  }

  for (const key of BODY_METRIC_KEYS) {
    const definition = METRICS[key];
    if (raw?.[key] === "" || raw?.[key] === null || raw?.[key] === undefined)
      continue;
    const parsed = parseNumber(raw[key]);
    const precisionFactor = 10 ** definition.decimals;
    const hasTooManyDecimals =
      parsed !== null &&
      Math.abs(
        parsed * precisionFactor - Math.round(parsed * precisionFactor),
      ) > 1e-8;
    if (
      parsed === null ||
      parsed < definition.min ||
      parsed > definition.max ||
      hasTooManyDecimals
    ) {
      errors[key] =
        `Erlaubt sind ${definition.min} bis ${definition.max} ${definition.unit} mit höchstens ${definition.decimals} Dezimalstelle`;
    }
  }

  const sanitized = sanitizeEntry(raw);
  if (sanitized && !hasMeasurement(sanitized)) {
    errors.form = "Trage mindestens einen Messwert ein.";
  }

  return { valid: Object.keys(errors).length === 0, errors, entry: sanitized };
}

export function sortEntries(entries) {
  return [...entries]
    .map(sanitizeEntry)
    .filter((entry) => entry && hasMeasurement(entry))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function normalizeEntries(entries) {
  const byDate = new Map();
  for (const entry of sortEntries(Array.isArray(entries) ? entries : [])) {
    const existing = byDate.get(entry.date);
    byDate.set(entry.date, existing ? mergeDayEntries(existing, entry) : entry);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function mergeDayEntries(currentEntry, incomingEntry) {
  const current = sanitizeEntry(currentEntry);
  const incoming = sanitizeEntry(incomingEntry);
  if (!current) return incoming;
  if (!incoming) return current;
  if (current.date !== incoming.date) return incoming;

  const merged = { date: current.date };
  for (const key of EXERCISE_KEYS) {
    const currentSets = current[setsKey(key)];
    const incomingSets = incoming[setsKey(key)];
    merged[setsKey(key)] = currentSets.map(
      (value, index) => incomingSets[index] ?? value,
    );
  }
  for (const key of BODY_METRIC_KEYS) {
    merged[key] = incoming[key] ?? current[key];
  }
  return sanitizeEntry(merged);
}

export function upsertEntry(entries, nextEntry, previousDate = null) {
  const normalized = normalizeEntries(entries);
  const sanitized = sanitizeEntry(nextEntry);
  if (!sanitized || !hasMeasurement(sanitized)) return normalized;

  const withoutPrevious = previousDate
    ? normalized.filter((entry) => entry.date !== previousDate)
    : normalized;
  const index = withoutPrevious.findIndex(
    (entry) => entry.date === sanitized.date,
  );

  if (index >= 0) withoutPrevious[index] = sanitized;
  else withoutPrevious.push(sanitized);

  return withoutPrevious.sort((a, b) => a.date.localeCompare(b.date));
}

export function removeEntry(entries, date) {
  return normalizeEntries(entries).filter((entry) => entry.date !== date);
}

export function metricValues(entries, key) {
  return normalizeEntries(entries).filter((entry) => entry[key] !== null);
}

export function latestValue(entries, key) {
  const values = metricValues(entries, key);
  return values.length ? values[values.length - 1][key] : null;
}

export function firstValue(entries, key) {
  return metricValues(entries, key)[0]?.[key] ?? null;
}

export function bestValue(entries, key) {
  const values = metricValues(entries, key).map((entry) => entry[key]);
  return values.length ? Math.max(...values) : null;
}

export function previousValue(entries, key) {
  const values = metricValues(entries, key);
  return values.length > 1 ? values[values.length - 2][key] : null;
}

export function changeFromPrevious(entries, key) {
  const latest = latestValue(entries, key);
  const previous = previousValue(entries, key);
  return latest === null || previous === null ? null : latest - previous;
}

export function changeFromFirst(entries, key) {
  const latest = latestValue(entries, key);
  const first = firstValue(entries, key);
  return latest === null || first === null ? null : latest - first;
}

export function calculateStreak(entries, referenceDate = todayLocal()) {
  const uniqueDates = [
    ...new Set(
      normalizeEntries(entries)
        .map((entry) => entry.date)
        .filter((date) => date <= referenceDate),
    ),
  ]
    .sort()
    .reverse();
  if (!uniqueDates.length || !isIsoDate(referenceDate)) return 0;

  let reference = new Date(`${referenceDate}T12:00:00`);
  let streak = 0;

  for (const dateString of uniqueDates) {
    const current = new Date(`${dateString}T12:00:00`);
    const difference = Math.round((reference - current) / 86_400_000);
    const acceptedFirstDay = streak === 0 && difference >= 0 && difference <= 1;
    const acceptedNextDay = streak > 0 && difference === 1;

    if (!acceptedFirstDay && !acceptedNextDay) break;
    streak += 1;
    reference = current;
  }

  return streak;
}

export function formatNumber(value, decimals = 0, locale = "de-DE") {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "—";
  return value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDate(dateString, locale = "de-DE") {
  if (!isIsoDate(dateString)) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dateString}T12:00:00`));
}

function csvCell(value) {
  const string = String(value ?? "");
  return /[;"\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}

function csvNumber(value, decimals = 0) {
  if (value === null || value === undefined) return "";
  return decimals > 0
    ? Number(value).toFixed(decimals).replace(".", ",")
    : String(value);
}

export function entriesToCsv(entries) {
  const header = [
    "Datum",
    ...EXERCISE_KEYS.flatMap((key) => [
      ...Array.from(
        { length: SET_COUNT },
        (_, index) => `${METRICS[key].csvLabel} Satz ${index + 1}`,
      ),
      `${METRICS[key].csvLabel} Bestwert`,
    ]),
    ...BODY_METRIC_KEYS.map((key) => METRICS[key].csvLabel),
  ];
  const lines = normalizeEntries(entries).map((entry) => [
    entry.date,
    ...EXERCISE_KEYS.flatMap((key) => [
      ...entry[setsKey(key)].map((value) => csvNumber(value)),
      csvNumber(entry[key]),
    ]),
    ...BODY_METRIC_KEYS.map((key) =>
      csvNumber(entry[key], METRICS[key].decimals),
    ),
  ]);
  return `\ufeff${[header, ...lines].map((row) => row.map(csvCell).join(";")).join("\n")}`;
}

export function createBackup(entries, settings = {}) {
  return {
    app: "MeTrack",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    entries: normalizeEntries(entries),
    settings: {
      theme: ["system", "light", "dark"].includes(settings.theme)
        ? settings.theme
        : "system",
    },
  };
}

export function parseBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Die Datei enthält kein gültiges JSON.");
  }

  if (!parsed || parsed.app !== "MeTrack" || !Array.isArray(parsed.entries)) {
    throw new Error("Das ist keine gültige MeTrack-Sicherung.");
  }

  if (!Number.isInteger(parsed.version) || parsed.version < 1) {
    throw new Error("Die MeTrack-Sicherung hat keine unterstützte Version.");
  }

  if (parsed.entries.length > MAX_BACKUP_ENTRIES) {
    throw new Error(
      `Die Sicherung enthält mehr als ${MAX_BACKUP_ENTRIES} Einträge.`,
    );
  }

  if (parsed.version > BACKUP_VERSION) {
    throw new Error(
      "Diese Sicherung wurde mit einer neueren MeTrack-Version erstellt.",
    );
  }

  parsed.entries.forEach((entry, index) => {
    if (entry?.date > todayLocal() || !validateEntry(entry).valid) {
      throw new Error(`Eintrag ${index + 1} der Sicherung ist ungültig.`);
    }
  });

  const entries = normalizeEntries(parsed.entries);
  if (parsed.entries.length > 0 && entries.length === 0) {
    throw new Error("Die Sicherung enthält keine gültigen Einträge.");
  }

  return {
    entries,
    settings:
      parsed.settings && typeof parsed.settings === "object"
        ? parsed.settings
        : {},
    exportedAt: parsed.exportedAt ?? null,
  };
}

export function mergeEntries(currentEntries, importedEntries) {
  const byDate = new Map(
    normalizeEntries(currentEntries).map((entry) => [entry.date, entry]),
  );
  for (const incoming of normalizeEntries(importedEntries)) {
    const current = byDate.get(incoming.date);
    byDate.set(
      incoming.date,
      current ? mergeDayEntries(current, incoming) : incoming,
    );
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
