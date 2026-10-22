/**
 * Daty rabatów zawsze w strefie Europe/Warsaw, niezależnie od strefy
 * przeglądarki i serwera.
 *
 * Konwencja zapisu w discounts (timestamptz):
 *   valid_from  = 00:01 czasu warszawskiego (np. 2026-09-02T22:01:00Z dla 03.09)
 *   valid_until = 23:59 czasu warszawskiego (np. 2026-09-20T21:59:00Z dla 20.09)
 */

export const WARSAW_TZ = 'Europe/Warsaw';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Kolumny typu date ("YYYY-MM-DD") to dzień kalendarzowy — bez konwersji strefy. */
function toInstant(value: string): Date {
  // Południe UTC jest tym samym dniem kalendarzowym w każdej strefie od -11 do +11.
  return DATE_ONLY_RE.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
}

/**
 * Formatuje date/timestamptz jako datę w Europe/Warsaw.
 * Domyślnie format jak toLocaleDateString('pl-PL'), np. "3.09.2026".
 */
export function formatWarsawDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {},
  fallback = '—'
): string {
  if (!value) return fallback;
  const d = toInstant(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('pl-PL', { ...options, timeZone: WARSAW_TZ });
}

/** Dzień kalendarzowy w Europe/Warsaw jako "YYYY-MM-DD" (np. do <input type="date">). */
export function toWarsawDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  if (DATE_ONLY_RE.test(value)) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: WARSAW_TZ });
}

/** Przesunięcie Europe/Warsaw względem UTC (w ms) w danym momencie — uwzględnia DST. */
function warsawOffsetMs(utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: WARSAW_TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wallAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return wallAsUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Godzina ścienna w Europe/Warsaw danego dnia ("YYYY-MM-DD") jako ISO UTC. */
function warsawWallTimeToIso(dateOnly: string, hour: number, minute: number): string | null {
  if (!DATE_ONLY_RE.test(dateOnly)) return null;
  const [y, m, d] = dateOnly.split('-').map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, hour, minute);
  let utcMs = wallAsUtc - warsawOffsetMs(wallAsUtc);
  // Druga iteracja na wypadek, gdy pierwsze przybliżenie trafiło po drugiej stronie zmiany czasu.
  utcMs = wallAsUtc - warsawOffsetMs(utcMs);
  return new Date(utcMs).toISOString();
}

/**
 * Normalizuje datę wejściową do konwencji zapisu valid_from (00:01 Europe/Warsaw).
 * Przyjmuje "YYYY-MM-DD" albo timestamp — liczy się dzień w Europe/Warsaw.
 */
export function toWarsawValidFrom(value: string | null | undefined): string | null {
  const day = toWarsawDateOnly(value);
  return day ? warsawWallTimeToIso(day, 0, 1) : null;
}

/** Normalizuje datę wejściową do konwencji zapisu valid_until (23:59 Europe/Warsaw). */
export function toWarsawValidUntil(value: string | null | undefined): string | null {
  const day = toWarsawDateOnly(value);
  return day ? warsawWallTimeToIso(day, 23, 59) : null;
}
