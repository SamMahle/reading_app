import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { unlockedPatterns } from '@/engine/lexicon';
import { classifyWord, isReadable } from '@/engine/readability';
import { createRng } from '@/engine/rng';
import {
  buildSession,
  isItemReadable,
  ITEM_COUNTS,
  requeue,
  selectByMix,
  SKIPPED_NO_AUDIO_NOTE,
  type BuildInput,
  type SessionItem,
} from '@/engine/sessionBuilder';
import type { Attempt, LeitnerCard, SessionSummary, UnlockState } from '@/engine/types';
import { attempt, CONTENT, DAY, defaultUnlock, LEX, PICTURES, T0, unlockAt, word } from './helpers';

function input(overrides: Partial<BuildInput> = {}): BuildInput {
  return {
    lexicon: LEX,
    unlock: defaultUnlock(),
    sentences: CONTENT.sentences,
    patterns: CONTENT.patterns,
    sounds: CONTENT.sounds,
    pictures: PICTURES,
    cards: new Map(),
    attempts: [],
    sessions: [],
    now: T0,
    minutes: 6,
    audioAvailable: true,
    rng: createRng(1),
    ...overrides,
  };
}
const card = (wordId: string, box: 1 | 2 | 3 | 4 | 5, dueTs: number, days = 0): LeitnerCard => ({
  wordId,
  box,
  dueTs,
  correctDays: Array.from({ length: days }, (_, i) => `2026-11-0${i + 1}`),
});
const soloSession = (ts: number, accuracy: number): SessionSummary => ({
  id: `s${ts}`,
  ts,
  mode: 'solo',
  durationMs: 1,
  items: 16,
  accuracy,
  helpOpened: 0,
  helpCompleted: 0,
  notes: [],
});
const kinds = (items: SessionItem[]) => items.map((i) => i.kind);

/** Everything an item would put on screen must be readable under `unlock`. */
function expectReadable(item: SessionItem, unlock: UnlockState): void {
  const unlocked = unlockedPatterns(unlock, LEX.levels);
  if (item.kind === 'warmup') {
    for (const option of item.options) expect(unlocked.has(option.patternId)).toBe(true);
  } else if (item.kind === 'build') {
    expect(classifyWord(item.wordId, unlock, LEX).cls).toBe('decodable');
    const target = word(item.wordId);
    for (const tile of item.tiles) {
      const own = target.graphemes.some((g) => g.spelling === tile.spelling);
      const taught = CONTENT.patterns.some(
        (p) => unlocked.has(p.id) && p.graphemes.some((g) => g.spelling === tile.spelling),
      );
      expect(own || taught).toBe(true);
    }
  } else if (item.kind === 'pick') {
    expect(item.optionIds).toContain(item.wordId);
    for (const id of item.optionIds) expect(classifyWord(id, unlock, LEX).cls).toBe('decodable');
  } else {
    const sentence = CONTENT.sentences.find((s) => s.id === item.sentenceId);
    expect(sentence && isReadable(sentence.text, unlock, LEX).ok).toBe(true);
    expect(item.choices.filter((c) => c.correct)).toHaveLength(1);
  }
  expect(isItemReadable(item, { lexicon: LEX, unlock, sentences: CONTENT.sentences })).toBe(true);
}

describe('buildSession (spec §8.5)', () => {
  it('builds the default 6-minute order: 4 warm-ups, 4 builds, 5 picks, 3 matches', () => {
    const plan = buildSession(input());
    expect(kinds(plan.items)).toEqual([
      ...Array(4).fill('warmup'),
      ...Array(4).fill('build'),
      ...Array(5).fill('pick'),
      ...Array(3).fill('match'),
    ]);
    expect(plan.notes).toEqual([]);
    expect(plan.restricted).toBe(false);
    expect(plan.newShare).toBe(0.1);
    expect(plan.fillers).toHaveLength(3);
  });

  it.each([4, 6, 8] as const)('scales item counts for a %i-minute session', (minutes) => {
    const plan = buildSession(input({ minutes }));
    const counts = ITEM_COUNTS[minutes];
    expect(plan.items).toHaveLength(counts.warmup + counts.build + counts.pick + counts.match);
  });

  it('is deterministic for a seed', () => {
    expect(buildSession(input({ rng: createRng(5) }))).toEqual(
      buildSession(input({ rng: createRng(5) })),
    );
  });

  it('never uses heart words or names for word building', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      for (const item of buildSession(input({ rng: createRng(seed) })).items) {
        if (item.kind !== 'build') continue;
        expect(LEX.heartWords.has(item.wordId)).toBe(false);
        expect(word(item.wordId).tags ?? []).not.toContain('name');
      }
    }
  });

  it('alternates tap-to-hear and find-the-sound warm-ups', () => {
    const warmups = buildSession(input()).items.filter((i) => i.kind === 'warmup');
    expect(warmups.map((w) => w.variant)).toEqual(['hear', 'find', 'hear', 'find']);
    expect(warmups[1]?.options).toHaveLength(3);
  });

  it('skips audio-dependent items on a muted device and leaves a parent-visible note', () => {
    const plan = buildSession(input({ audioAvailable: false }));
    expect(plan.items.some((i) => i.kind === 'build')).toBe(false);
    expect(plan.items.filter((i) => i.kind === 'warmup').every((i) => i.variant === 'hear')).toBe(
      true,
    );
    expect(plan.notes).toEqual([SKIPPED_NO_AUDIO_NOTE]);
    expect(plan.closer.kind).not.toBe('build');
  });

  it('draws only review and mastered items while rolling accuracy is below 85%', () => {
    const attempts: Attempt[] = Array.from({ length: 10 }, (_, i) =>
      attempt({ itemId: 'cat', outcome: i < 8 ? 'correct' : 'modeled', ts: T0 - 1000 + i }),
    );
    const known = [
      'cat',
      'hat',
      'map',
      'bag',
      'pig',
      'pin',
      'dog',
      'log',
      'pot',
      'man',
      'fan',
      'can',
      'cap',
      'rat',
      'bat',
      'ram',
    ];
    const cards = new Map(known.map((id) => [id, card(id, 2, T0 - DAY)]));
    const plan = buildSession(input({ attempts, cards }));
    expect(plan.restricted).toBe(true);
    const wordItems = plan.items.filter((i) => i.kind === 'build' || i.kind === 'pick');
    for (const item of wordItems) expect(cards.has(item.wordId), item.wordId).toBe(true);
  });

  it('raises the new-item share to 20% after 2 sessions at 98% or better', () => {
    const sessions = [soloSession(T0 - 2 * DAY, 1), soloSession(T0 - DAY, 0.98)];
    expect(buildSession(input({ sessions })).newShare).toBe(0.2);
    expect(buildSession(input({ sessions: [soloSession(T0 - DAY, 1)] })).newShare).toBe(0.1);
  });

  it('ends on a mastered item when one exists', () => {
    const cards = new Map([
      ['cat', card('cat', 5, T0 + 5 * DAY, 3)],
      ['dog', card('dog', 2, T0)],
    ]);
    const plan = buildSession(input({ cards }));
    expect(plan.closer).toMatchObject({ kind: 'pick', wordId: 'cat' });
    // A mastered word with no picture closes as a build item.
    const built = buildSession(input({ cards: new Map([['sat', card('sat', 5, T0 + DAY, 3)]]) }));
    expect(built.closer).toMatchObject({ kind: 'build', wordId: 'sat' });
  });

  it('falls back to a tap-to-hear sound before anything is known', () => {
    expect(buildSession(input()).closer).toMatchObject({ kind: 'warmup', variant: 'hear' });
    const nothing = buildSession(
      input({ unlock: { levels: [], extraPatterns: [], lockedPatterns: [], heartWords: [] } }),
    );
    expect(nothing.items).toEqual([]);
    expect(nothing.closer).toMatchObject({ kind: 'warmup', variant: 'hear' });
  });

  it('prefers sentences she has not matched yet, mixed with ones she has', () => {
    const done = attempt({ itemId: 's001', activity: 'match', outcome: 'correct' });
    const ids = new Set<string>();
    for (let seed = 0; seed < 20; seed += 1) {
      const matches = buildSession(input({ attempts: [done], rng: createRng(seed) })).items.filter(
        (i) => i.kind === 'match',
      );
      expect(matches).toHaveLength(3);
      expect(matches.filter((m) => m.sentenceId === 's001')).toHaveLength(1);
      for (const m of matches) ids.add(m.sentenceId);
    }
    expect(ids.size).toBeGreaterThan(3);
  });

  it('weights warm-ups toward recently missed graphemes', () => {
    const missed = attempt({ itemId: 'z', activity: 'warmup', outcome: 'helped', ts: T0 - DAY });
    let hits = 0;
    for (let seed = 0; seed < 60; seed += 1) {
      const warmups = buildSession(
        input({ attempts: [missed], rng: createRng(seed) }),
      ).items.filter((i) => i.kind === 'warmup');
      if (warmups.some((w) => w.target.spelling === 'z')) hits += 1;
    }
    expect(hits).toBeGreaterThan(25); // about 13 of 60 by chance alone
  });
});

describe('selectByMix', () => {
  const pool = ['cat', 'hat', 'map', 'bag', 'pig', 'pin', 'dog', 'log', 'pot', 'man'].map(word);
  const ctx = (overrides = {}) => ({
    cards: new Map<string, LeitnerCard>(),
    seen: new Map<string, number>(),
    levelOf: () => 1,
    now: T0,
    restricted: false,
    newShare: 0.1,
    rng: createRng(2),
    ...overrides,
  });

  it('fills from new words when nothing has been seen', () => {
    expect(selectByMix(pool, 4, ctx())).toHaveLength(4);
    expect(selectByMix(pool, 99, ctx())).toHaveLength(pool.length);
  });

  it('takes due review words first and introduces new words lowest level first', () => {
    const cards = new Map([
      ['cat', card('cat', 2, T0 - DAY)],
      ['hat', card('hat', 2, T0 - 2 * DAY)],
      ['map', card('map', 3, T0 + DAY)],
      ['bag', card('bag', 5, T0 - DAY, 3)],
    ]);
    const seen = new Map([
      ['map', T0 - DAY],
      ['bag', T0 - 30 * DAY],
    ]);
    const levelOf = (w: { id: string }) => (w.id === 'dog' ? 1 : 2);
    let sawNew = 0;
    for (let seed = 0; seed < 40; seed += 1) {
      const chosen = selectByMix(
        pool,
        3,
        ctx({ cards, seen, levelOf, newShare: 0.2, rng: createRng(seed) }),
      ).map((w) => w.id);
      expect(chosen.filter((id) => ['cat', 'hat'].includes(id)).length).toBeGreaterThanOrEqual(1);
      const fresh = chosen.filter((id) => !cards.has(id));
      if (fresh.length > 0) {
        sawNew += 1;
        expect(fresh[0]).toBe('dog');
      }
    }
    expect(sawNew).toBeGreaterThan(10);
  });

  it('avoids new words in restricted mode while known words remain', () => {
    const cards = new Map([
      ['cat', card('cat', 2, T0 - DAY)],
      ['bag', card('bag', 5, T0 + DAY, 3)],
      ['map', card('map', 2, T0 + DAY)],
    ]);
    const seen = new Map([['map', T0 - DAY]]);
    const chosen = selectByMix(pool, 3, ctx({ cards, seen, restricted: true })).map((w) => w.id);
    expect(chosen.sort()).toEqual(['bag', 'cat', 'map']);
  });
});

describe('requeue (spec §8.3)', () => {
  const item = (id: string): SessionItem => ({ kind: 'pick', wordId: id, optionIds: [id] });
  const ids = (queue: SessionItem[]) => queue.map((i) => (i.kind === 'pick' ? i.wordId : `filler`));
  const fillers = [item('f1'), item('f2'), item('f3')];

  it('re-queues a modeled item at least 3 items later', () => {
    const queue = ['a', 'b', 'c', 'd', 'e', 'f'].map(item);
    expect(ids(requeue(queue, 1, item('b'), fillers))).toEqual(['a', 'b', 'c', 'd', 'e', 'b', 'f']);
  });

  it('pads with fillers when fewer than 3 items remain', () => {
    const queue = ['a', 'b', 'c'].map(item);
    expect(ids(requeue(queue, 1, item('b'), fillers))).toEqual(['a', 'b', 'c', 'f1', 'f2', 'b']);
    expect(ids(requeue(queue, 2, item('c'), fillers))).toEqual([
      'a',
      'b',
      'c',
      'f1',
      'f2',
      'f3',
      'c',
    ]);
  });
});

describe('isItemReadable', () => {
  const ctx = { lexicon: LEX, unlock: defaultUnlock(), sentences: CONTENT.sentences };
  it('rejects items that need locked patterns or missing content', () => {
    expect(isItemReadable({ kind: 'build', wordId: 'ship', tiles: [] }, ctx)).toBe(false);
    expect(isItemReadable({ kind: 'build', wordId: 'nope', tiles: [] }, ctx)).toBe(false);
    expect(isItemReadable({ kind: 'pick', wordId: 'cat', optionIds: ['cat', 'cut'] }, ctx)).toBe(
      false,
    );
    expect(isItemReadable({ kind: 'match', sentenceId: 'nope', choices: [] }, ctx)).toBe(false);
    const sh = { spelling: 'sh', soundId: 'sh', patternId: 'dig_sh', continuous: true };
    expect(
      isItemReadable({ kind: 'warmup', variant: 'hear', target: sh, options: [sh] }, ctx),
    ).toBe(false);
  });
});

describe('property: only readable items are ever emitted', () => {
  const allPatterns = CONTENT.patterns.map((p) => p.id);
  const allHearts = CONTENT.heartWords.map((h) => h.id);
  const allWords = CONTENT.words.map((w) => w.id);
  const unlockArb = fc.record({
    levels: fc.subarray([1, 2, 3, 4, 5, 6, 7, 8]),
    extraPatterns: fc.subarray(allPatterns, { maxLength: 6 }),
    lockedPatterns: fc.subarray(allPatterns, { maxLength: 6 }),
    heartWords: fc.subarray(allHearts),
  });

  it('holds over random unlock states, histories, lengths and audio states', () => {
    fc.assert(
      fc.property(
        unlockArb,
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        fc.constantFrom(4 as const, 6 as const, 8 as const),
        fc.boolean(),
        fc.array(
          fc.record({
            id: fc.constantFrom(...allWords),
            box: fc.constantFrom(1 as const, 2 as const, 3 as const, 4 as const, 5 as const),
            due: fc.integer({ min: -5, max: 5 }),
            days: fc.integer({ min: 0, max: 4 }),
            ok: fc.boolean(),
          }),
          { maxLength: 40 },
        ),
        (unlock, seed, minutes, audioAvailable, history) => {
          const cards = new Map(
            history.map((h) => [h.id, card(h.id, h.box, T0 + h.due * DAY, h.days)]),
          );
          const attempts = history.map((h, i) =>
            attempt({ itemId: h.id, outcome: h.ok ? 'correct' : 'modeled', ts: T0 - i * 1000 }),
          );
          const plan = buildSession(
            input({ unlock, minutes, audioAvailable, cards, attempts, rng: createRng(seed) }),
          );
          for (const item of [...plan.items, ...plan.fillers]) expectReadable(item, unlock);
          // The closer may fall back to a default sound only when nothing at all is unlocked.
          if (plan.items.length > 0) expectReadable(plan.closer, unlock);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('holds at every level of the default sequence', () => {
    for (let level = 1; level <= 8; level += 1) {
      for (let seed = 0; seed < 10; seed += 1) {
        const unlock = unlockAt(level);
        const plan = buildSession(input({ unlock, rng: createRng(seed) }));
        expect(plan.items.length).toBeGreaterThan(8);
        for (const item of [...plan.items, plan.closer]) expectReadable(item, unlock);
      }
    }
  });
});
