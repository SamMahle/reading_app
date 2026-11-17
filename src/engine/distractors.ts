import { classifyWord } from './readability';
import { shuffle, type Rng } from './rng';
import type { GraphemeOption } from './segment';
import type { Lexicon, PictureDef, Scene, UnlockState, WordEntry } from './types';

/**
 * Distractor generation for Solo activities. Every distractor is built so the
 * learner has to read: minimal pairs differ by exactly one grapheme, and scene
 * distractors change exactly one element (spec §6.5, §8.2).
 */

// ---------------------------------------------------------------------------
// Minimal pairs (Pick the Word)
// ---------------------------------------------------------------------------

/** True when two words differ by exactly one grapheme. */
export function isMinimalPair(a: WordEntry, b: WordEntry): boolean {
  if (a.graphemes.length !== b.graphemes.length) return false;
  let differences = 0;
  a.graphemes.forEach((grapheme, i) => {
    if (grapheme.spelling !== b.graphemes[i]?.spelling) differences += 1;
  });
  return differences === 1;
}

function isName(entry: WordEntry): boolean {
  return entry.tags?.includes('name') ?? false;
}

/**
 * Real lexicon words that are decodable under the current unlock state and
 * differ from the target by exactly one grapheme. Hand-listed pairs
 * (`minimalPairs`) come first.
 */
export function findMinimalPairs(
  target: WordEntry,
  lex: Lexicon,
  unlock: UnlockState,
): WordEntry[] {
  const listed = new Set(target.minimalPairs ?? []);
  const pairs: WordEntry[] = [];
  for (const candidate of lex.words.values()) {
    if (candidate.id === target.id || isName(candidate)) continue;
    if (!isMinimalPair(target, candidate)) continue;
    if (classifyWord(candidate.text, unlock, lex).cls !== 'decodable') continue;
    pairs.push(candidate);
  }
  return pairs.sort((a, b) => Number(listed.has(b.id)) - Number(listed.has(a.id)));
}

/** Target plus two minimal pairs, or undefined when fewer than two exist. */
export function pickWordOptions(
  target: WordEntry,
  lex: Lexicon,
  unlock: UnlockState,
  rng: Rng,
): WordEntry[] | undefined {
  const pairs = findMinimalPairs(target, lex, unlock);
  if (pairs.length < 2) return undefined;
  const listed = pairs.filter((p) => target.minimalPairs?.includes(p.id));
  const others = shuffle(
    pairs.filter((p) => !listed.includes(p)),
    rng,
  );
  const chosen = [...shuffle(listed, rng), ...others].slice(0, 2);
  return shuffle([target, ...chosen], rng);
}

// ---------------------------------------------------------------------------
// Tiles (Word Building) and grapheme choices (Sound Warm-up)
// ---------------------------------------------------------------------------

export interface Tile {
  /** Unique within one board, so repeated letters ("dad") stay distinct. */
  id: string;
  spelling: string;
  soundId: string;
}

const VOWEL_SPELLINGS = new Set(['a', 'e', 'i', 'o', 'u']);

function isVowelSpelling(spelling: string): boolean {
  return VOWEL_SPELLINGS.has(spelling) || spelling.includes('_');
}

/**
 * Tiles for a word: its graphemes plus two distractors drawn from unlocked
 * graphemes that are not in the word. One distractor is a vowel when
 * possible, because vowel confusions are the instructive ones.
 */
export function buildTiles(
  target: WordEntry,
  unlockedGraphemes: readonly GraphemeOption[],
  rng: Rng,
): Tile[] {
  const used = new Set(target.graphemes.map((g) => g.spelling));
  const seen = new Set<string>();
  const candidates = shuffle(unlockedGraphemes, rng).filter((g) => {
    if (used.has(g.spelling) || seen.has(g.spelling)) return false;
    seen.add(g.spelling);
    return true;
  });
  const vowel = candidates.find((g) => isVowelSpelling(g.spelling));
  const consonants = candidates.filter((g) => !isVowelSpelling(g.spelling));
  const distractors = [vowel, ...consonants, ...candidates]
    .filter((g): g is GraphemeOption => g !== undefined)
    .filter((g, i, all) => all.findIndex((x) => x.spelling === g.spelling) === i)
    .slice(0, 2);
  const tiles = [...target.graphemes, ...distractors].map((g, i) => ({
    id: `t${i}`,
    spelling: g.spelling,
    soundId: g.soundId,
  }));
  return shuffle(tiles, rng);
}

/** The target grapheme plus two others that look and sound different. */
export function warmupOptions(
  target: GraphemeOption,
  unlockedGraphemes: readonly GraphemeOption[],
  rng: Rng,
): GraphemeOption[] | undefined {
  const seen = new Set<string>([target.spelling]);
  const others = shuffle(unlockedGraphemes, rng).filter((g) => {
    if (seen.has(g.spelling) || g.soundId === target.soundId) return false;
    seen.add(g.spelling);
    return true;
  });
  if (others.length < 2) return undefined;
  const sameKind = others.filter(
    (g) => isVowelSpelling(g.spelling) === isVowelSpelling(target.spelling),
  );
  const chosen = [...sameKind, ...others]
    .filter((g, i, all) => all.findIndex((x) => x.spelling === g.spelling) === i)
    .slice(0, 2);
  return shuffle([target, ...chosen], rng);
}

// ---------------------------------------------------------------------------
// Scenes (Read then Match)
// ---------------------------------------------------------------------------

export type SceneElement = 'subject' | 'object' | 'relation';

export interface SceneChoice {
  scene: Scene;
  correct: boolean;
  /** Which single element differs from the target (distractors only). */
  changed?: SceneElement;
}

type RelationLayout = 'on' | 'in' | 'beside' | 'alone';

/** "with" and "next_to" draw the same way, so they are never swapped. */
export function relationLayout(scene: Scene): RelationLayout {
  if (!scene.object || scene.relation === 'none' || scene.relation === undefined) return 'alone';
  if (scene.relation === 'on') return 'on';
  if (scene.relation === 'in') return 'in';
  return 'beside';
}

/** Two scenes with the same key would look identical on screen. */
export function sceneVisualKey(scene: Scene, pictures: ReadonlyMap<string, PictureDef>): string {
  const file = (id: string | undefined) => (id ? (pictures.get(id)?.file ?? id) : '');
  const layout = relationLayout(scene);
  return `${file(scene.subject)}|${layout}|${layout === 'alone' ? '' : file(scene.object)}`;
}

/** Relation swaps that stay visually unmistakable. */
const RELATION_SWAP: Partial<
  Record<NonNullable<Scene['relation']>, NonNullable<Scene['relation']>>
> = {
  on: 'next_to',
  in: 'next_to',
  next_to: 'on',
};

/**
 * Two distractor scenes, each changing exactly one element of the target.
 * `pool` lists picture ids that may stand in as a subject or object.
 * Returns undefined when two visually distinct distractors cannot be made.
 */
export function sceneDistractors(
  target: Scene,
  pool: readonly string[],
  pictures: ReadonlyMap<string, PictureDef>,
  rng: Rng,
): SceneChoice[] | undefined {
  const keys = new Set([sceneVisualKey(target, pictures)]);
  const fileOf = (id: string) => pictures.get(id)?.file ?? id;
  const taken = new Set(
    [target.subject, target.object].filter((x): x is string => !!x).map(fileOf),
  );
  const substitutes = shuffle(
    pool.filter((id) => pictures.has(id) && !taken.has(fileOf(id))),
    rng,
  );
  const hasObject = relationLayout(target) !== 'alone';

  const candidates: SceneChoice[] = [];
  const subjectSwaps = substitutes.map<SceneChoice>((id) => ({
    scene: { ...target, subject: id },
    correct: false,
    changed: 'subject',
  }));
  const objectSwaps = hasObject
    ? substitutes
        .slice()
        .reverse()
        .map<SceneChoice>((id) => ({
          scene: { ...target, object: id },
          correct: false,
          changed: 'object',
        }))
    : [];
  const swapped = target.relation ? RELATION_SWAP[target.relation] : undefined;
  const relationSwaps: SceneChoice[] =
    hasObject && swapped
      ? [{ scene: { ...target, relation: swapped }, correct: false, changed: 'relation' }]
      : [];

  // Prefer one subject change and one object (or relation) change, so every
  // content word in the sentence has to be read.
  const second = rng.next() < 0.25 && relationSwaps.length > 0 ? relationSwaps : objectSwaps;
  const ordered = [
    subjectSwaps[0],
    second[0],
    ...second.slice(1),
    ...relationSwaps,
    ...subjectSwaps.slice(1),
  ];
  for (const choice of ordered) {
    if (!choice) continue;
    const key = sceneVisualKey(choice.scene, pictures);
    if (keys.has(key)) continue;
    keys.add(key);
    candidates.push(choice);
    if (candidates.length === 2) return candidates;
  }
  return undefined;
}

/** The target scene with its two distractors, shuffled. */
export function sceneChoices(
  target: Scene,
  pool: readonly string[],
  pictures: ReadonlyMap<string, PictureDef>,
  rng: Rng,
): SceneChoice[] | undefined {
  const distractors = sceneDistractors(target, pool, pictures, rng);
  if (!distractors) return undefined;
  return shuffle([{ scene: target, correct: true }, ...distractors], rng);
}
