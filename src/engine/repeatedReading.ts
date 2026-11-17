import { DAY_MS, daysBetween } from './dates';

/**
 * Repeated reading (spec §9.4): each story has a 3-star track. Read 2 follows
 * read 1 on the same day or the next; read 3 comes later that week. Stars are
 * earned by completing a read, never by speed.
 */
export const MAX_READS = 3;
/** Read 3 waits this many calendar days after read 2. */
export const THIRD_READ_GAP_DAYS = 2;

export interface ReadStatus {
  stars: number;
  /** The read that comes next (1–3), or undefined once all three are done. */
  nextRead?: 1 | 2 | 3;
  /** True when the next read should be surfaced on the home screen today. */
  due: boolean;
  /** When the next read becomes due (epoch ms), if it is not due yet. */
  dueTs?: number;
}

export function readStatus(reads: readonly number[], now: number): ReadStatus {
  const done = [...reads].sort((a, b) => a - b).slice(0, MAX_READS);
  const stars = done.length;
  if (stars === 0) return { stars, nextRead: 1, due: false };
  if (stars >= MAX_READS) return { stars: MAX_READS, due: false };
  const last = done[done.length - 1] ?? now;
  if (stars === 1) return { stars, nextRead: 2, due: true };
  const waited = daysBetween(last, now);
  if (waited >= THIRD_READ_GAP_DAYS) return { stars, nextRead: 3, due: true };
  return { stars, nextRead: 3, due: false, dueTs: last + THIRD_READ_GAP_DAYS * DAY_MS };
}
