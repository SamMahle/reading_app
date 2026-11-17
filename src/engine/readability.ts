import { findEntry, requiredPatterns, unlockedPatterns } from './lexicon';
import { normalizeWord, tokenize } from './tokenize';
import type { Classification, Lexicon, Offender, ReadableResult, UnlockState } from './types';

/**
 * Decodability checker, the app's core guarantee (spec §6.4).
 *
 * - decodable: in the lexicon and every required pattern is unlocked
 * - heart:     an unlocked heart word (its tricky parts are allowed)
 * - not_yet:   known, but a required pattern or the heart word is locked
 * - unknown:   not in the lexicon
 */
export function classifyWord(token: string, unlock: UnlockState, lex: Lexicon): Classification {
  const key = normalizeWord(token);
  const entry = findEntry(key, lex);
  if (!entry) return { cls: 'unknown', missingPatterns: [] };

  const unlocked = unlockedPatterns(unlock, lex.levels);
  const missingPatterns = requiredPatterns(entry).filter((p) => !unlocked.has(p));

  if (entry.isHeartWord === true) {
    if (unlock.heartWords.includes(entry.id)) return { cls: 'heart', missingPatterns: [], entry };
    return { cls: 'not_yet', missingPatterns, entry };
  }
  if (missingPatterns.length === 0) return { cls: 'decodable', missingPatterns, entry };
  return { cls: 'not_yet', missingPatterns, entry };
}

/** True only if every token is decodable or an unlocked heart word. */
export function isReadable(text: string, unlock: UnlockState, lex: Lexicon): ReadableResult {
  const offenders: Offender[] = [];
  for (const token of tokenize(text)) {
    const { cls, missingPatterns } = classifyWord(token.word, unlock, lex);
    if (cls !== 'decodable' && cls !== 'heart') {
      offenders.push({ token: token.word, cls, missingPatterns });
    }
  }
  return { ok: offenders.length === 0, offenders };
}

/**
 * Class Passage variant (spec §9.5): text is acceptable when every offender
 * has been pre-taught in the same session. `preTaught` holds lookup keys.
 */
export function isReadableAfterPreTeach(
  text: string,
  unlock: UnlockState,
  lex: Lexicon,
  preTaught: ReadonlySet<string>,
): ReadableResult {
  const result = isReadable(text, unlock, lex);
  const offenders = result.offenders.filter((o) => !preTaught.has(normalizeWord(o.token)));
  return { ok: offenders.length === 0, offenders };
}

/**
 * Runtime gate for reading text (spec §6.4): keeps only the sentences that
 * may be shown under the live unlock state. `preTaught` is the Class Passage
 * exception. Callers log what was dropped.
 */
export function partitionReadable<T extends { text: string }>(
  sentences: readonly T[],
  unlock: UnlockState,
  lex: Lexicon,
  preTaught?: ReadonlySet<string>,
): { shown: T[]; refused: { sentence: T; offenders: Offender[] }[] } {
  const shown: T[] = [];
  const refused: { sentence: T; offenders: Offender[] }[] = [];
  for (const sentence of sentences) {
    const result = preTaught
      ? isReadableAfterPreTeach(sentence.text, unlock, lex, preTaught)
      : isReadable(sentence.text, unlock, lex);
    if (result.ok) shown.push(sentence);
    else refused.push({ sentence, offenders: result.offenders });
  }
  return { shown, refused };
}
