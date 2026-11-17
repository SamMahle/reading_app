import { describe, expect, it } from 'vitest';
import {
  applyCoachSession,
  chunkPage,
  initialLadder,
  overrideRung,
  phraseBreaks,
} from '@/engine/ladder';
import { tokenize } from '@/engine/tokenize';
import type { LadderState, Sentence } from '@/engine/types';
import { T0 } from './helpers';

const s = (text: string, chunks?: number[]): Sentence => ({
  id: text,
  text,
  levelId: 1,
  ...(chunks ? { chunks } : {}),
});
const texts = (sentences: Sentence[], rung: 1 | 2 | 3 | 4 | 5) => {
  const page = chunkPage(sentences, rung);
  return page.chunks.map((c) =>
    page.words
      .slice(c.start, c.end)
      .map((w) => w.token.raw)
      .join(' '),
  );
};

describe('text-load ladder (spec §9.2)', () => {
  it('starts at rung 2', () => {
    expect(initialLadder(T0)).toEqual({
      rung: 2,
      streak: 0,
      history: [{ ts: T0, rung: 2, reason: 'start' }],
    });
  });

  it('moves up only after 2 consecutive sessions at 90% or better', () => {
    let state = initialLadder(T0);
    state = applyCoachSession(state, 0.95, T0 + 1);
    expect(state).toMatchObject({ rung: 2, streak: 1 });
    state = applyCoachSession(state, 0.85, T0 + 2); // breaks the run, no move
    expect(state).toMatchObject({ rung: 2, streak: 0 });
    state = applyCoachSession(state, 0.9, T0 + 3);
    state = applyCoachSession(state, 0.9, T0 + 4);
    expect(state).toMatchObject({ rung: 3, streak: 0 });
    expect(state.history.at(-1)).toEqual({ ts: T0 + 4, rung: 3, reason: 'up' });
  });

  it('moves down after one session below 80%', () => {
    const state = applyCoachSession({ ...initialLadder(T0), streak: 1 }, 0.79, T0 + 1);
    expect(state).toMatchObject({ rung: 1, streak: 0 });
    expect(state.history.at(-1)?.reason).toBe('down');
    expect(applyCoachSession(initialLadder(T0), 0.8, T0 + 1).rung).toBe(2);
  });

  it('never leaves rungs 1–5 and does not log a move that did not happen', () => {
    const bottom: LadderState = { rung: 1, streak: 0, history: [] };
    expect(applyCoachSession(bottom, 0.1, T0)).toEqual({ rung: 1, streak: 0, history: [] });
    const top: LadderState = { rung: 5, streak: 1, history: [] };
    expect(applyCoachSession(top, 1, T0)).toEqual({ rung: 5, streak: 0, history: [] });
  });

  it('logs a manual override', () => {
    const state = overrideRung({ ...initialLadder(T0), streak: 1 }, 4, T0 + 9);
    expect(state.rung).toBe(4);
    expect(state.streak).toBe(0);
    expect(state.history.at(-1)).toEqual({ ts: T0 + 9, rung: 4, reason: 'override' });
  });
});

describe('phraseBreaks', () => {
  const breaks = (text: string) => phraseBreaks(tokenize(text));

  it('keeps a short sentence whole', () => {
    expect(breaks('The cat sat.')).toEqual([]);
    expect(breaks('')).toEqual([]);
  });

  it('breaks at punctuation', () => {
    expect(breaks('Hop, dog, hop!')).toEqual([1, 2]);
  });

  it('splits long runs into 2–4 word phrases, before a preposition when it can', () => {
    expect(breaks('The cat sits on the mat.')).toEqual([3]);
    expect(breaks('Pam and her friend go to the pond.')).toEqual([3, 5]);
    expect(breaks('The big tan cat ran fast.')).toEqual([3]);
    expect(breaks('I see the big tan cat nap')).toEqual([3]);
  });
});

describe('chunkPage', () => {
  const page = [s('The cat sits on the mat.'), s('Pam can pat the cat.'), s('The cat naps.')];

  it('rung 1 shows one word', () => {
    expect(texts(page, 1)).toHaveLength(14);
    expect(texts(page, 1)[0]).toBe('The');
  });

  it('rung 2 shows one phrase', () => {
    expect(texts(page, 2)).toEqual([
      'The cat sits',
      'on the mat.',
      'Pam can pat',
      'the cat.',
      'The cat naps.',
    ]);
  });

  it('rung 3 shows one sentence, rung 4 two, rung 5 the full page', () => {
    expect(texts(page, 3)).toEqual([
      'The cat sits on the mat.',
      'Pam can pat the cat.',
      'The cat naps.',
    ]);
    expect(texts(page, 4)).toEqual([
      'The cat sits on the mat. Pam can pat the cat.',
      'The cat naps.',
    ]);
    expect(texts(page, 5)).toHaveLength(1);
    expect(chunkPage([], 5).chunks).toEqual([]);
  });

  it('prefers authored phrase breaks over the heuristic', () => {
    expect(texts([s('The cat sits on the mat.', [2, 4, 0, 99])], 2)).toEqual([
      'The cat',
      'sits on',
      'the mat.',
    ]);
  });

  it('records where each word and sentence sits', () => {
    const layout = chunkPage(page, 3);
    expect(layout.sentenceStarts).toEqual([0, 6, 11]);
    expect(layout.words[6]).toMatchObject({ sentenceIdx: 1, tokenIdx: 0 });
  });
});
