import { describe, expect, it } from 'vitest';
import {
  createGuard,
  GUARD,
  isRapidBurst,
  promptFinished,
  registerTap,
  type GuardState,
} from '@/engine/guard';
import {
  allDotsTapped,
  canPlayWholeWord,
  canSlide,
  completedHelp,
  helpReducer,
  initialHelpState,
  type HelpEvent,
} from '@/engine/helpRoutine';
import { createRng, randomInt, shuffle, stochasticRound, weightedSample } from '@/engine/rng';

function tap(state: GuardState, ts: number, correct: boolean) {
  return registerTap(state, ts, correct);
}

describe('anti-guessing guard (spec §8.4)', () => {
  it('ignores taps while the prompt is playing and for 1.0 s after it ends', () => {
    let state = createGuard();
    expect(tap(state, 500, true).verdict).toBe('ignore');
    state = promptFinished(createGuard(), 1000);
    expect(tap(state, 1999, true).verdict).toBe('ignore');
    expect(tap(state, 2000, true).verdict).toBe('accept');
  });

  it('ignores a tap that follows another tap by less than 1.0 s', () => {
    let state = promptFinished(createGuard(), 0);
    const first = tap(state, 5000, false);
    expect(first.verdict).toBe('accept');
    state = first.state;
    expect(tap(state, 5600, true).verdict).toBe('ignore');
    expect(tap(state, 6000, true).verdict).toBe('accept');
  });

  it('pauses input for 2 s after three wrong taps within 3 s', () => {
    let state = promptFinished(createGuard(), 0);
    let result = tap(state, 5000, false);
    result = tap(result.state, 5300, false);
    expect(result.verdict).toBe('ignore');
    result = tap(result.state, 5600, false);
    expect(result.verdict).toBe('pause');
    state = result.state;
    expect(state.pausedUntil).toBe(5600 + GUARD.pauseMs);
    expect(tap(state, 7000, true).verdict).toBe('ignore'); // still paused
    expect(tap(state, 7700, true).verdict).toBe('accept');
    // A tap during the pause still counts as a tap for the 1.0 s gap rule.
    expect(tap(tap(state, 7500, true).state, 7700, true).verdict).toBe('ignore');
  });

  it('does not pause for slow wrong taps', () => {
    let result = tap(promptFinished(createGuard(), 0), 5000, false);
    result = tap(result.state, 7000, false);
    result = tap(result.state, 9000, false);
    expect(result.verdict).toBe('accept');
  });

  it('never accepts a tap during rapid random tapping', () => {
    const rng = createRng(42);
    let state = promptFinished(createGuard(), 0);
    for (let ts = 0; ts < 60_000; ts += 80 + randomInt(rng, 300)) {
      const result = tap(state, ts, rng.next() < 1 / 3);
      expect(result.verdict).not.toBe('accept');
      state = result.state;
    }
  });

  it('detects three taps in quick succession', () => {
    expect(isRapidBurst([0, 300])).toBe(false);
    expect(isRapidBurst([0, 300, 600])).toBe(true);
    expect(isRapidBurst([0, 300, 5000, 6000, 7000])).toBe(false);
  });
});

describe('sound-it-out gate (spec §8.1)', () => {
  const run = (count: number, events: HelpEvent[]) =>
    events.reduce(helpReducer, initialHelpState(count));

  it('keeps whole-word audio unreachable until every dot is tapped and the blend is swiped', () => {
    let state = initialHelpState(3);
    expect(canPlayWholeWord(state)).toBe(false);
    state = helpReducer(state, { type: 'dot', index: 0 });
    state = helpReducer(state, { type: 'dot', index: 1 });
    expect(canSlide(state)).toBe(false);
    // The slider and the pause cannot be skipped ahead.
    state = helpReducer(state, { type: 'slide_complete' });
    state = helpReducer(state, { type: 'pause_elapsed' });
    expect(state.slideDone).toBe(false);
    expect(canPlayWholeWord(state)).toBe(false);
    state = helpReducer(state, { type: 'dot', index: 2 });
    expect(allDotsTapped(state) && canSlide(state)).toBe(true);
    expect(completedHelp(state)).toBe(false);
    state = helpReducer(state, { type: 'slide_complete' });
    expect(completedHelp(state)).toBe(true);
    expect(canPlayWholeWord(state)).toBe(false); // "Say the word" pause still running
    state = helpReducer(state, { type: 'pause_elapsed' });
    expect(canPlayWholeWord(state)).toBe(true);
  });

  it('holds the gate under every incomplete event order', () => {
    const events: HelpEvent[] = [
      { type: 'dot', index: 0 },
      { type: 'dot', index: 1 },
      { type: 'slide_complete' },
      { type: 'pause_elapsed' },
    ];
    const rng = createRng(7);
    for (let i = 0; i < 300; i += 1) {
      const sequence = Array.from(
        { length: 6 },
        () => events[randomInt(rng, events.length)] as HelpEvent,
      );
      const state = run(3, sequence); // dot 2 is never tapped
      expect(canPlayWholeWord(state)).toBe(false);
      expect(completedHelp(state)).toBe(false);
    }
  });

  it('ignores repeated and out-of-range dots', () => {
    const state = run(2, [
      { type: 'dot', index: 0 },
      { type: 'dot', index: 0 },
      { type: 'dot', index: 9 },
      { type: 'dot', index: -1 },
    ]);
    expect(state.tapped).toEqual([true, false]);
  });
});

describe('rng', () => {
  it('is reproducible for a seed', () => {
    const a = createRng(1);
    const b = createRng(1);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
    expect(createRng(2).next()).not.toBe(createRng(1).next());
  });

  it('shuffles without losing items', () => {
    const items = [1, 2, 3, 4, 5, 6];
    const shuffled = shuffle(items, createRng(3));
    expect(shuffled).not.toEqual(items);
    expect([...shuffled].sort()).toEqual(items);
  });

  it('samples distinct items by weight', () => {
    const rng = createRng(9);
    let heavy = 0;
    for (let i = 0; i < 200; i += 1)
      if (weightedSample(['a', 'b', 'c'], (x) => (x === 'a' ? 10 : 1), 1, rng)[0] === 'a')
        heavy += 1;
    expect(heavy).toBeGreaterThan(130);
    expect(weightedSample(['a', 'b'], () => 1, 5, rng).sort()).toEqual(['a', 'b']);
    expect(weightedSample(['a', 'b'], () => 0, 2, rng).sort()).toEqual(['a', 'b']);
    expect(weightedSample([], () => 1, 2, rng)).toEqual([]);
  });

  it('rounds stochastically around the value', () => {
    const rng = createRng(4);
    let total = 0;
    for (let i = 0; i < 1000; i += 1) total += stochasticRound(0.4, rng);
    expect(total).toBeGreaterThan(330);
    expect(total).toBeLessThan(470);
    expect(stochasticRound(2, rng)).toBe(2);
  });
});
