/** Date helpers that work in the learner's own time zone (default Asia/Kolkata). */

export const DAY_MS = 86_400_000;

/** YYYY-MM-DD of `d` in `tz`. */
export function localDay(d: Date, tz = "Asia/Kolkata"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Minutes since local midnight of `d` in `tz`. */
export function localMinutes(d: Date, tz = "Asia/Kolkata"): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** "HH:MM" → minutes since midnight. */
export function hm(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Minutes since midnight → "HH:MM". */
export function toHm(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Whole days from day string a to day string b (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY_MS);
}

/** Day string plus n days. */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(day + "T00:00:00Z") + n * DAY_MS).toISOString().slice(0, 10);
}

/** True when `min` (minutes since midnight) falls inside quiet hours, which may wrap midnight. */
export function inQuietHours(min: number, start: string, end: string): boolean {
  const s = hm(start);
  const e = hm(end);
  return s <= e ? min >= s && min < e : min >= s || min < e;
}

/**
 * The UTC instant of local time `HH:MM` on `day` in `tz`.
 * Works by measuring the zone's offset at that moment (no DST in India, but this stays correct elsewhere).
 */
export function zonedInstant(day: string, time: string, tz = "Asia/Kolkata"): Date {
  const guess = new Date(`${day}T${time}:00Z`);
  const shown = localMinutes(guess, tz);
  const shownDay = localDay(guess, tz);
  const offset = (daysBetween(day, shownDay) * 1440 + shown - hm(time)) * 60_000;
  return new Date(guess.getTime() - offset);
}
