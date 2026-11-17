import { unlockedPatterns } from '@/engine/lexicon';
import type { AnyEntry, Level, LevelId, PatternId, SoundId, UnlockState } from '@/engine/types';
import type { ContentBundle } from './index';

/** Every audio clip the content needs (spec §6.3, §12). */

export type ClipKind = 'sound' | 'word' | 'prompt';

export interface ClipRequirement {
  clipId: string;
  kind: ClipKind;
  /** What the parent says when recording it. */
  label: string;
  /** Recording guidance (sounds only). */
  guidance?: string;
  /** The lowest level that needs this clip; undefined for heart-word-only sounds and prompts. */
  levelId?: LevelId;
}

export const soundClipId = (soundId: SoundId) => `snd_${soundId}`;
export const wordClipId = (wordId: string) => `wd_${wordId}`;

function lowestLevelFor(patternId: PatternId, levels: readonly Level[]): LevelId | undefined {
  return [...levels].sort((a, b) => a.id - b.id).find((l) => l.patterns.includes(patternId))?.id;
}

/** All clips required by the bundled content plus any parent-added entries. */
export function requiredClips(
  content: ContentBundle,
  custom: readonly AnyEntry[] = [],
): ClipRequirement[] {
  const clips = new Map<string, ClipRequirement>();
  const entries: AnyEntry[] = [...content.words, ...content.heartWords, ...custom];

  const soundLevel = new Map<SoundId, LevelId | undefined>();
  for (const entry of entries) {
    for (const g of entry.graphemes) {
      const level = lowestLevelFor(g.patternId, content.levels);
      const known = soundLevel.get(g.soundId);
      if (
        !soundLevel.has(g.soundId) ||
        (level !== undefined && (known === undefined || level < known))
      ) {
        soundLevel.set(g.soundId, level);
      }
    }
  }
  for (const sound of content.sounds) {
    if (!soundLevel.has(sound.id)) continue;
    const levelId = soundLevel.get(sound.id);
    clips.set(sound.clip, {
      clipId: sound.clip,
      kind: 'sound',
      label: `${sound.label} as in "${sound.example}"`,
      guidance: sound.guidance,
      ...(levelId === undefined ? {} : { levelId }),
    });
  }
  for (const entry of entries) {
    const clipId = entry.audioWord ?? wordClipId(entry.id);
    clips.set(clipId, { clipId, kind: 'word', label: entry.id === 'i' ? 'I' : entry.text });
  }
  for (const prompt of content.prompts) {
    clips.set(prompt.id, { clipId: prompt.id, kind: 'prompt', label: prompt.text });
  }
  return [...clips.values()];
}

/** Sound clips a level's patterns need; a level may not unlock in production without them. */
export function soundClipsForLevel(levelId: LevelId, content: ContentBundle): string[] {
  const level = content.levels.find((l) => l.id === levelId);
  if (!level) return [];
  const soundIds = new Set<SoundId>();
  for (const pattern of content.patterns) {
    if (!level.patterns.includes(pattern.id)) continue;
    for (const g of pattern.graphemes) soundIds.add(g.soundId);
  }
  return [...soundIds].map(soundClipId);
}

/** Sound clips needed for everything currently unlocked (patterns and heart words). */
export function soundClipsForUnlock(
  unlock: UnlockState,
  content: ContentBundle,
  custom: readonly AnyEntry[] = [],
): string[] {
  const unlocked = unlockedPatterns(unlock, content.levels);
  const soundIds = new Set<SoundId>();
  for (const pattern of content.patterns) {
    if (!unlocked.has(pattern.id)) continue;
    for (const g of pattern.graphemes) soundIds.add(g.soundId);
  }
  for (const entry of [...content.heartWords, ...custom]) {
    if (entry.isHeartWord !== true || !unlock.heartWords.includes(entry.id)) continue;
    for (const g of entry.graphemes) soundIds.add(g.soundId);
  }
  return [...soundIds].map(soundClipId);
}
