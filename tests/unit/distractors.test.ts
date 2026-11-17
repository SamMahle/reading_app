import { describe, expect, it } from 'vitest';
import {
  buildTiles,
  findMinimalPairs,
  isMinimalPair,
  pickWordOptions,
  relationLayout,
  sceneChoices,
  sceneDistractors,
  sceneVisualKey,
  warmupOptions,
} from '@/engine/distractors';
import { listUnlockedGraphemes } from '@/engine/graphemes';
import { unlockedPatterns } from '@/engine/lexicon';
import { classifyWord } from '@/engine/readability';
import { createRng } from '@/engine/rng';
import type { Scene } from '@/engine/types';
import { CONTENT, defaultUnlock, LEX, PICTURES, unlockAt, word } from './helpers';

const unlock = defaultUnlock();
const graphemes = listUnlockedGraphemes(
  CONTENT.patterns,
  CONTENT.sounds,
  unlockedPatterns(unlock, LEX.levels),
);
const POOL = ['cat', 'dog', 'pig', 'rat', 'hat', 'mat', 'log', 'bag'];

describe('minimal pairs', () => {
  it('requires exactly one differing grapheme', () => {
    expect(isMinimalPair(word('cat'), word('cot'))).toBe(true);
    expect(isMinimalPair(word('cat'), word('cat'))).toBe(false);
    expect(isMinimalPair(word('cat'), word('dog'))).toBe(false);
    expect(isMinimalPair(word('cat'), word('chat'))).toBe(true); // c vs ch is one grapheme
    expect(isMinimalPair(word('cat'), word('cats'))).toBe(false);
  });

  it('returns only real words that are decodable right now', () => {
    const pairs = findMinimalPairs(word('cat'), LEX, unlock);
    expect(pairs.length).toBeGreaterThanOrEqual(2);
    for (const pair of pairs) {
      expect(isMinimalPair(word('cat'), pair)).toBe(true);
      expect(classifyWord(pair.text, unlock, LEX).cls).toBe('decodable');
      expect(pair.tags ?? []).not.toContain('name');
    }
    expect(pairs.map((p) => p.id)).not.toContain('cut'); // short u is locked (and not bundled)
    expect(findMinimalPairs(word('ship'), LEX, unlock).map((p) => p.id)).not.toContain('shop');
    expect(findMinimalPairs(word('ship'), LEX, unlockAt(5)).map((p) => p.id)).toContain('shop');
  });

  it('builds a shuffled set of target plus two pairs, hand-listed pairs first', () => {
    const target = { ...word('cat'), minimalPairs: ['cot', 'bat'] };
    for (let seed = 0; seed < 20; seed += 1) {
      const options = pickWordOptions(target, LEX, unlock, createRng(seed));
      expect(options?.map((o) => o.id).sort()).toEqual(['bat', 'cat', 'cot']);
    }
  });

  it('returns undefined when fewer than two pairs exist', () => {
    const few = {
      levels: [],
      extraPatterns: ['cons_c', 'cons_m', 'cons_t', 'short_a'],
      lockedPatterns: [],
      heartWords: [],
    };
    expect(findMinimalPairs(word('cat'), LEX, few).map((p) => p.id)).toEqual(['mat']);
    expect(pickWordOptions(word('cat'), LEX, few, createRng(1))).toBeUndefined();
  });
});

describe('tiles and warm-up options', () => {
  it('gives the word graphemes plus exactly two distractors, one a vowel', () => {
    const tiles = buildTiles(word('chip'), graphemes, createRng(3));
    expect(tiles).toHaveLength(5);
    const extras = tiles.map((t) => t.spelling).filter((s) => !['ch', 'i', 'p'].includes(s));
    expect(extras).toHaveLength(2);
    expect(extras.some((s) => ['a', 'o'].includes(s))).toBe(true);
    expect(new Set(tiles.map((t) => t.id)).size).toBe(5);
  });

  it('keeps repeated letters as separate tiles', () => {
    const tiles = buildTiles(word('dad'), graphemes, createRng(1));
    expect(tiles.filter((t) => t.spelling === 'd')).toHaveLength(2);
  });

  it('copes with a pool that has no vowel to offer', () => {
    const consonants = graphemes.filter((g) => !['a', 'i', 'o'].includes(g.spelling));
    expect(buildTiles(word('cat'), consonants, createRng(1))).toHaveLength(5);
  });

  it('offers a target and two different-sounding graphemes of the same kind', () => {
    const target = graphemes.find((g) => g.spelling === 'a');
    if (!target) throw new Error('missing a');
    const options = warmupOptions(target, graphemes, createRng(5));
    expect(options).toHaveLength(3);
    expect(options?.map((o) => o.spelling).sort()).toEqual(['a', 'i', 'o']);
    expect(warmupOptions(target, [target], createRng(5))).toBeUndefined();
  });
});

describe('scene distractors', () => {
  const target: Scene = { subject: 'cat', object: 'mat', relation: 'on' };

  it('changes exactly one element per distractor and stays visually distinct', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const distractors = sceneDistractors(target, POOL, PICTURES, createRng(seed));
      expect(distractors).toHaveLength(2);
      const keys = new Set([sceneVisualKey(target, PICTURES)]);
      for (const d of distractors ?? []) {
        const changed = (['subject', 'object', 'relation'] as const).filter(
          (k) => d.scene[k] !== target[k],
        );
        expect(changed).toEqual([d.changed]);
        keys.add(sceneVisualKey(d.scene, PICTURES));
      }
      expect(keys.size).toBe(3);
    }
  });

  it('uses a relation change some of the time, and never swaps with/next_to', () => {
    const kinds = new Set<string>();
    for (let seed = 0; seed < 80; seed += 1) {
      for (const d of sceneDistractors(target, POOL, PICTURES, createRng(seed)) ?? [])
        kinds.add(d.changed ?? '');
      const withScene: Scene = { subject: 'cat', object: 'hat', relation: 'with' };
      for (const d of sceneDistractors(withScene, POOL, PICTURES, createRng(seed)) ?? [])
        expect(d.changed).not.toBe('relation');
    }
    expect([...kinds].sort()).toEqual(['object', 'relation', 'subject']);
  });

  it('changes only the subject when the scene has no object', () => {
    const alone: Scene = { subject: 'pig', relation: 'none' };
    const distractors = sceneDistractors(alone, POOL, PICTURES, createRng(2));
    expect(distractors?.map((d) => d.changed)).toEqual(['subject', 'subject']);
  });

  it('treats pictures that share a file as the same picture', () => {
    // "dad" and "man" use one drawing, so one cannot stand in for the other.
    const scene: Scene = { subject: 'dad', object: 'hat', relation: 'with' };
    expect(sceneDistractors(scene, ['man'], PICTURES, createRng(1))).toBeUndefined();
    expect(sceneVisualKey({ subject: 'dad' }, PICTURES)).toBe(
      sceneVisualKey({ subject: 'man' }, PICTURES),
    );
  });

  it('returns undefined when the pool is too small', () => {
    expect(sceneChoices(target, ['cat', 'mat'], PICTURES, createRng(1))).toBeUndefined();
    expect(
      sceneDistractors({ subject: 'pig' }, ['unknown_picture'], PICTURES, createRng(1)),
    ).toBeUndefined();
  });

  it('returns three shuffled choices with one correct', () => {
    const choices = sceneChoices(target, POOL, PICTURES, createRng(7));
    expect(choices).toHaveLength(3);
    expect(choices?.filter((c) => c.correct)).toHaveLength(1);
  });

  it('maps relations to layouts', () => {
    expect(relationLayout({ subject: 'cat' })).toBe('alone');
    expect(relationLayout({ subject: 'cat', object: 'mat', relation: 'none' })).toBe('alone');
    expect(relationLayout({ subject: 'cat', object: 'mat' })).toBe('alone');
    expect(relationLayout({ subject: 'cat', object: 'mat', relation: 'in' })).toBe('in');
    expect(relationLayout({ subject: 'cat', object: 'mat', relation: 'with' })).toBe('beside');
    expect(relationLayout({ subject: 'cat', object: 'mat', relation: 'next_to' })).toBe('beside');
  });
});
