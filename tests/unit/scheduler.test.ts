import { describe, expect, it } from 'vitest';
import { daysBetween, startOfDay, toIsoDate } from '@/engine/dates';
import {
  applyOutcome,
  BOX_INTERVAL_DAYS,
  enqueueStallWord,
  isDue,
  isMastered,
  newCard,
} from '@/engine/scheduler';
import type { LeitnerCard } from '@/engine/types';
import { DAY, T0 } from './helpers';

describe('Leitner scheduler (spec §8.6)', () => {
  it('uses 5 boxes with intervals of 0, 1, 2, 4 and 8 days', () => {
    expect(BOX_INTERVAL_DAYS).toEqual({ 1: 0, 2: 1, 3: 2, 4: 4, 5: 8 });
  });

  it('starts new words in box 1, due at once', () => {
    const card = newCard('cat', T0);
    expect(card).toEqual({ wordId: 'cat', box: 1, dueTs: T0, correctDays: [] });
    expect(isDue(card, T0)).toBe(true);
  });

  it('moves up one box on an unaided correct answer and schedules by interval', () => {
    let card = newCard('cat', T0);
    const expectedDays = [1, 2, 4, 8, 8];
    expectedDays.forEach((days, i) => {
      const now = T0 + i * 10 * DAY;
      card = applyOutcome(card, 'correct', now);
      expect(card.box).toBe(Math.min(i + 2, 5));
      expect(card.dueTs).toBe(startOfDay(now) + days * DAY);
      expect(isDue(card, now)).toBe(false);
      expect(isDue(card, startOfDay(now) + days * DAY)).toBe(true);
    });
  });

  it.each(['helped', 'self_corrected'] as const)('stays in the same box when %s', (outcome) => {
    const card: LeitnerCard = { wordId: 'cat', box: 3, dueTs: T0, correctDays: ['2026-11-15'] };
    const next = applyOutcome(card, outcome, T0);
    expect(next.box).toBe(3);
    expect(next.dueTs).toBe(startOfDay(T0) + 2 * DAY);
    expect(next.correctDays).toEqual(['2026-11-15']);
    expect(applyOutcome({ ...card, box: 1 }, outcome, T0).dueTs).toBe(T0);
  });

  it('sends a modeled word back to box 1, due at once', () => {
    const card: LeitnerCard = {
      wordId: 'cat',
      box: 4,
      dueTs: T0 + DAY,
      correctDays: ['2026-11-15'],
    };
    expect(applyOutcome(card, 'modeled', T0)).toMatchObject({ box: 1, dueTs: T0 });
  });

  it('is mastered only after 3 different correct days at box 4 or higher', () => {
    let card = newCard('cat', T0);
    card = applyOutcome(card, 'correct', T0);
    card = applyOutcome(card, 'correct', T0); // same day: counted once
    expect(card.correctDays).toEqual(['2026-11-16']);
    card = applyOutcome(card, 'correct', T0 + DAY);
    expect(card.box).toBe(4);
    expect(isMastered(card)).toBe(false); // box 4 but only 2 days
    card = applyOutcome(card, 'correct', T0 + 2 * DAY);
    expect(card.correctDays).toHaveLength(3);
    expect(isMastered(card)).toBe(true);
    expect(isMastered({ ...card, box: 3 })).toBe(false);
  });

  it('puts a Coach stall word into box 1 of the Solo queue', () => {
    expect(enqueueStallWord(undefined, 'sits', T0)).toEqual(newCard('sits', T0));
    const known: LeitnerCard = {
      wordId: 'sits',
      box: 5,
      dueTs: T0 + 8 * DAY,
      correctDays: ['2026-11-01'],
    };
    expect(enqueueStallWord(known, 'sits', T0)).toEqual({ ...known, box: 1, dueTs: T0 });
  });
});

describe('dates', () => {
  it('formats local ISO dates and counts calendar days', () => {
    expect(toIsoDate(Date.UTC(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(startOfDay(T0)).toBe(Date.UTC(2026, 10, 16));
    expect(daysBetween(T0, T0 + 60_000)).toBe(0);
    expect(daysBetween(T0, T0 + 10 * 60 * 60 * 1000)).toBe(1);
    expect(daysBetween(T0, T0 - 3 * DAY)).toBe(-3);
  });
});
