import { describe, expect, it } from 'vitest';
import { heartIdx } from '@/engine/heart';
import { findEntry } from '@/engine/lexicon';
import { LEX, unlockAt } from './helpers';

/** Expected heart marks (grapheme indexes) for the 20 starting words at Levels 3, 4 and 5. */
const EXPECTED: Record<string, [number[], number[], number[]]> = {
  can: [[], [], []], // decodable: stored as a regular word
  is: [[1], [], []], // s as /z/ unlocks at Level 4
  has: [[2], [], []],
  the: [[1], [1], [1]],
  they: [[1], [1], [1]],
  he: [[1], [1], [1]],
  we: [
    [0, 1],
    [0, 1],
    [0, 1],
  ], // w is not yet taught
  go: [[1], [1], [1]],
  she: [[0, 1], [0, 1], [1]], // sh unlocks at Level 5; e stays
  see: [[1], [1], [1]],
  eat: [[0], [0], [0]],
  like: [
    [1, 2],
    [1, 2],
    [1, 2],
  ], // i_e and k
  her: [[1], [1], [1]],
  i: [[0], [0], [0]],
  a: [[0], [0], [0]],
  to: [[1], [1], [1]],
  was: [
    [0, 1, 2],
    [0, 1],
    [0, 1],
  ],
  are: [[0], [0], [0]],
  down: [[1], [1], [1]],
  friend: [[2], [2], [2]],
};

describe('heartIdx', () => {
  it('covers all 20 starting heart words', () => {
    expect(Object.keys(EXPECTED)).toHaveLength(20);
  });

  it.each([3, 4, 5])('marks every heart word correctly at Level %i', (level) => {
    const unlock = unlockAt(level);
    for (const [id, marks] of Object.entries(EXPECTED)) {
      const entry = findEntry(id, LEX);
      expect(entry, id).toBeDefined();
      if (entry)
        expect(heartIdx(entry, unlock, LEX.levels), `${id} at Level ${level}`).toEqual(
          marks[level - 3],
        );
    }
  });

  it('drops the i_e heart on "like" once Level 8 is unlocked, and k when k is taught', () => {
    const like = findEntry('like', LEX);
    if (!like) throw new Error('missing like');
    expect(heartIdx(like, unlockAt(8), LEX.levels)).toEqual([2]);
    expect(heartIdx(like, { ...unlockAt(8), extraPatterns: ['cons_k'] }, LEX.levels)).toEqual([]);
  });
});
