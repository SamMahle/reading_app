import { describe, expect, it } from 'vitest';
import {
  accuracy,
  consecutiveHighSessions,
  firstSeen,
  helpUseBySession,
  isSuccess,
  patternAccuracy,
  practiceDays,
  rollingAccuracy,
  soloSessionsToday,
  stallWords,
  summarizeSession,
} from '@/engine/metrics';
import type { LeitnerCard, SessionSummary } from '@/engine/types';
import { attempt, CONTENT, DAY, LEX, T0 } from './helpers';

const session = (overrides: Partial<SessionSummary>): SessionSummary => ({
  id: 'x',
  ts: T0,
  mode: 'solo',
  durationMs: 1,
  items: 10,
  accuracy: 1,
  helpOpened: 0,
  helpCompleted: 0,
  notes: [],
  ...overrides,
});

describe('accuracy', () => {
  it('counts correct and self-corrected, and treats helped and modeled as errors', () => {
    expect(isSuccess('correct') && isSuccess('self_corrected')).toBe(true);
    expect(isSuccess('helped') || isSuccess('modeled')).toBe(false);
    const attempts = (['correct', 'self_corrected', 'helped', 'modeled'] as const).map((outcome) =>
      attempt({ itemId: 'cat', outcome }),
    );
    expect(accuracy(attempts)).toBe(0.5);
    expect(accuracy([])).toBe(1);
  });

  it('computes rolling accuracy over the last 10 items, once there are enough', () => {
    const few = [attempt({ itemId: 'a', outcome: 'modeled' })];
    expect(rollingAccuracy(few)).toBeUndefined();
    const old = Array.from({ length: 10 }, (_, i) =>
      attempt({ itemId: 'a', outcome: 'modeled', ts: T0 + i }),
    );
    const recent = Array.from({ length: 10 }, (_, i) =>
      attempt({ itemId: 'a', outcome: i < 8 ? 'correct' : 'helped', ts: T0 + 100 + i }),
    );
    expect(rollingAccuracy([...recent, ...old])).toBe(0.8);
  });
});

describe('reports', () => {
  const cards = new Map<string, LeitnerCard>([
    ['dog', { wordId: 'dog', box: 2, dueTs: T0, correctDays: [] }],
  ]);
  const attempts = [
    attempt({
      itemId: 'dog',
      outcome: 'modeled',
      usedHelp: true,
      completedHelp: true,
      ts: T0 - DAY,
      sessionId: 's1',
    }),
    attempt({
      itemId: 'dog',
      outcome: 'helped',
      usedHelp: true,
      ts: T0 - 2 * DAY,
      sessionId: 's0',
    }),
    attempt({
      itemId: 'cat',
      outcome: 'helped',
      usedHelp: true,
      completedHelp: true,
      ts: T0 - DAY,
      sessionId: 's1',
    }),
    attempt({ itemId: 'hop', outcome: 'correct', ts: T0 - DAY, sessionId: 's1' }),
    attempt({ itemId: 'hot', outcome: 'modeled', ts: T0 - 20 * DAY, sessionId: 'old' }),
    attempt({ itemId: 'o', activity: 'warmup', outcome: 'helped', ts: T0 - DAY, sessionId: 's1' }),
    attempt({
      itemId: 's023',
      activity: 'match',
      outcome: 'modeled',
      ts: T0 - DAY,
      sessionId: 's1',
    }),
    attempt({
      itemId: 'zzz',
      activity: 'read',
      mode: 'coach',
      outcome: 'modeled',
      ts: T0 - DAY,
      sessionId: 's1',
    }),
  ];

  it('ranks stall words by misses plus help uses over 14 days', () => {
    const rows = stallWords(attempts, cards, T0);
    expect(rows.map((r) => [r.wordId, r.score])).toEqual([
      ['dog', 4],
      ['cat', 2],
      ['zzz', 1],
    ]);
    expect(rows[0]).toMatchObject({ misses: 2, helpUses: 2, box: 2, lastSeenTs: T0 - DAY });
    expect(rows[1]?.box).toBeUndefined();
  });

  it('reports accuracy per pattern, weakest first, flagging weak ones', () => {
    const many = [
      ...attempts,
      ...Array.from({ length: 4 }, () =>
        attempt({ itemId: 'dog', outcome: 'modeled', ts: T0 - DAY }),
      ),
    ];
    const rows = patternAccuracy(many, LEX, CONTENT.patterns, T0);
    const shortO = rows.find((r) => r.patternId === 'short_o');
    expect(shortO).toMatchObject({ total: 8, correct: 1, weak: true });
    expect(rows[0]?.accuracy).toBeLessThanOrEqual(rows.at(-1)?.accuracy ?? 0);
    expect(rows.find((r) => r.patternId === 'cons_h')).toMatchObject({
      total: 1,
      correct: 1,
      weak: false,
    });
    expect(rows.find((r) => r.patternId === 'dig_sh')).toBeUndefined();
  });

  it('reports help opened vs completed per session, oldest first', () => {
    expect(helpUseBySession(attempts).map((h) => [h.sessionId, h.opened, h.completed])).toEqual([
      ['old', 0, 0],
      ['s0', 1, 0],
      ['s1', 2, 2],
    ]);
  });

  it('finds when each item was first seen', () => {
    expect(firstSeen(attempts).get('dog')).toBe(T0 - 2 * DAY);
  });
});

describe('sessions', () => {
  it('lists practice days without duplicates', () => {
    const days = practiceDays([
      session({ ts: T0 }),
      session({ ts: T0 + 1000 }),
      session({ ts: T0 - 3 * DAY }),
    ]);
    expect(days).toEqual(['2026-11-13', '2026-11-16']);
  });

  it('counts consecutive recent Solo sessions at 98% or better', () => {
    const sessions = [
      session({ ts: T0 - 3 * DAY, accuracy: 0.5 }),
      session({ ts: T0 - 2 * DAY, accuracy: 0.99 }),
      session({ ts: T0 - DAY, accuracy: 1 }),
      session({ ts: T0, accuracy: 0.2, mode: 'coach' }),
    ];
    expect(consecutiveHighSessions(sessions)).toBe(2);
    expect(consecutiveHighSessions([])).toBe(0);
  });

  it('counts Solo sessions completed today', () => {
    const sessions = [
      session({ ts: T0 }),
      session({ ts: T0 - DAY }),
      session({ ts: T0, mode: 'coach' }),
    ];
    expect(soloSessionsToday(sessions, T0 + 1000)).toBe(1);
  });

  it('summarises a session', () => {
    const attempts = [
      attempt({ itemId: 'cat', outcome: 'correct' }),
      attempt({ itemId: 'dog', outcome: 'helped', usedHelp: true, completedHelp: true }),
    ];
    expect(summarizeSession('s9', 'coach', T0, T0 + 5000, attempts, ['note'], 'big_pig')).toEqual({
      id: 's9',
      ts: T0,
      mode: 'coach',
      durationMs: 5000,
      items: 2,
      accuracy: 0.5,
      helpOpened: 1,
      helpCompleted: 1,
      notes: ['note'],
      storyId: 'big_pig',
    });
    expect(summarizeSession('s9', 'solo', T0, T0 - 1, [])).toMatchObject({
      durationMs: 0,
      accuracy: 1,
      notes: [],
    });
  });
});
