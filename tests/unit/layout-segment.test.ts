import { describe, expect, it } from 'vitest';
import { graphemeLetters, isSplitDigraph, layoutWord, spellingOf } from '@/engine/layout';
import { listUnlockedGraphemes, isVowelPattern } from '@/engine/graphemes';
import { unlockedPatterns } from '@/engine/lexicon';
import { buildGraphemeTable, proposeSegmentation, requiresFor } from '@/engine/segment';
import { PATTERN_MAP } from '@/content/index';
import { CONTENT, defaultUnlock, LEX, word } from './helpers';

const table = buildGraphemeTable(CONTENT.patterns, CONTENT.sounds);
const spell = (w: string) =>
  proposeSegmentation(w, table).graphemes.map((g) => `${g.spelling}:${g.soundId}`);

describe('layoutWord', () => {
  it('lays out a plain word one cell per grapheme', () => {
    const cells = layoutWord('Chip', word('chip').graphemes);
    expect(cells?.map((c) => c.text)).toEqual(['Ch', 'i', 'p']);
    expect(cells?.every((c) => !c.silent && !c.split)).toBe(true);
  });

  it('gives the split digraph in "like" a vowel cell and a silent e cell', () => {
    const like = LEX.heartWords.get('like');
    const cells = layoutWord('like', like?.graphemes ?? []);
    expect(cells).toEqual([
      { graphemeIdx: 0, text: 'l', silent: false, split: false },
      { graphemeIdx: 1, text: 'i', silent: false, split: true },
      { graphemeIdx: 2, text: 'k', silent: false, split: false },
      { graphemeIdx: 1, text: 'e', silent: true, split: true },
    ]);
  });

  it('handles a split digraph that ends the grapheme list', () => {
    const graphemes = [
      { spelling: 'i_e', soundId: 'i_long', patternId: 'vce_i', continuous: true },
    ];
    expect(spellingOf(graphemes)).toBe('ie');
    expect(layoutWord('ie', graphemes)?.map((c) => c.silent)).toEqual([false, true]);
  });

  it('rejects a segmentation that does not spell the word', () => {
    expect(layoutWord('cot', word('cat').graphemes)).toBeUndefined();
  });

  it('spells every bundled entry from its graphemes', () => {
    for (const entry of [...LEX.words.values(), ...LEX.heartWords.values()]) {
      expect(spellingOf(entry.graphemes).toLowerCase(), entry.id).toBe(entry.text.toLowerCase());
    }
  });

  it('recognises split digraph spellings', () => {
    expect(isSplitDigraph('a_e')).toBe(true);
    expect(isSplitDigraph('ae')).toBe(false);
    expect(graphemeLetters('i_e')).toBe('ie');
  });
});

describe('proposeSegmentation', () => {
  it('prefers digraphs over single letters', () => {
    expect(spell('chip')).toEqual(['ch:ch', 'i:i_short', 'p:p']);
    expect(spell('fish')).toEqual(['f:f', 'i:i_short', 'sh:sh']);
    expect(spell('duck')).toEqual(['d:d', 'u:u_short', 'ck:k']);
  });

  it('proposes a split digraph for consonant-vowel-consonant-e words', () => {
    expect(spell('cake')).toEqual(['c:k', 'a_e:a_long', 'k:k']);
    expect(spell('shine')).toEqual(['sh:sh', 'i_e:i_long', 'n:n']);
    expect(spell('the')).toEqual(['th:th_unvoiced', 'e:e_short']);
    expect(spell('here')).toEqual(['h:h', 'er:er', 'e:e_short']);
  });

  it('reads a final s after a consonant as the -s ending, voiced or not', () => {
    const cats = proposeSegmentation('cats', table).graphemes.at(-1);
    const dogs = proposeSegmentation('dogs', table).graphemes.at(-1);
    const gas = proposeSegmentation('gas', table).graphemes.at(-1);
    expect(cats).toMatchObject({ soundId: 's', patternId: 'suffix_s' });
    expect(dogs).toMatchObject({ soundId: 'z', patternId: 'suffix_s_z' });
    expect(gas).toMatchObject({ soundId: 's', patternId: 'cons_s' });
  });

  it('flags blends as word-level requirements', () => {
    expect(proposeSegmentation('stop', table).requires).toEqual(['blend_initial']);
    expect(proposeSegmentation('pond', table).requires).toEqual(['blend_final']);
    expect(proposeSegmentation('stamp', table).requires).toEqual(['blend_initial', 'blend_final']);
    expect(proposeSegmentation('chips', table).requires).toEqual([]);
    expect(proposeSegmentation('mm', table).requires).toEqual([]);
    expect(requiresFor(word('hand').graphemes, table)).toEqual(['blend_final']);
  });

  it('reports letters it cannot match and normalises case', () => {
    const result = proposeSegmentation('  Café ', table);
    expect(result.unmatched).toEqual(['é']);
    expect(result.graphemes.map((g) => g.spelling)).toEqual(['c', 'a', 'f']);
  });

  it('offers every reading of an ambiguous spelling, taught ones first', () => {
    expect(table.optionsFor('s').map((o) => o.patternId)).toEqual([
      'cons_s',
      'suffix_s',
      'suffix_s_z',
    ]);
    expect(table.optionsFor('th').map((o) => o.soundId)).toEqual(['th_unvoiced', 'th_voiced']);
    expect(table.optionsFor('zz')).toEqual([]);
    expect(table.isVowelSound('a_short')).toBe(true);
    expect(table.isVowelSound('m')).toBe(false);
  });

  it('reproduces the hand-verified segmentation of most bundled words', () => {
    const words = [...LEX.words.values()];
    const same = words.filter((w) => {
      const proposal = proposeSegmentation(w.text, table).graphemes;
      return (
        proposal.length === w.graphemes.length &&
        proposal.every((g, i) => g.spelling === w.graphemes[i]?.spelling)
      );
    });
    expect(same.length / words.length).toBeGreaterThan(0.95);
  });
});

describe('listUnlockedGraphemes', () => {
  it('lists only taught spellings', () => {
    const unlocked = unlockedPatterns(defaultUnlock(), LEX.levels);
    const graphemes = listUnlockedGraphemes(CONTENT.patterns, CONTENT.sounds, unlocked);
    const spellings = graphemes.map((g) => g.spelling);
    expect(spellings).toContain('ch');
    expect(spellings).toContain('o');
    expect(spellings).not.toContain('sh');
    expect(spellings).not.toContain('u');
    expect(graphemes.find((g) => g.spelling === 'm')?.continuous).toBe(true);
    expect(graphemes.find((g) => g.spelling === 't')?.continuous).toBe(false);
  });

  it('falls back to a stop sound when a sound is not defined', () => {
    const [g] = listUnlockedGraphemes(
      [
        {
          id: 'p1',
          label: 'x',
          group: 'consonant',
          graphemes: [{ spelling: 'x', soundId: 'nope' }],
        },
      ],
      [],
      new Set(['p1']),
    );
    expect(g?.continuous).toBe(false);
    expect(
      buildGraphemeTable(
        [
          {
            id: 'p1',
            label: 'x',
            group: 'consonant',
            graphemes: [{ spelling: 'x', soundId: 'nope' }],
          },
        ],
        [],
      ).optionsFor('x')[0]?.continuous,
    ).toBe(false);
  });

  it('identifies vowel patterns', () => {
    expect(isVowelPattern(PATTERN_MAP.get('short_a'))).toBe(true);
    expect(isVowelPattern(PATTERN_MAP.get('vce_i'))).toBe(true);
    expect(isVowelPattern(PATTERN_MAP.get('cons_m'))).toBe(false);
    expect(isVowelPattern(undefined)).toBe(false);
  });
});
