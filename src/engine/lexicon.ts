import type {
  AnyEntry,
  HeartWordEntry,
  Level,
  LevelId,
  Lexicon,
  PatternId,
  UnlockState,
  WordEntry,
} from './types';

/**
 * Build the lookup structure the checker works on. Later sources win, so
 * parent-added entries (custom content) override bundled ones with the same
 * id. A custom heart word also removes a regular word with that id (this is
 * how a parent turns "and" into an early heart word), and vice versa.
 */
export function buildLexicon(
  levels: readonly Level[],
  words: readonly WordEntry[],
  heartWords: readonly HeartWordEntry[],
  custom: readonly AnyEntry[] = [],
): Lexicon {
  const wordMap = new Map<string, WordEntry>();
  const heartMap = new Map<string, HeartWordEntry>();
  for (const word of words) wordMap.set(word.id, word);
  for (const heart of heartWords) heartMap.set(heart.id, heart);
  for (const entry of custom) {
    if (entry.isHeartWord === true) {
      wordMap.delete(entry.id);
      heartMap.set(entry.id, entry);
    } else {
      heartMap.delete(entry.id);
      wordMap.set(entry.id, entry);
    }
  }
  return { words: wordMap, heartWords: heartMap, levels };
}

/** Every pattern the learner may be asked to use under this unlock state. */
export function unlockedPatterns(unlock: UnlockState, levels: readonly Level[]): Set<PatternId> {
  const patterns = new Set<PatternId>();
  for (const level of levels) {
    if (!unlock.levels.includes(level.id)) continue;
    for (const pattern of level.patterns) patterns.add(pattern);
  }
  for (const pattern of unlock.extraPatterns) patterns.add(pattern);
  for (const pattern of unlock.lockedPatterns) patterns.delete(pattern);
  return patterns;
}

/** Look a token key up: heart words first, then regular words. */
export function findEntry(key: string, lex: Lexicon): AnyEntry | undefined {
  return lex.heartWords.get(key) ?? lex.words.get(key);
}

/** All patterns a regular word needs: its graphemes plus word-level skills. */
export function requiredPatterns(entry: AnyEntry): PatternId[] {
  const patterns = entry.graphemes.map((g) => g.patternId);
  if (entry.isHeartWord !== true && entry.requires) patterns.push(...entry.requires);
  return [...new Set(patterns)];
}

/**
 * The unlock state used to validate bundled content "at its own level": that
 * level and everything below it, plus the heart words available at it
 * (spec §6.4). `bonus` adds optional heart words an item declares.
 */
export function unlockForLevel(
  levelId: LevelId,
  lex: Lexicon,
  bonus: readonly string[] = [],
): UnlockState {
  const heartWords = [...lex.heartWords.values()]
    .filter((h) => h.unlockLevel <= levelId && (h.optional !== true || bonus.includes(h.id)))
    .map((h) => h.id);
  return {
    levels: lex.levels.filter((l) => l.id <= levelId).map((l) => l.id),
    extraPatterns: [],
    lockedPatterns: [],
    heartWords,
  };
}

/** The lowest level at which a regular word is fully decodable, if any. */
export function wordLevel(entry: WordEntry, levels: readonly Level[]): LevelId | undefined {
  const needed = requiredPatterns(entry);
  const sorted = [...levels].sort((a, b) => a.id - b.id);
  const have = new Set<PatternId>();
  for (const level of sorted) {
    for (const pattern of level.patterns) have.add(pattern);
    if (needed.every((p) => have.has(p))) return level.id;
  }
  return undefined;
}

/** How a word is shown on its own: names are capitalised, "I" is upper case. */
export function displayForm(entry: AnyEntry): string {
  if (entry.id === 'i') return 'I';
  if (entry.isHeartWord !== true && entry.tags?.includes('name')) {
    return entry.text.charAt(0).toUpperCase() + entry.text.slice(1);
  }
  return entry.text;
}
