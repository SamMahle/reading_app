import { spellingOf } from '@/engine/layout';
import { buildLexicon, unlockForLevel, wordLevel } from '@/engine/lexicon';
import { isReadable } from '@/engine/readability';
import { tokenize } from '@/engine/tokenize';
import type { AnyEntry, Lexicon, Offender, Sentence } from '@/engine/types';
import type { ContentBundle } from './index';

/** Content rules checked in CI (spec §0.4, §6.4, §6.6). Returns error messages. */

export const SEED_MINIMUMS = { words: 150, sentences: 60, stories: 12, maxLevel: 5 } as const;

function describeOffenders(offenders: readonly Offender[]): string {
  return offenders
    .map(
      (o) =>
        `"${o.token}" (${o.cls}${o.missingPatterns.length ? `: missing ${o.missingPatterns.join(', ')}` : ''})`,
    )
    .join('; ');
}

function checkText(
  text: string,
  levelId: number,
  bonus: readonly string[],
  lex: Lexicon,
): string | undefined {
  const result = isReadable(text, unlockForLevel(levelId, lex, bonus), lex);
  return result.ok ? undefined : describeOffenders(result.offenders);
}

function validateEntries(content: ContentBundle, errors: string[]): void {
  const sounds = new Map(content.sounds.map((s) => [s.id, s]));
  const patterns = new Set(content.patterns.map((p) => p.id));
  const pictures = new Set(content.pictures.map((p) => p.id));
  const ids = new Set<string>();
  const entries: AnyEntry[] = [...content.words, ...content.heartWords];
  for (const entry of entries) {
    const where = `word "${entry.id}"`;
    if (ids.has(entry.id)) errors.push(`${where}: duplicate id`);
    ids.add(entry.id);
    if (spellingOf(entry.graphemes).toLowerCase() !== entry.text.toLowerCase()) {
      errors.push(
        `${where}: graphemes spell "${spellingOf(entry.graphemes)}", not "${entry.text}"`,
      );
    }
    for (const g of entry.graphemes) {
      const sound = sounds.get(g.soundId);
      if (!sound) errors.push(`${where}: unknown sound "${g.soundId}"`);
      else if (sound.continuous !== g.continuous)
        errors.push(
          `${where}: "${g.spelling}" continuous flag disagrees with sound "${g.soundId}"`,
        );
      if (!patterns.has(g.patternId)) errors.push(`${where}: unknown pattern "${g.patternId}"`);
    }
    if (entry.pictureId && !pictures.has(entry.pictureId))
      errors.push(`${where}: unknown picture "${entry.pictureId}"`);
    if (entry.isHeartWord === true) {
      if (entry.irregularIdx.some((i) => i < 0 || i >= entry.graphemes.length))
        errors.push(`${where}: irregularIdx out of range`);
    } else {
      for (const p of entry.requires ?? [])
        if (!patterns.has(p)) errors.push(`${where}: unknown required pattern "${p}"`);
      for (const pair of entry.minimalPairs ?? []) {
        if (!content.words.some((w) => w.id === pair))
          errors.push(`${where}: minimal pair "${pair}" is not in the lexicon`);
      }
    }
  }
}

function validateSentence(
  sentence: Sentence,
  lex: Lexicon,
  content: ContentBundle,
  errors: string[],
  enforceLength: boolean,
): void {
  const where = `sentence ${sentence.id} "${sentence.text}"`;
  const bonus = sentence.bonus ?? [];
  const failure = checkText(sentence.text, sentence.levelId, bonus, lex);
  if (failure) errors.push(`${where}: not readable at Level ${sentence.levelId}: ${failure}`);
  else if (sentence.levelId > 1 && !checkText(sentence.text, sentence.levelId - 1, bonus, lex)) {
    errors.push(`${where}: levelId ${sentence.levelId} is higher than the text requires`);
  }
  const length = tokenize(sentence.text).length;
  if (enforceLength && (length < 3 || length > 8))
    errors.push(`${where}: has ${length} words (3–8 required)`);
  const pictures = new Set(content.pictures.map((p) => p.id));
  for (const id of [sentence.scene?.subject, sentence.scene?.object]) {
    if (id && !pictures.has(id)) errors.push(`${where}: unknown scene picture "${id}"`);
  }
}

export function validateContent(content: ContentBundle): string[] {
  const errors: string[] = [];
  const lex = buildLexicon(content.levels, content.words, content.heartWords);
  const patterns = new Set(content.patterns.map((p) => p.id));
  const sounds = new Set(content.sounds.map((s) => s.id));

  for (const level of content.levels) {
    for (const p of level.patterns)
      if (!patterns.has(p)) errors.push(`Level ${level.id}: unknown pattern "${p}"`);
  }
  for (const pattern of content.patterns) {
    for (const g of pattern.graphemes)
      if (!sounds.has(g.soundId))
        errors.push(`pattern ${pattern.id}: unknown sound "${g.soundId}"`);
  }
  for (const word of content.words) {
    if (content.heartWords.some((h) => h.id === word.id))
      errors.push(`word "${word.id}": listed as both a regular word and a heart word`);
  }
  validateEntries(content, errors);

  const sentenceIds = new Set<string>();
  for (const sentence of content.sentences) {
    if (sentenceIds.has(sentence.id)) errors.push(`sentence ${sentence.id}: duplicate id`);
    sentenceIds.add(sentence.id);
    validateSentence(sentence, lex, content, errors, true);
  }

  const pictures = new Set(content.pictures.map((p) => p.id));
  for (const story of content.stories) {
    const where = `story ${story.id}`;
    const bonus = story.bonus ?? [];
    const titleFailure = checkText(story.title, story.levelId, bonus, lex);
    if (titleFailure)
      errors.push(`${where}: title not readable at Level ${story.levelId}: ${titleFailure}`);
    if (story.pages.length < 2 || story.pages.length > 4)
      errors.push(`${where}: has ${story.pages.length} pages (2–4 required)`);
    if (story.sticker && !pictures.has(story.sticker))
      errors.push(`${where}: unknown sticker "${story.sticker}"`);
    story.pages.forEach((page, i) => {
      if (page.length < 1 || page.length > 3)
        errors.push(`${where}: page ${i + 1} has ${page.length} sentences (1–3 required)`);
      for (const sentence of page) {
        const failure = checkText(sentence.text, story.levelId, bonus, lex);
        if (failure)
          errors.push(
            `${where}: "${sentence.text}" not readable at Level ${story.levelId}: ${failure}`,
          );
      }
    });
  }

  const seedWords = content.words.filter(
    (w) => (wordLevel(w, content.levels) ?? 99) <= SEED_MINIMUMS.maxLevel,
  ).length;
  const seedSentences = content.sentences.filter((s) => s.levelId <= SEED_MINIMUMS.maxLevel).length;
  const seedStories = content.stories.filter((s) => s.levelId <= SEED_MINIMUMS.maxLevel).length;
  if (seedWords < SEED_MINIMUMS.words)
    errors.push(
      `seed content: ${seedWords} words for Levels 1–5 (${SEED_MINIMUMS.words} required)`,
    );
  if (seedSentences < SEED_MINIMUMS.sentences)
    errors.push(`seed content: ${seedSentences} sentences (${SEED_MINIMUMS.sentences} required)`);
  if (seedStories < SEED_MINIMUMS.stories)
    errors.push(`seed content: ${seedStories} stories (${SEED_MINIMUMS.stories} required)`);
  return errors;
}
