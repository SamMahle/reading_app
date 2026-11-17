import { describe, expect, it } from 'vitest';
import {
  buildLexicon,
  displayForm,
  findEntry,
  requiredPatterns,
  unlockedPatterns,
  unlockForLevel,
  wordLevel,
} from '@/engine/lexicon';
import {
  classifyWord,
  isReadable,
  isReadableAfterPreTeach,
  partitionReadable,
} from '@/engine/readability';
import { tokenize } from '@/engine/tokenize';
import type { HeartWordEntry, WordEntry } from '@/engine/types';
import { CONTENT, defaultUnlock, LEX, unlockAt, word } from './helpers';

/** Spec §6.6 test fixture. */
const FIXTURE =
  'I see Pam. She has a cat. The cat sits on the mat. Pam can pat the cat. Pam and her friend go to the pond. They stop at the top. I like to see Pam and her cat run.';

describe('classifyWord', () => {
  const unlock = defaultUnlock();

  it('classifies the spec fixture exactly as specified', () => {
    const byClass: Record<string, string[]> = {
      decodable: [],
      heart: [],
      not_yet: [],
      unknown: [],
    };
    for (const token of tokenize(FIXTURE)) {
      const { cls } = classifyWord(token.word, unlock, LEX);
      if (!byClass[cls]?.includes(token.key)) byClass[cls]?.push(token.key);
    }
    expect(byClass).toMatchInlineSnapshot(`
      {
        "decodable": [
          "pam",
          "cat",
          "on",
          "mat",
          "can",
          "pat",
          "at",
          "top",
        ],
        "heart": [
          "i",
          "see",
          "she",
          "has",
          "a",
          "the",
          "her",
          "friend",
          "go",
          "to",
          "they",
          "like",
        ],
        "not_yet": [
          "sits",
          "and",
          "pond",
          "stop",
          "run",
        ],
        "unknown": [],
      }
    `);
  });

  it('names the missing patterns for each not-yet word in the fixture', () => {
    const missing = (w: string) => classifyWord(w, unlock, LEX).missingPatterns;
    expect(missing('sits')).toEqual(['suffix_s']);
    expect(missing('and')).toEqual(['blend_final']);
    expect(missing('pond')).toEqual(['blend_final']);
    expect(missing('stop')).toEqual(['blend_initial']);
    expect(missing('run')).toEqual(['short_u']);
  });

  it('returns unknown for words outside the lexicon', () => {
    expect(classifyWord('xylophone', unlock, LEX)).toEqual({ cls: 'unknown', missingPatterns: [] });
  });

  it('treats a locked heart word as not yet', () => {
    const result = classifyWord('moon', unlock, LEX);
    expect(result.cls).toBe('not_yet');
    expect(result.missingPatterns).toEqual(['vt_oo']);
    const on = { ...unlock, heartWords: [...unlock.heartWords, 'moon'] };
    expect(classifyWord('Moon!', on, LEX).cls).toBe('heart');
  });

  it('honours individual pattern locks and unlocks', () => {
    const locked = { ...unlock, lockedPatterns: ['short_o'] };
    expect(classifyWord('dog', locked, LEX).cls).toBe('not_yet');
    const extra = { ...unlock, extraPatterns: ['short_u'] };
    expect(classifyWord('run', extra, LEX).cls).toBe('decodable');
  });
});

describe('isReadable', () => {
  it('accepts the fixture only once every pattern is unlocked', () => {
    expect(isReadable(FIXTURE, defaultUnlock(), LEX).ok).toBe(false);
    expect(isReadable(FIXTURE, unlockAt(7), LEX).ok).toBe(true);
  });

  it('fails a deliberately bad sentence and names the missing patterns', () => {
    const result = isReadable('The ship stops at the sun, Zorg!', defaultUnlock(), LEX);
    expect(result.ok).toBe(false);
    expect(result.offenders).toEqual([
      { token: 'ship', cls: 'not_yet', missingPatterns: ['dig_sh'] },
      { token: 'stops', cls: 'unknown', missingPatterns: [] },
      { token: 'sun', cls: 'not_yet', missingPatterns: ['short_u'] },
      { token: 'Zorg', cls: 'unknown', missingPatterns: [] },
    ]);
  });

  it('accepts not-yet words only after they are pre-taught', () => {
    const unlock = defaultUnlock();
    const text = 'The cat sits on the mat.';
    expect(isReadableAfterPreTeach(text, unlock, LEX, new Set()).ok).toBe(false);
    expect(isReadableAfterPreTeach(text, unlock, LEX, new Set(['sits'])).ok).toBe(true);
  });

  it('partitions sentences into shown and refused for the runtime gate', () => {
    const unlock = defaultUnlock();
    const sentences = [
      { text: 'The cat sat.' },
      { text: 'The cat sits.' },
      { text: 'The sun is hot.' },
    ];
    const plain = partitionReadable(sentences, unlock, LEX);
    expect(plain.shown).toEqual([{ text: 'The cat sat.' }]);
    expect(plain.refused.map((r) => r.offenders[0]?.token)).toEqual(['sits', 'sun']);
    const taught = partitionReadable(sentences, unlock, LEX, new Set(['sits']));
    expect(taught.shown).toHaveLength(2);
  });

  it('is true for empty text', () => {
    expect(isReadable('', defaultUnlock(), LEX)).toEqual({ ok: true, offenders: [] });
  });
});

describe('lexicon helpers', () => {
  it('lets custom entries override bundled ones in both directions', () => {
    const and: HeartWordEntry = {
      id: 'and',
      text: 'and',
      graphemes: word('and').graphemes,
      irregularIdx: [],
      unlockLevel: 1,
      audioWord: 'wd_and',
      isHeartWord: true,
    };
    const is: WordEntry = {
      id: 'is',
      text: 'is',
      graphemes: LEX.heartWords.get('is')?.graphemes ?? [],
    };
    const lex = buildLexicon(CONTENT.levels, CONTENT.words, CONTENT.heartWords, [and, is]);
    expect(lex.words.has('and')).toBe(false);
    expect(findEntry('and', lex)?.isHeartWord).toBe(true);
    expect(lex.heartWords.has('is')).toBe(false);
    const unlock = { ...defaultUnlock(), heartWords: [...defaultUnlock().heartWords, 'and'] };
    expect(classifyWord('and', unlock, lex).cls).toBe('heart');
  });

  it('computes unlocked patterns, required patterns and word levels', () => {
    const patterns = unlockedPatterns(
      { levels: [2], extraPatterns: ['dig_sh'], lockedPatterns: ['short_o'], heartWords: [] },
      LEX.levels,
    );
    expect([...patterns]).toEqual(['dig_sh']);
    expect(requiredPatterns(word('stop'))).toEqual([
      'cons_s',
      'cons_t',
      'short_o',
      'cons_p',
      'blend_initial',
    ]);
    expect(wordLevel(word('cat'), LEX.levels)).toBe(1);
    expect(wordLevel(word('chips'), LEX.levels)).toBe(4);
    expect(
      wordLevel(
        {
          id: 'kit',
          text: 'kit',
          graphemes: [{ spelling: 'k', soundId: 'k', patternId: 'cons_k', continuous: false }],
        },
        LEX.levels,
      ),
    ).toBeUndefined();
  });

  it('builds the per-level validation unlock state', () => {
    const unlock = unlockForLevel(2, LEX);
    expect(unlock.levels).toEqual([1, 2]);
    expect(unlock.heartWords).toHaveLength(19);
    expect(unlock.heartWords).not.toContain('moon');
    expect(unlockForLevel(2, LEX, ['moon']).heartWords).toContain('moon');
  });

  it('shows names capitalised and "I" in upper case', () => {
    expect(displayForm(word('pam'))).toBe('Pam');
    expect(displayForm(word('cat'))).toBe('cat');
    const i = LEX.heartWords.get('i');
    expect(i && displayForm(i)).toBe('I');
    const the = LEX.heartWords.get('the');
    expect(the && displayForm(the)).toBe('the');
  });
});
