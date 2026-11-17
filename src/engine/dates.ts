export const DAY_MS = 24 * 60 * 60 * 1000;

/** Local calendar date as ISO "YYYY-MM-DD". */
export function toIsoDate(ts: number): string {
  const d = new Date(ts);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Epoch ms of local midnight at the start of the day containing `ts`. */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Whole local calendar days from `fromTs` to `toTs` (0 when the same day). */
export function daysBetween(fromTs: number, toTs: number): number {
  return Math.round((startOfDay(toTs) - startOfDay(fromTs)) / DAY_MS);
}
