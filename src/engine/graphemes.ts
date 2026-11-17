import type { GraphemeOption } from './segment';
import type { PatternDef, PatternId, SoundDef } from './types';

/** Every taught spelling the learner can currently be asked about. */
export function listUnlockedGraphemes(
  patterns: readonly PatternDef[],
  sounds: readonly SoundDef[],
  unlocked: ReadonlySet<PatternId>,
): GraphemeOption[] {
  const soundMap = new Map(sounds.map((s) => [s.id, s]));
  const result: GraphemeOption[] = [];
  for (const pattern of patterns) {
    if (!unlocked.has(pattern.id)) continue;
    for (const g of pattern.graphemes) {
      result.push({
        spelling: g.spelling,
        soundId: g.soundId,
        patternId: pattern.id,
        continuous: soundMap.get(g.soundId)?.continuous ?? false,
      });
    }
  }
  return result;
}

export function isVowelPattern(pattern: PatternDef | undefined): boolean {
  return pattern?.group === 'vowel' || pattern?.group === 'silent_e';
}
