import { BASE_LEXICON, CONTENT, defaultUnlock, PICTURES } from '@/content/index';
import { unlockForLevel } from '@/engine/lexicon';
import type { Attempt, Outcome, UnlockState, WordEntry } from '@/engine/types';

export const LEX = BASE_LEXICON;
export { CONTENT, PICTURES, defaultUnlock };

/** Levels 1..n with the 19 starting heart words. */
export function unlockAt(level: number): UnlockState {
  return unlockForLevel(level, LEX);
}

export function word(id: string): WordEntry {
  const entry = LEX.words.get(id);
  if (!entry) throw new Error(`No word ${id}`);
  return entry;
}

export const T0 = Date.UTC(2026, 10, 16, 15, 0, 0); // Mon 16 Nov 2026, 15:00 UTC
export const DAY = 24 * 60 * 60 * 1000;

let counter = 0;
export function attempt(
  overrides: Partial<Attempt> & { itemId: string; outcome: Outcome },
): Attempt {
  counter += 1;
  return {
    id: `a${counter}`,
    ts: T0,
    mode: 'solo',
    activity: 'pick',
    usedHelp: false,
    completedHelp: false,
    sessionId: 's1',
    ...overrides,
  };
}
