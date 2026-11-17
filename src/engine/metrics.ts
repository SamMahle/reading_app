import { DAY_MS, toIsoDate } from './dates';
import { findEntry, requiredPatterns } from './lexicon';
import type {
  Attempt,
  LeitnerCard,
  Lexicon,
  Outcome,
  PatternDef,
  PatternId,
  SessionSummary,
} from './types';

/** Reporting and adaptive-difficulty maths (spec §8.5, §9.3, §10.4). */

export const REPORT_WINDOW_DAYS = 14;
export const WEAK_PATTERN_ACCURACY = 0.8;
export const WEAK_PATTERN_MIN_ATTEMPTS = 4;

export function isSuccess(outcome: Outcome): boolean {
  return outcome === 'correct' || outcome === 'self_corrected';
}

/**
 * Accuracy = (correct + self_corrected) / total. `helped` and `modeled`
 * count as errors. Returns 1 for an empty list (nothing was missed).
 */
export function accuracy(attempts: readonly Pick<Attempt, 'outcome'>[]): number {
  if (attempts.length === 0) return 1;
  return attempts.filter((a) => isSuccess(a.outcome)).length / attempts.length;
}

/** Accuracy over the most recent `size` attempts, or undefined if fewer than `min`. */
export function rollingAccuracy(
  attempts: readonly Attempt[],
  size = 10,
  min = 5,
): number | undefined {
  const recent = [...attempts].sort((a, b) => a.ts - b.ts).slice(-size);
  return recent.length < min ? undefined : accuracy(recent);
}

function within(attempts: readonly Attempt[], now: number, days: number): Attempt[] {
  const since = now - days * DAY_MS;
  return attempts.filter((a) => a.ts >= since && a.ts <= now);
}

const WORD_ACTIVITIES = new Set(['build', 'pick', 'read']);

export interface StallWord {
  wordId: string;
  misses: number;
  helpUses: number;
  score: number;
  lastSeenTs: number;
  box?: number;
}

/** Words ranked by (misses + help uses) over the last 14 days. */
export function stallWords(
  attempts: readonly Attempt[],
  cards: ReadonlyMap<string, LeitnerCard>,
  now: number,
  days = REPORT_WINDOW_DAYS,
): StallWord[] {
  const rows = new Map<string, StallWord>();
  for (const attempt of within(attempts, now, days)) {
    if (!WORD_ACTIVITIES.has(attempt.activity)) continue;
    const row = rows.get(attempt.itemId) ?? {
      wordId: attempt.itemId,
      misses: 0,
      helpUses: 0,
      score: 0,
      lastSeenTs: 0,
    };
    if (!isSuccess(attempt.outcome)) row.misses += 1;
    if (attempt.usedHelp) row.helpUses += 1;
    row.score = row.misses + row.helpUses;
    row.lastSeenTs = Math.max(row.lastSeenTs, attempt.ts);
    rows.set(attempt.itemId, row);
  }
  return [...rows.values()]
    .filter((row) => row.score > 0)
    .map((row) => ({ ...row, box: cards.get(row.wordId)?.box }))
    .sort((a, b) => b.score - a.score || b.lastSeenTs - a.lastSeenTs);
}

export interface PatternAccuracy {
  patternId: PatternId;
  total: number;
  correct: number;
  accuracy: number;
  weak: boolean;
}

/** Accuracy per pattern over the last 14 days, weakest first. */
export function patternAccuracy(
  attempts: readonly Attempt[],
  lex: Lexicon,
  patterns: readonly PatternDef[],
  now: number,
  days = REPORT_WINDOW_DAYS,
): PatternAccuracy[] {
  const bySpelling = new Map<string, PatternId[]>();
  for (const pattern of patterns) {
    for (const g of pattern.graphemes) {
      bySpelling.set(g.spelling, [...(bySpelling.get(g.spelling) ?? []), pattern.id]);
    }
  }
  const totals = new Map<PatternId, { total: number; correct: number }>();
  for (const attempt of within(attempts, now, days)) {
    let ids: PatternId[] = [];
    if (attempt.activity === 'warmup') {
      ids = (bySpelling.get(attempt.itemId) ?? []).slice(0, 1);
    } else if (WORD_ACTIVITIES.has(attempt.activity)) {
      const entry = findEntry(attempt.itemId, lex);
      ids = entry ? requiredPatterns(entry) : [];
    }
    for (const id of ids) {
      const row = totals.get(id) ?? { total: 0, correct: 0 };
      row.total += 1;
      if (isSuccess(attempt.outcome)) row.correct += 1;
      totals.set(id, row);
    }
  }
  return [...totals.entries()]
    .map(([patternId, { total, correct }]) => {
      const value = correct / total;
      return {
        patternId,
        total,
        correct,
        accuracy: value,
        weak: total >= WEAK_PATTERN_MIN_ATTEMPTS && value < WEAK_PATTERN_ACCURACY,
      };
    })
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);
}

export interface HelpUse {
  sessionId: string;
  ts: number;
  opened: number;
  completed: number;
}

/** Help opened vs completed per session, oldest first. */
export function helpUseBySession(attempts: readonly Attempt[]): HelpUse[] {
  const rows = new Map<string, HelpUse>();
  for (const attempt of attempts) {
    const row = rows.get(attempt.sessionId) ?? {
      sessionId: attempt.sessionId,
      ts: attempt.ts,
      opened: 0,
      completed: 0,
    };
    row.ts = Math.min(row.ts, attempt.ts);
    if (attempt.usedHelp) row.opened += 1;
    if (attempt.completedHelp) row.completed += 1;
    rows.set(attempt.sessionId, row);
  }
  return [...rows.values()].sort((a, b) => a.ts - b.ts);
}

/** ISO dates on which any session was completed. Never used to show a "lost" streak. */
export function practiceDays(sessions: readonly SessionSummary[]): string[] {
  return [...new Set(sessions.map((s) => toIsoDate(s.ts)))].sort();
}

/** Count of the most recent Solo sessions in a row at or above `threshold`. */
export function consecutiveHighSessions(
  sessions: readonly SessionSummary[],
  threshold = 0.98,
): number {
  const solo = sessions.filter((s) => s.mode === 'solo').sort((a, b) => b.ts - a.ts);
  let run = 0;
  for (const session of solo) {
    if (session.accuracy < threshold) break;
    run += 1;
  }
  return run;
}

/** Solo sessions already completed on the local day containing `now`. */
export function soloSessionsToday(sessions: readonly SessionSummary[], now: number): number {
  const today = toIsoDate(now);
  return sessions.filter((s) => s.mode === 'solo' && toIsoDate(s.ts) === today).length;
}

/** When each item was first attempted. */
export function firstSeen(attempts: readonly Attempt[]): Map<string, number> {
  const seen = new Map<string, number>();
  for (const attempt of attempts) {
    const prior = seen.get(attempt.itemId);
    if (prior === undefined || attempt.ts < prior) seen.set(attempt.itemId, attempt.ts);
  }
  return seen;
}

export function summarizeSession(
  id: string,
  mode: 'solo' | 'coach',
  startTs: number,
  endTs: number,
  attempts: readonly Attempt[],
  notes: readonly string[] = [],
  storyId?: string,
): SessionSummary {
  return {
    id,
    ts: startTs,
    mode,
    durationMs: Math.max(0, endTs - startTs),
    items: attempts.length,
    accuracy: accuracy(attempts),
    helpOpened: attempts.filter((a) => a.usedHelp).length,
    helpCompleted: attempts.filter((a) => a.completedHelp).length,
    notes: [...notes],
    ...(storyId === undefined ? {} : { storyId }),
  };
}
