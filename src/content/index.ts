/**
 * Bundled content. Everything here is data from /content; the app never
 * renders any of it without passing it through the decodability checker.
 */
import graphemesJson from '@content/graphemes.json';
import heartWordsJson from '@content/heartWords.json';
import lexiconJson from '@content/lexicon.json';
import picturesJson from '@content/pictures.json';
import promptsJson from '@content/prompts.json';
import scopeJson from '@content/scope.json';
import sentencesJson from '@content/sentences.json';
import storiesJson from '@content/stories.json';
import { buildLexicon } from '@/engine/lexicon';
import type {
  HeartWordEntry,
  Level,
  LevelId,
  Lexicon,
  PatternDef,
  PictureDef,
  PromptDef,
  Sentence,
  SoundDef,
  Story,
  UnlockState,
  WordEntry,
} from '@/engine/types';

/**
 * JSON modules are typed structurally (string where the model has a union),
 * so they are narrowed here once. `npm run validate-content` checks the data
 * against the model in CI.
 */
function typed<T>(json: unknown): T {
  return json as T;
}

export interface ContentBundle {
  sounds: SoundDef[];
  patterns: PatternDef[];
  levels: Level[];
  defaultUnlocked: LevelId[];
  words: WordEntry[];
  heartWords: HeartWordEntry[];
  sentences: Sentence[];
  stories: Story[];
  pictures: PictureDef[];
  prompts: PromptDef[];
}

export const CONTENT: ContentBundle = {
  sounds: typed<SoundDef[]>(graphemesJson.sounds),
  patterns: typed<PatternDef[]>(graphemesJson.patterns),
  levels: typed<Level[]>(scopeJson.levels),
  defaultUnlocked: typed<LevelId[]>(scopeJson.defaultUnlocked),
  words: typed<WordEntry[]>(lexiconJson),
  heartWords: typed<HeartWordEntry[]>(heartWordsJson),
  sentences: typed<Sentence[]>(sentencesJson),
  stories: typed<Story[]>(storiesJson),
  pictures: typed<PictureDef[]>(picturesJson),
  prompts: typed<PromptDef[]>(promptsJson),
};

export const PICTURES: ReadonlyMap<string, PictureDef> = new Map(
  CONTENT.pictures.map((p) => [p.id, p]),
);

export const SOUND_MAP: ReadonlyMap<string, SoundDef> = new Map(
  CONTENT.sounds.map((s) => [s.id, s]),
);

export const PATTERN_MAP: ReadonlyMap<string, PatternDef> = new Map(
  CONTENT.patterns.map((p) => [p.id, p]),
);

export const BASE_LEXICON: Lexicon = buildLexicon(
  CONTENT.levels,
  CONTENT.words,
  CONTENT.heartWords,
);

/** Install state: Levels 1–3 and the starting heart words (spec §6.1, §6.2). */
export function defaultUnlock(content: ContentBundle = CONTENT): UnlockState {
  return {
    levels: [...content.defaultUnlocked],
    extraPatterns: [],
    lockedPatterns: [],
    heartWords: content.heartWords.filter((h) => h.optional !== true).map((h) => h.id),
  };
}
