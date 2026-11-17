import { findEntry, wordLevel } from './lexicon';
import { classifyWord } from './readability';
import { splitSentences, tokenize, type Token } from './tokenize';
import type {
  AnyEntry,
  Classification,
  HeartWordEntry,
  Lexicon,
  Sentence,
  Story,
  UnlockState,
} from './types';

/** Class Passage support (spec §9.5). */

export interface ClassifiedToken extends Classification {
  token: Token;
}

export interface PassageAnalysis {
  sentences: string[];
  tokens: ClassifiedToken[];
  /** Unique lookup keys, in order of first appearance. */
  unknown: string[];
  notYet: string[];
}

export const PASSAGE_SENTENCES_PER_PAGE = 3;

function uniqueKeys(tokens: readonly ClassifiedToken[], cls: Classification['cls']): string[] {
  return [...new Set(tokens.filter((t) => t.cls === cls).map((t) => t.token.key))];
}

/** Classify every token of a pasted passage. */
export function analyzePassage(text: string, unlock: UnlockState, lex: Lexicon): PassageAnalysis {
  const sentences = splitSentences(text);
  const tokens = sentences
    .flatMap((sentence) => tokenize(sentence))
    .map((token) => ({ token, ...classifyWord(token.word, unlock, lex) }));
  return {
    sentences,
    tokens,
    unknown: uniqueKeys(tokens, 'unknown'),
    notYet: uniqueKeys(tokens, 'not_yet'),
  };
}

/** Turn a passage into a paged Story with `source: "class_passage"`. */
export function buildPassageStory(id: string, title: string, text: string, lex: Lexicon): Story {
  const sentences = splitSentences(text);
  const topLevel = Math.max(1, ...lex.levels.map((l) => l.id));
  let levelId = 1;
  for (const token of sentences.flatMap((s) => tokenize(s))) {
    const entry = findEntry(token.key, lex);
    if (entry && entry.isHeartWord !== true) {
      levelId = Math.max(levelId, wordLevel(entry, lex.levels) ?? topLevel);
    }
  }
  const pages: Sentence[][] = [];
  sentences.forEach((sentenceText, i) => {
    const sentence: Sentence = { id: `${id}_s${i + 1}`, text: sentenceText, levelId };
    const page = pages[Math.floor(i / PASSAGE_SENTENCES_PER_PAGE)];
    if (page) page.push(sentence);
    else pages.push([sentence]);
  });
  return { id, title, levelId, pages, source: 'class_passage' };
}

/** The lexicon as seen while reading one passage: its one-time heart words added. */
export function withOneTimeHeartWords(lex: Lexicon, oneTime: readonly HeartWordEntry[]): Lexicon {
  if (oneTime.length === 0) return lex;
  const words = new Map(lex.words);
  const heartWords = new Map(lex.heartWords);
  for (const entry of oneTime) {
    words.delete(entry.id);
    heartWords.set(entry.id, entry);
  }
  return { words, heartWords, levels: lex.levels };
}

/**
 * The words to pre-teach before a passage is read: every `not_yet` word and
 * every one-time heart word, once each, in reading order. `lex` must already
 * include the passage's one-time heart words (which are never unlocked, so
 * they classify as `not_yet`).
 */
export function preTeachEntries(story: Story, unlock: UnlockState, lex: Lexicon): AnyEntry[] {
  const entries = new Map<string, AnyEntry>();
  for (const sentence of story.pages.flat()) {
    for (const token of tokenize(sentence.text)) {
      const result = classifyWord(token.word, unlock, lex);
      if (result.cls === 'not_yet' && result.entry) entries.set(result.entry.id, result.entry);
    }
  }
  return [...entries.values()];
}

/** Lookup keys still unknown: the passage cannot be read until these are resolved. */
export function unresolvedWords(story: Story, unlock: UnlockState, lex: Lexicon): string[] {
  const text = story.pages
    .flat()
    .map((s) => s.text)
    .join(' ');
  return analyzePassage(text, unlock, lex).unknown;
}
