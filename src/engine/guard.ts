/**
 * Anti-guessing guardrails (spec §8.4), kept pure so they can be unit tested.
 *
 * - Taps within 1.0 s of the prompt finishing are ignored.
 * - Three wrong taps within 3 s pause input for 2 s, then the routine runs.
 * - Addition: a tap that follows another choice tap by less than 1.0 s is
 *   ignored, so rapid tapping can never land an accepted answer.
 */
export const GUARD = {
  debounceMs: 1000,
  minGapMs: 1000,
  burstCount: 3,
  burstWindowMs: 3000,
  pauseMs: 2000,
  /** Tile taps closer together than this (3 in a row) count as rapid tapping. */
  rapidWindowMs: 1200,
} as const;

export interface GuardState {
  /** When the spoken prompt finished. Infinity while it is still playing. */
  promptEndTs: number;
  pausedUntil: number;
  lastTapTs: number;
  wrongTapTs: number[];
}

export type TapVerdict = 'accept' | 'ignore' | 'pause';

export function createGuard(): GuardState {
  return {
    promptEndTs: Number.POSITIVE_INFINITY,
    pausedUntil: 0,
    lastTapTs: Number.NEGATIVE_INFINITY,
    wrongTapTs: [],
  };
}

export function promptFinished(state: GuardState, ts: number): GuardState {
  return { ...state, promptEndTs: ts };
}

export function registerTap(
  state: GuardState,
  ts: number,
  isCorrect: boolean,
): { state: GuardState; verdict: TapVerdict } {
  if (ts < state.pausedUntil) return { state: { ...state, lastTapTs: ts }, verdict: 'ignore' };

  const tooEarly = ts < state.promptEndTs + GUARD.debounceMs;
  const tooFast = ts - state.lastTapTs < GUARD.minGapMs;
  const wrongTapTs = isCorrect
    ? state.wrongTapTs
    : [...state.wrongTapTs, ts].filter((t) => ts - t <= GUARD.burstWindowMs);

  if (!isCorrect && wrongTapTs.length >= GUARD.burstCount) {
    return {
      state: { ...state, lastTapTs: ts, wrongTapTs: [], pausedUntil: ts + GUARD.pauseMs },
      verdict: 'pause',
    };
  }
  return {
    state: { ...state, lastTapTs: ts, wrongTapTs },
    verdict: tooEarly || tooFast ? 'ignore' : 'accept',
  };
}

/** True when the last three taps all fell inside the rapid-tap window. */
export function isRapidBurst(tapTimes: readonly number[]): boolean {
  if (tapTimes.length < GUARD.burstCount) return false;
  const recent = tapTimes.slice(-GUARD.burstCount);
  const first = recent[0] ?? 0;
  const last = recent[recent.length - 1] ?? 0;
  return last - first < GUARD.rapidWindowMs;
}
