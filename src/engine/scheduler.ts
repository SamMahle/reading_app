import { DAY_MS, startOfDay, toIsoDate } from './dates';
import type { LeitnerBox, LeitnerCard, Outcome } from './types';

/**
 * Leitner spaced review (spec §8.6).
 * Five boxes with intervals of 0, 1, 2, 4 and 8 days. New words start in box 1.
 */
export const BOX_INTERVAL_DAYS: Readonly<Record<LeitnerBox, number>> = {
  1: 0,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
};

export const MASTERY_MIN_BOX: LeitnerBox = 4;
export const MASTERY_CORRECT_DAYS = 3;

function dueFor(box: LeitnerBox, now: number): number {
  const days = BOX_INTERVAL_DAYS[box];
  // Box 1 is due at once; later boxes come due at the start of the target day
  // so a morning session is never blocked by the previous evening's clock time.
  return days === 0 ? now : startOfDay(now) + days * DAY_MS;
}

export function newCard(wordId: string, now: number): LeitnerCard {
  return { wordId, box: 1, dueTs: now, correctDays: [] };
}

/**
 * - correct (no help): up one box
 * - helped / self_corrected: stay
 * - modeled: back to box 1
 */
export function applyOutcome(card: LeitnerCard, outcome: Outcome, now: number): LeitnerCard {
  if (outcome === 'correct') {
    const box = Math.min(card.box + 1, 5) as LeitnerBox;
    const today = toIsoDate(now);
    const correctDays = card.correctDays.includes(today)
      ? card.correctDays
      : [...card.correctDays, today];
    return { ...card, box, dueTs: dueFor(box, now), correctDays };
  }
  if (outcome === 'modeled') {
    return { ...card, box: 1, dueTs: now };
  }
  return { ...card, dueTs: dueFor(card.box, now) };
}

export function isDue(card: LeitnerCard, now: number): boolean {
  return card.dueTs <= now;
}

/** Correct with no help on 3 different calendar days, at box 4 or higher. */
export function isMastered(card: LeitnerCard): boolean {
  return card.box >= MASTERY_MIN_BOX && card.correctDays.length >= MASTERY_CORRECT_DAYS;
}

/** A Coach-mode ✕ word enters box 1 of the Solo queue (spec §8.6). */
export function enqueueStallWord(card: LeitnerCard | undefined, wordId: string, now: number) {
  return card ? { ...card, box: 1 as LeitnerBox, dueTs: now } : newCard(wordId, now);
}
