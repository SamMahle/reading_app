import type { Grapheme, PatternDef, PatternId, SoundDef, SoundId } from './types';

/**
 * Proposes a segmentation when a parent adds a word. Automatic segmentation
 * is ambiguous (voiced vs unvoiced "th", "s" as /s/ or /z/), so the result is
 * only a proposal for the parent to confirm or correct (spec §5).
 */

export interface GraphemeOption {
  spelling: string;
  soundId: SoundId;
  patternId: PatternId;
  continuous: boolean;
}

export interface SegmentationProposal {
  graphemes: Grapheme[];
  /** Word-level skills the word appears to need (blends). */
  requires: PatternId[];
  /** Letters no known spelling covers. Empty when the proposal is complete. */
  unmatched: string[];
}

export interface GraphemeTable {
  /** Every (spelling → sound) the app knows, keyed by spelling. */
  optionsFor(spelling: string): GraphemeOption[];
  /** Known spellings, longest first. */
  spellings: string[];
  isVowelSound(soundId: SoundId): boolean;
}

const VOWEL_LETTERS = new Set(['a', 'e', 'i', 'o', 'u']);
const VOICELESS = new Set<SoundId>(['p', 't', 'k', 'f', 'th_unvoiced', 's', 'sh', 'ch', 'h']);

/** Patterns that never come first when several spellings match. */
const LOW_PRIORITY_GROUPS = new Set(['suffix', 'future', 'irregular']);

export function buildGraphemeTable(
  patterns: readonly PatternDef[],
  sounds: readonly SoundDef[],
): GraphemeTable {
  const soundMap = new Map(sounds.map((s) => [s.id, s]));
  const bySpelling = new Map<string, { option: GraphemeOption; low: boolean }[]>();
  for (const pattern of patterns) {
    for (const g of pattern.graphemes) {
      const list = bySpelling.get(g.spelling) ?? [];
      list.push({
        option: {
          spelling: g.spelling,
          soundId: g.soundId,
          patternId: pattern.id,
          continuous: soundMap.get(g.soundId)?.continuous ?? false,
        },
        low: LOW_PRIORITY_GROUPS.has(pattern.group),
      });
      bySpelling.set(g.spelling, list);
    }
  }
  const spellings = [...bySpelling.keys()]
    .filter((s) => !s.includes('_'))
    .sort((a, b) => b.length - a.length || a.localeCompare(b));
  const vowelSounds = new Set(
    sounds.filter((s) => /short|long|schwa|^oo$|^ow$|^er$|^ar$|^air$/u.test(s.id)).map((s) => s.id),
  );
  return {
    optionsFor: (spelling) =>
      (bySpelling.get(spelling) ?? [])
        .slice()
        .sort((a, b) => Number(a.low) - Number(b.low))
        .map((x) => x.option),
    spellings,
    isVowelSound: (soundId) => vowelSounds.has(soundId),
  };
}

function toGrapheme(option: GraphemeOption): Grapheme {
  return {
    spelling: option.spelling,
    soundId: option.soundId,
    patternId: option.patternId,
    continuous: option.continuous,
  };
}

/**
 * Detect a consonant-vowel-consonant-e word ("cake", "like") so the vowel can
 * be proposed as a split digraph. Returns the index of the vowel letter.
 */
function splitDigraphVowelIndex(word: string): number | undefined {
  if (word.length < 4 || !word.endsWith('e')) return undefined;
  const vowelIdx = word.length - 3;
  const vowel = word.charAt(vowelIdx);
  const consonant = word.charAt(word.length - 2);
  if (!VOWEL_LETTERS.has(vowel) || VOWEL_LETTERS.has(consonant) || vowel === 'e') return undefined;
  if (vowelIdx > 0 && VOWEL_LETTERS.has(word.charAt(vowelIdx - 1))) return undefined;
  return vowelIdx;
}

function detectBlends(graphemes: readonly Grapheme[], table: GraphemeTable): PatternId[] {
  const isConsonant = (g: Grapheme) =>
    !table.isVowelSound(g.soundId) && !g.patternId.startsWith('suffix');
  const firstVowel = graphemes.findIndex((g) => table.isVowelSound(g.soundId));
  if (firstVowel === -1) return [];
  let lastVowel = firstVowel;
  graphemes.forEach((g, i) => {
    if (table.isVowelSound(g.soundId)) lastVowel = i;
  });
  const requires: PatternId[] = [];
  if (graphemes.slice(0, firstVowel).filter(isConsonant).length >= 2) {
    requires.push('blend_initial');
  }
  if (graphemes.slice(lastVowel + 1).filter(isConsonant).length >= 2) {
    requires.push('blend_final');
  }
  return requires;
}

/** Choose the plural/verb "-s" reading when a word ends consonant + s. */
function proposeFinalS(graphemes: Grapheme[], table: GraphemeTable): void {
  const last = graphemes[graphemes.length - 1];
  const previous = graphemes[graphemes.length - 2];
  if (!last || !previous || last.spelling !== 's') return;
  if (table.isVowelSound(previous.soundId)) return; // "gas", "bus": leave as plain s
  const wanted = VOICELESS.has(previous.soundId) ? 'suffix_s' : 'suffix_s_z';
  const option = table.optionsFor('s').find((o) => o.patternId === wanted);
  if (option) graphemes[graphemes.length - 1] = toGrapheme(option);
}

export function proposeSegmentation(rawWord: string, table: GraphemeTable): SegmentationProposal {
  const word = rawWord.trim().toLowerCase();
  const graphemes: Grapheme[] = [];
  const unmatched: string[] = [];
  const splitIdx = splitDigraphVowelIndex(word);
  const splitOption =
    splitIdx === undefined ? undefined : table.optionsFor(`${word.charAt(splitIdx)}_e`)[0];
  const end = splitOption ? word.length - 1 : word.length;

  let pos = 0;
  while (pos < end) {
    if (splitOption && pos === splitIdx) {
      graphemes.push(toGrapheme(splitOption));
      pos += 1;
      continue;
    }
    const limit = splitOption && splitIdx !== undefined && pos < splitIdx ? splitIdx : end;
    const spelling = table.spellings.find(
      (s) => pos + s.length <= limit && word.startsWith(s, pos),
    );
    const option = spelling ? table.optionsFor(spelling)[0] : undefined;
    if (!option) {
      unmatched.push(word.charAt(pos));
      pos += 1;
      continue;
    }
    graphemes.push(toGrapheme(option));
    pos += option.spelling.length;
  }

  proposeFinalS(graphemes, table);
  return { graphemes, requires: detectBlends(graphemes, table), unmatched };
}

/** Recompute word-level requirements after the parent edits a segmentation. */
export function requiresFor(graphemes: readonly Grapheme[], table: GraphemeTable): PatternId[] {
  return detectBlends(graphemes, table);
}
