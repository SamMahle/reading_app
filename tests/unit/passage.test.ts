import { describe, expect, it } from 'vitest';
import {
  analyzePassage,
  buildPassageStory,
  preTeachEntries,
  unresolvedWords,
  withOneTimeHeartWords,
} from '@/engine/passage';
import { isReadableAfterPreTeach } from '@/engine/readability';
import type { HeartWordEntry } from '@/engine/types';
import { defaultUnlock, LEX } from './helpers';

const FIXTURE =
  'I see Pam. She has a cat. The cat sits on the mat. Pam can pat the cat. Pam and her friend go to the pond. They stop at the top. I like to see Pam and her cat run.';
const unlock = defaultUnlock();

describe('class passage (spec §9.5)', () => {
  it('classifies every token and lists the words that need attention', () => {
    const analysis = analyzePassage(`${FIXTURE} Pam said yes.`, unlock, LEX);
    expect(analysis.sentences).toHaveLength(8);
    expect(analysis.tokens).toHaveLength(43);
    expect(analysis.notYet).toEqual(['sits', 'and', 'pond', 'stop', 'run']);
    expect(analysis.unknown).toEqual(['said', 'yes']);
  });

  it('builds a paged class_passage story', () => {
    const story = buildPassageStory('cp_1', 'Pam', FIXTURE, LEX);
    expect(story.source).toBe('class_passage');
    expect(story.pages.map((p) => p.length)).toEqual([3, 3, 1]);
    expect(story.levelId).toBe(7);
    expect(story.pages[0]?.[0]).toEqual({ id: 'cp_1_s1', text: 'I see Pam.', levelId: 7 });
    expect(buildPassageStory('cp_2', 'x', 'Zzz qqq.', LEX).levelId).toBe(1);
  });

  it('pre-teaches each not-yet word once, in reading order', () => {
    const story = buildPassageStory('cp_1', 'Pam', FIXTURE, LEX);
    const entries = preTeachEntries(story, unlock, LEX);
    expect(entries.map((e) => e.id)).toEqual(['sits', 'and', 'pond', 'stop', 'run']);
    const taught = new Set(entries.map((e) => e.id));
    for (const sentence of story.pages.flat()) {
      expect(isReadableAfterPreTeach(sentence.text, unlock, LEX, taught).ok).toBe(true);
    }
  });

  it('adds one-time heart words for a single passage and pre-teaches them', () => {
    const said: HeartWordEntry = {
      id: 'said',
      text: 'said',
      isHeartWord: true,
      irregularIdx: [1],
      unlockLevel: 1,
      audioWord: 'wd_said',
      graphemes: [
        { spelling: 's', soundId: 's', patternId: 'cons_s', continuous: true },
        { spelling: 'ai', soundId: 'e_short', patternId: 'irregular', continuous: true },
        { spelling: 'd', soundId: 'd', patternId: 'cons_d', continuous: false },
      ],
    };
    const story = buildPassageStory('cp_3', 'Pam', 'Pam said and sat.', LEX);
    expect(unresolvedWords(story, unlock, LEX)).toEqual(['said']);
    const and = LEX.words.get('and');
    const lex = withOneTimeHeartWords(LEX, [
      said,
      { ...said, id: 'and', text: 'and', graphemes: and?.graphemes ?? [], irregularIdx: [] },
    ]);
    expect(unresolvedWords(story, unlock, lex)).toEqual([]);
    expect(lex.words.has('and')).toBe(false);
    expect(preTeachEntries(story, unlock, lex).map((e) => e.id)).toEqual(['said', 'and']);
    expect(withOneTimeHeartWords(LEX, [])).toBe(LEX);
    expect(LEX.heartWords.has('said')).toBe(false);
  });
});
