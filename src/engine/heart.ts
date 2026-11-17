import { unlockedPatterns } from './lexicon';
import type { AnyEntry, Level, UnlockState } from './types';

/**
 * Heart marks are computed, never stored (spec §6.2):
 *
 *   heartIdx(word, unlock) = grapheme indexes i where
 *       i ∈ word.irregularIdx  OR  graphemes[i].patternId ∉ unlockedPatterns
 *
 * Regular (decodable) words never carry hearts.
 */
export function heartIdx(entry: AnyEntry, unlock: UnlockState, levels: readonly Level[]): number[] {
  if (entry.isHeartWord !== true) return [];
  const unlocked = unlockedPatterns(unlock, levels);
  const marks: number[] = [];
  entry.graphemes.forEach((grapheme, i) => {
    if (entry.irregularIdx.includes(i) || !unlocked.has(grapheme.patternId)) marks.push(i);
  });
  return marks;
}
