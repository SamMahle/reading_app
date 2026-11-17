import { describe, expect, it } from 'vitest';
import { requiredClips, soundClipsForLevel, soundClipsForUnlock } from '@/content/audioManifest';
import { validateContent } from '@/content/validate';
import type { ContentBundle } from '@/content/index';
import { CONTENT, defaultUnlock } from './helpers';

const withContent = (patch: Partial<ContentBundle>): ContentBundle => ({ ...CONTENT, ...patch });

describe('bundled content', () => {
  it('passes every validation rule', () => {
    expect(validateContent(CONTENT)).toEqual([]);
  });

  it('starts with Levels 1–3 and the 19 non-decodable starting heart words unlocked', () => {
    const unlock = defaultUnlock();
    expect(unlock.levels).toEqual([1, 2, 3]);
    expect(unlock.heartWords).toHaveLength(19);
    expect(unlock.heartWords).not.toContain('can'); // decodable: a regular word
    expect(CONTENT.words.some((w) => w.id === 'can')).toBe(true);
    for (const bonus of ['star', 'moon', 'fairy', 'princess'])
      expect(unlock.heartWords).not.toContain(bonus);
  });

  it('fails a deliberately bad sentence and names the missing patterns', () => {
    const bad = { id: 'bad', text: 'The ship is in the sun.', levelId: 3 };
    const errors = validateContent(withContent({ sentences: [...CONTENT.sentences, bad] }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('not readable at Level 3');
    expect(errors[0]).toContain('"ship" (not_yet: missing dig_sh)');
    expect(errors[0]).toContain('"sun" (not_yet: missing short_u)');
  });

  it('catches structural mistakes', () => {
    const cat = CONTENT.words.find((w) => w.id === 'cat');
    const story = CONTENT.stories[0];
    if (!cat || !story) throw new Error('fixture missing');
    const errors = validateContent(
      withContent({
        words: [
          ...CONTENT.words,
          cat,
          {
            id: 'cot2',
            text: 'cot',
            graphemes: cat.graphemes,
            pictureId: 'nope',
            requires: ['nope'],
            minimalPairs: ['nope'],
          },
          {
            id: 'bad',
            text: 'm',
            graphemes: [{ spelling: 'm', soundId: 'nope', patternId: 'nope', continuous: true }],
          },
          {
            id: 'tt',
            text: 't',
            graphemes: [{ spelling: 't', soundId: 't', patternId: 'cons_t', continuous: true }],
          },
          { id: 'the', text: 'the', graphemes: [] },
        ],
        heartWords: [
          ...CONTENT.heartWords,
          {
            id: 'hx',
            text: 'a',
            graphemes: cat.graphemes.slice(1, 2),
            irregularIdx: [5],
            unlockLevel: 1,
            audioWord: 'wd_hx',
            isHeartWord: true,
          },
        ],
        sentences: [
          { id: 's001', text: 'The cat sat in a bag.', levelId: 1 },
          { id: 's001', text: 'A cat.', levelId: 2, scene: { subject: 'nope' } },
        ],
        stories: [{ ...story, title: 'Zorg', pages: [[]], sticker: 'nope' }],
        levels: [...CONTENT.levels, { id: 9, title: 'x', patterns: ['nope'] }],
        patterns: [
          ...CONTENT.patterns,
          {
            id: 'px',
            label: 'x',
            group: 'future',
            graphemes: [{ spelling: 'x', soundId: 'nope' }],
          },
        ],
      }),
    );
    const expectError = (fragment: string) =>
      expect(
        errors.some((e) => e.includes(fragment)),
        fragment,
      ).toBe(true);
    for (const fragment of [
      'word "cat": duplicate id',
      'graphemes spell "cat", not "cot"',
      'unknown picture "nope"',
      'unknown required pattern "nope"',
      'minimal pair "nope"',
      'unknown sound "nope"',
      'unknown pattern "nope"',
      'continuous flag disagrees',
      'both a regular word and a heart word',
      'irregularIdx out of range',
      'sentence s001: duplicate id',
      'has 2 words',
      'higher than the text requires',
      'unknown scene picture "nope"',
      'title not readable',
      'has 1 pages',
      'unknown sticker "nope"',
      'page 1 has 0 sentences',
      'Level 9: unknown pattern',
      'pattern px: unknown sound',
      'seed content: 2 sentences',
      'seed content: 1 stories',
    ])
      expectError(fragment);
    expect(
      validateContent(
        withContent({ words: CONTENT.words.slice(0, 20), sentences: [], stories: [] }),
      ).some((e) => e.includes('words for Levels 1–5')),
    ).toBe(true);
  });
});

describe('audio manifest', () => {
  it('lists a clip for every sound in use, every word and every prompt', () => {
    const clips = requiredClips(CONTENT);
    const ids = new Set(clips.map((c) => c.clipId));
    expect(ids.size).toBe(clips.length);
    for (const id of [
      'snd_m',
      'snd_a_short',
      'snd_th_voiced',
      'snd_schwa',
      'snd_air',
      'wd_cat',
      'wd_i',
      'pr_tap_sounds',
    ])
      expect(ids.has(id), id).toBe(true);
    expect(ids.has('snd_j')).toBe(false); // no bundled word uses /j/
    expect(clips.find((c) => c.clipId === 'snd_m')).toMatchObject({ kind: 'sound', levelId: 1 });
    expect(clips.find((c) => c.clipId === 'snd_sh')?.levelId).toBe(5);
    expect(clips.find((c) => c.clipId === 'snd_schwa')?.levelId).toBeUndefined();
    expect(clips.find((c) => c.clipId === 'wd_i')?.label).toBe('I');
    expect(clips.filter((c) => c.kind === 'prompt')).toHaveLength(CONTENT.prompts.length);
  });

  it('includes clips for parent-added words', () => {
    const custom = {
      id: 'jam',
      text: 'jam',
      graphemes: [{ spelling: 'j', soundId: 'j', patternId: 'cons_j', continuous: false }],
    };
    const ids = requiredClips(CONTENT, [custom]).map((c) => c.clipId);
    expect(ids).toContain('snd_j');
    expect(ids).toContain('wd_jam');
  });

  it('knows which sound clips a level and an unlock state need', () => {
    expect(soundClipsForLevel(5, CONTENT)).toEqual(['snd_sh']);
    expect(soundClipsForLevel(3, CONTENT).sort()).toEqual([
      'snd_ch',
      'snd_th_unvoiced',
      'snd_th_voiced',
    ]);
    expect(soundClipsForLevel(7, CONTENT)).toEqual([]);
    expect(soundClipsForLevel(99, CONTENT)).toEqual([]);
    const now = soundClipsForUnlock(defaultUnlock(), CONTENT);
    expect(now).toContain('snd_o_short');
    expect(now).toContain('snd_schwa'); // from heart words
    expect(now).not.toContain('snd_u_short');
    expect(now).not.toContain('snd_air');
    expect(soundClipsForUnlock({ ...defaultUnlock(), heartWords: ['fairy'] }, CONTENT)).toContain(
      'snd_air',
    );
  });
});
