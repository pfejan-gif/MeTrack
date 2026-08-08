import { TIMER_MAX_MS } from "./constants.js";

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

export function timerElapsedMs(timer, now = Date.now()) {
  const accumulated = Number.isFinite(timer?.accumulatedMs)
    ? Math.max(0, timer.accumulatedMs)
    : 0;
  const runningElapsed =
    timer?.running === true && Number.isFinite(timer?.startedAt)
      ? Math.max(0, now - timer.startedAt)
      : 0;
  return Math.min(TIMER_MAX_MS, accumulated + runningElapsed);
}

export function timerRecordedSeconds(elapsedMs) {
  const value = Number.isFinite(elapsedMs) ? elapsedMs : 0;
  return Math.round(Math.min(TIMER_MAX_MS, Math.max(0, value)) / 1000);
}

export function formatStopwatch(elapsedMs) {
  const tenths = Math.floor(
    Math.min(TIMER_MAX_MS, Math.max(0, Number(elapsedMs) || 0)) / 100,
  );
  const deciseconds = tenths % 10;
  const totalSeconds = Math.floor(tenths / 10);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  const paddedSeconds = String(seconds).padStart(2, "0");
  const paddedMinutes = String(minutes).padStart(2, "0");
  return hours > 0
    ? `${hours}:${paddedMinutes}:${paddedSeconds},${deciseconds}`
    : `${paddedMinutes}:${paddedSeconds},${deciseconds}`;
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
