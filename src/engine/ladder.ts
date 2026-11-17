import { endsPhrase, tokenize, type Token } from './tokenize';
import type { LadderState, Rung, Sentence } from './types';

/**
 * Coach text-load ladder (spec §9.2). The rung decides how much text is
 * visible at once in the focus reader.
 */
export const LADDER = {
  startRung: 2 as Rung,
  moveUpAccuracy: 0.9,
  moveUpSessions: 2,
  moveDownAccuracy: 0.8,
} as const;

export function initialLadder(ts: number): LadderState {
  return {
    rung: LADDER.startRung,
    streak: 0,
    history: [{ ts, rung: LADDER.startRung, reason: 'start' }],
  };
}

function clampRung(value: number): Rung {
  return Math.min(5, Math.max(1, value)) as Rung;
}

/**
 * Apply one finished Coach session.
 * Up after 2 consecutive sessions at >= 90%; down after one session below 80%.
 */
export function applyCoachSession(state: LadderState, accuracy: number, ts: number): LadderState {
  if (accuracy < LADDER.moveDownAccuracy) {
    const rung = clampRung(state.rung - 1);
    const history =
      rung === state.rung
        ? state.history
        : [...state.history, { ts, rung, reason: 'down' as const }];
    return { rung, streak: 0, history };
  }
  if (accuracy >= LADDER.moveUpAccuracy) {
    const streak = state.streak + 1;
    if (streak < LADDER.moveUpSessions) return { ...state, streak };
    const rung = clampRung(state.rung + 1);
    const history =
      rung === state.rung ? state.history : [...state.history, { ts, rung, reason: 'up' as const }];
    return { rung, streak: 0, history };
  }
  return { ...state, streak: 0 };
}

/** A manual parent override. It is always logged. */
export function overrideRung(state: LadderState, rung: Rung, ts: number): LadderState {
  return { rung, streak: 0, history: [...state.history, { ts, rung, reason: 'override' }] };
}

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

export interface ReaderWord {
  sentenceIdx: number;
  tokenIdx: number;
  token: Token;
}

export interface Chunk {
  /** Index of the first word (into the page's flat word list). */
  start: number;
  /** One past the last word. */
  end: number;
}

export interface PageLayout {
  words: ReaderWord[];
  chunks: Chunk[];
  /** Flat word index where each sentence starts. */
  sentenceStarts: number[];
}

/** Words that comfortably start a new phrase. */
const PHRASE_STARTERS = new Set(['on', 'in', 'at', 'to', 'and', 'with', 'but', 'down']);

const MIN_PHRASE = 2;
const MAX_PHRASE = 4;

/**
 * Phrase-break heuristic (spec §9.1): break at punctuation, then aim for
 * 2–4 words. Returns the token indexes where a new phrase starts.
 */
export function phraseBreaks(tokens: readonly Token[]): number[] {
  const breaks: number[] = [];
  let runStart = 0;
  const splitRun = (start: number, end: number) => {
    let cursor = start;
    while (end - cursor > MAX_PHRASE) {
      const remaining = end - cursor;
      let size = Math.min(3, remaining - MIN_PHRASE);
      for (let candidate = MAX_PHRASE; candidate >= MIN_PHRASE; candidate -= 1) {
        const next = tokens[cursor + candidate];
        const leaves = remaining - candidate;
        if (next && leaves >= MIN_PHRASE && PHRASE_STARTERS.has(next.key)) {
          size = candidate;
          break;
        }
      }
      cursor += size;
      breaks.push(cursor);
    }
  };
  tokens.forEach((token, i) => {
    const isLast = i === tokens.length - 1;
    if (endsPhrase(token) || isLast) {
      splitRun(runStart, i + 1);
      if (!isLast) breaks.push(i + 1);
      runStart = i + 1;
    }
  });
  return breaks;
}

function sentencePhrases(sentence: Sentence, tokens: readonly Token[]): number[] {
  const breaks = sentence.chunks ?? phraseBreaks(tokens);
  return breaks.filter((b) => b > 0 && b < tokens.length).sort((a, b) => a - b);
}

/** Lay one page out as chunks for the given rung. */
export function chunkPage(sentences: readonly Sentence[], rung: Rung): PageLayout {
  const words: ReaderWord[] = [];
  const sentenceStarts: number[] = [];
  const phraseStarts: number[] = [];
  sentences.forEach((sentence, sentenceIdx) => {
    const tokens = tokenize(sentence.text);
    const offset = words.length;
    sentenceStarts.push(offset);
    phraseStarts.push(offset, ...sentencePhrases(sentence, tokens).map((b) => offset + b));
    tokens.forEach((token, tokenIdx) => words.push({ sentenceIdx, tokenIdx, token }));
  });

  let starts: number[];
  switch (rung) {
    case 1:
      starts = words.map((_, i) => i);
      break;
    case 2:
      starts = phraseStarts;
      break;
    case 3:
      starts = sentenceStarts;
      break;
    case 4:
      starts = sentenceStarts.filter((_, i) => i % 2 === 0);
      break;
    case 5:
      starts = words.length > 0 ? [0] : [];
      break;
  }
  const unique = [...new Set(starts)].filter((s) => s < words.length).sort((a, b) => a - b);
  const chunks = unique.map((start, i) => ({ start, end: unique[i + 1] ?? words.length }));
  return { words, chunks, sentenceStarts };
}
