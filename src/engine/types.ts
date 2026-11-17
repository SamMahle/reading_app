/**
 * Domain model (spec §5). Names are binding. Fields added beyond the spec are
 * marked "Addition" with the reason.
 */

export type SoundId = string; // e.g. "m", "a_short", "th_voiced", "e_long", "schwa"
export type PatternId = string; // e.g. "short_a", "cons_m", "dig_ch", "suffix_s"
export type LevelId = number; // 1..8

export interface Grapheme {
  spelling: string; // "ch", "a", "s"; a split digraph is written "i_e"
  soundId: SoundId; // the sound THIS grapheme makes in THIS context
  patternId: PatternId; // which taught pattern makes it decodable
  continuous: boolean; // can be held (m, s, f, a...) vs stop (b, t, p...)
}

export interface WordEntry {
  id: string; // lowercase word, e.g. "chip"; homographs get suffix
  text: string; // display form, lowercase
  graphemes: Grapheme[]; // explicit, hand-verified segmentation
  pictureId?: string;
  audioWord?: string; // "wd_chip"
  minimalPairs?: string[]; // ids of words differing by one grapheme (for Pick the Word)
  tags?: string[]; // "noun", "verb", "name" ...
  isHeartWord?: false;
  /**
   * Addition: word-level skills beyond the individual graphemes, e.g.
   * "blend_initial" for "stop". A blend is a structure, not a grapheme: every
   * letter keeps its own sound and dot, but the word is not decodable until
   * blending adjacent consonants has been taught (Level 7).
   */
  requires?: PatternId[];
}

export interface HeartWordEntry {
  id: string; // "they"
  text: string;
  graphemes: Grapheme[]; // full segmentation, INCLUDING irregular graphemes
  irregularIdx: number[]; // indexes into graphemes that are irregular *by nature*
  unlockLevel: LevelId; // when it becomes available as a heart word
  audioWord: string;
  pictureId?: string;
  isHeartWord: true;
  /**
   * Addition: an interest word (e.g. "star", "moon") that ships with the app
   * but is NOT unlocked at install. The parent switches it on in the panel.
   */
  optional?: boolean;
}

export type AnyEntry = WordEntry | HeartWordEntry;

export interface Level {
  id: LevelId;
  title: string; // "Short o"
  patterns: PatternId[];
}

export interface Scene {
  // for read-then-match pictures
  subject: string; // pictureId, e.g. "cat"
  object?: string; // pictureId, e.g. "mat"
  relation?: 'on' | 'in' | 'with' | 'next_to' | 'none';
}

export interface Sentence {
  id: string;
  text: string; // "The cat is on a mat."
  levelId: LevelId; // highest level required
  scene?: Scene; // required if used in read-then-match
  chunks?: number[]; // token indexes where phrase breaks occur (focus reader)
  /** Addition: optional heart words (HeartWordEntry.optional) this text needs. */
  bonus?: string[];
}

export interface Story {
  id: string;
  title: string;
  levelId: LevelId;
  pages: Sentence[][]; // page → sentences
  source: 'app' | 'class_passage';
  /** Addition: pictureId shown on the book spine once the story is completed. */
  sticker?: string;
  /** Addition: optional heart words this story needs (see Sentence.bonus). */
  bonus?: string[];
}

export type Outcome = 'correct' | 'self_corrected' | 'helped' | 'modeled';

export type Activity = 'warmup' | 'build' | 'pick' | 'match' | 'read';

export interface Attempt {
  id: string; // uuid
  ts: number; // epoch ms
  mode: 'solo' | 'coach';
  activity: Activity;
  itemId: string; // word id, sentence id, or grapheme spelling
  outcome: Outcome;
  usedHelp: boolean; // opened sound-it-out
  completedHelp: boolean; // tapped all dots AND swiped the blend
  sessionId: string;
}

export interface UnlockState {
  levels: LevelId[]; // unlocked levels
  extraPatterns: PatternId[]; // individually unlocked patterns
  lockedPatterns: PatternId[]; // individually locked overrides
  heartWords: string[]; // unlocked heart word ids
}

// ---------------------------------------------------------------------------
// Supporting types (not in spec §5; shared across engine modules)
// ---------------------------------------------------------------------------

export interface SoundDef {
  id: SoundId;
  /** Clip id, e.g. "snd_m". */
  clip: string;
  continuous: boolean;
  /** Parent-facing label, e.g. "/m/". */
  label: string;
  /** A key word that contains the sound. */
  example: string;
  /** Articulation guidance shown in Sound Studio. */
  guidance: string;
}

export type PatternGroup =
  'consonant' | 'vowel' | 'digraph' | 'suffix' | 'blend' | 'silent_e' | 'future' | 'irregular';

export interface PatternDef {
  id: PatternId;
  label: string;
  group: PatternGroup;
  /** Spellings this pattern teaches. Empty for word-level patterns (blends). */
  graphemes: { spelling: string; soundId: SoundId }[];
}

export interface PictureDef {
  id: string;
  file: string;
  /** True when the picture names its word unambiguously (safe as a prompt). */
  cue: boolean;
  /** "openmoji" (CC BY-SA 4.0) or "original" (drawn for this app). */
  source: 'openmoji' | 'original';
}

export interface PromptDef {
  id: string; // "pr_tap_sounds"
  text: string;
}

export interface Lexicon {
  words: ReadonlyMap<string, WordEntry>;
  heartWords: ReadonlyMap<string, HeartWordEntry>;
  levels: readonly Level[];
}

export type WordClass = 'decodable' | 'heart' | 'not_yet' | 'unknown';

export interface Classification {
  cls: WordClass;
  missingPatterns: PatternId[];
  entry?: AnyEntry;
}

export interface Offender {
  token: string;
  cls: WordClass;
  missingPatterns: PatternId[];
}

export interface ReadableResult {
  ok: boolean;
  offenders: Offender[];
}

export type Rung = 1 | 2 | 3 | 4 | 5;

export type LeitnerBox = 1 | 2 | 3 | 4 | 5;

export interface LeitnerCard {
  wordId: string;
  box: LeitnerBox;
  dueTs: number;
  correctDays: string[]; // ISO dates (local) with an unaided correct answer
}

export interface LadderEvent {
  ts: number;
  rung: Rung;
  reason: 'start' | 'up' | 'down' | 'override';
}

export interface LadderState {
  rung: Rung;
  /** Consecutive Coach sessions at or above the move-up threshold. */
  streak: number;
  history: LadderEvent[];
}

export interface SessionSummary {
  id: string;
  ts: number;
  mode: 'solo' | 'coach';
  durationMs: number;
  items: number;
  accuracy: number; // 0..1
  helpOpened: number;
  helpCompleted: number;
  /** Parent-visible notes, e.g. items skipped because audio was unavailable. */
  notes: string[];
  storyId?: string;
}
