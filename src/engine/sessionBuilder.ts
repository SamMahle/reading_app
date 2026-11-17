import { DAY_MS } from './dates';
import {
  buildTiles,
  pickWordOptions,
  sceneChoices,
  warmupOptions,
  type SceneChoice,
  type Tile,
} from './distractors';
import { listUnlockedGraphemes } from './graphemes';
import { unlockedPatterns, wordLevel } from './lexicon';
import { consecutiveHighSessions, firstSeen, isSuccess, rollingAccuracy } from './metrics';
import { classifyWord, isReadable } from './readability';
import { shuffle, stochasticRound, weightedSample, type Rng } from './rng';
import { isDue, isMastered } from './scheduler';
import type { GraphemeOption } from './segment';
import type {
  Attempt,
  LeitnerCard,
  Lexicon,
  PatternDef,
  PictureDef,
  Sentence,
  SessionSummary,
  SoundDef,
  UnlockState,
  WordEntry,
} from './types';

/** Solo session builder (spec §8.5). Pure: same input and seed, same plan. */

export type SessionMinutes = 4 | 6 | 8;

export interface WarmupItem {
  kind: 'warmup';
  /** "hear": tap the grapheme to hear it. "find": hear a sound, pick from 3. */
  variant: 'hear' | 'find';
  target: GraphemeOption;
  options: GraphemeOption[];
}

export interface BuildItem {
  kind: 'build';
  wordId: string;
  tiles: Tile[];
}

export interface PickItem {
  kind: 'pick';
  wordId: string;
  optionIds: string[];
}

export interface MatchItem {
  kind: 'match';
  sentenceId: string;
  choices: SceneChoice[];
}

export type SessionItem = WarmupItem | BuildItem | PickItem | MatchItem;

export interface SessionPlan {
  items: SessionItem[];
  /** Easy review items used to space a re-queued item at least 3 items later. */
  fillers: SessionItem[];
  /** The mastered item that always closes the session. */
  closer: SessionItem;
  /** Parent-visible notes (for example, activities skipped without audio). */
  notes: string[];
  /** True when accuracy dipped and only review and mastered items were drawn. */
  restricted: boolean;
  newShare: number;
}

export interface BuildInput {
  lexicon: Lexicon;
  unlock: UnlockState;
  sentences: readonly Sentence[];
  patterns: readonly PatternDef[];
  sounds: readonly SoundDef[];
  pictures: ReadonlyMap<string, PictureDef>;
  cards: ReadonlyMap<string, LeitnerCard>;
  attempts: readonly Attempt[];
  sessions: readonly SessionSummary[];
  now: number;
  minutes: SessionMinutes;
  /** False when the device is muted or audio could not start. */
  audioAvailable: boolean;
  rng: Rng;
}

export const ITEM_COUNTS: Readonly<
  Record<SessionMinutes, { warmup: number; build: number; pick: number; match: number }>
> = {
  4: { warmup: 3, build: 3, pick: 3, match: 2 },
  6: { warmup: 4, build: 4, pick: 5, match: 3 },
  8: { warmup: 5, build: 5, pick: 7, match: 4 },
};

export const MIX = {
  recentShare: 0.2,
  newShare: 0.1,
  boostedNewShare: 0.2,
  recentDays: 7,
  restrictBelow: 0.85,
  boostAtOrAbove: 0.98,
  boostSessions: 2,
  rollingWindow: 10,
  requeueGap: 3,
} as const;

export const SKIPPED_NO_AUDIO_NOTE =
  'Audio was unavailable, so listening items (sound matching, word building) were skipped.';

type Bucket = 'review' | 'recent' | 'new' | 'rest';

interface MixContext {
  cards: ReadonlyMap<string, LeitnerCard>;
  seen: ReadonlyMap<string, number>;
  levelOf: (word: WordEntry) => number;
  now: number;
  restricted: boolean;
  newShare: number;
  rng: Rng;
}

function bucketOf(word: WordEntry, ctx: MixContext): Bucket {
  const card = ctx.cards.get(word.id);
  if (!card) return 'new';
  if (isDue(card, ctx.now) && !isMastered(card)) return 'review';
  const first = ctx.seen.get(word.id);
  if (first !== undefined && ctx.now - first <= MIX.recentDays * DAY_MS) return 'recent';
  return 'rest';
}

/**
 * Choose `count` words: about 70% review, 20% recent and 10% new. When
 * accuracy has dipped (`restricted`), only review and mastered items are
 * drawn, falling back to others only if nothing else exists.
 */
export function selectByMix(
  pool: readonly WordEntry[],
  count: number,
  ctx: MixContext,
): WordEntry[] {
  const buckets: Record<Bucket, WordEntry[]> = { review: [], recent: [], new: [], rest: [] };
  for (const word of shuffle(pool, ctx.rng)) buckets[bucketOf(word, ctx)].push(word);
  buckets.review.sort(
    (a, b) => (ctx.cards.get(a.id)?.dueTs ?? 0) - (ctx.cards.get(b.id)?.dueTs ?? 0),
  );
  // New words arrive lowest level first, so Solo trails what Coach is reading.
  buckets.new.sort((a, b) => ctx.levelOf(a) - ctx.levelOf(b));

  const wantNew = ctx.restricted ? 0 : stochasticRound(count * ctx.newShare, ctx.rng);
  const wantRecent = ctx.restricted ? 0 : stochasticRound(count * MIX.recentShare, ctx.rng);
  const chosen: WordEntry[] = [];
  const take = (bucket: Bucket, n: number) => {
    const taken = buckets[bucket].splice(0, Math.max(0, n));
    chosen.push(...taken);
  };
  take('new', Math.min(wantNew, count));
  take('recent', Math.min(wantRecent, count - chosen.length));
  take('review', count - chosen.length);
  // Shortfalls are filled from what is left: known words before new ones.
  const fallback: Bucket[] = ['rest', 'recent', 'new'];
  for (const bucket of fallback) take(bucket, count - chosen.length);
  return shuffle(chosen, ctx.rng);
}

function isName(word: WordEntry): boolean {
  return word.tags?.includes('name') ?? false;
}

function buildWarmups(
  count: number,
  graphemes: readonly GraphemeOption[],
  input: BuildInput,
  topLevelPatterns: ReadonlySet<string>,
): WarmupItem[] {
  const since = input.now - 14 * DAY_MS;
  const missed = new Set(
    input.attempts
      .filter((a) => a.activity === 'warmup' && a.ts >= since && !isSuccess(a.outcome))
      .map((a) => a.itemId),
  );
  const weight = (g: GraphemeOption) =>
    1 + (topLevelPatterns.has(g.patternId) ? 2 : 0) + (missed.has(g.spelling) ? 3 : 0);
  const targets = weightedSample(graphemes, weight, count, input.rng);
  return targets.map((target, i) => {
    const options =
      input.audioAvailable && i % 2 === 1 ? warmupOptions(target, graphemes, input.rng) : undefined;
    return options
      ? { kind: 'warmup', variant: 'find', target, options }
      : { kind: 'warmup', variant: 'hear', target, options: [target] };
  });
}

function toBuildItem(word: WordEntry, graphemes: readonly GraphemeOption[], rng: Rng): BuildItem {
  return { kind: 'build', wordId: word.id, tiles: buildTiles(word, graphemes, rng) };
}

function toPickItem(
  word: WordEntry,
  lex: Lexicon,
  unlock: UnlockState,
  rng: Rng,
): PickItem | undefined {
  const options = pickWordOptions(word, lex, unlock, rng);
  return options
    ? { kind: 'pick', wordId: word.id, optionIds: options.map((o) => o.id) }
    : undefined;
}

function buildMatches(
  count: number,
  input: BuildInput,
  restricted: boolean,
  scenePool: readonly string[],
): MatchItem[] {
  const done = new Set(input.attempts.filter((a) => a.activity === 'match').map((a) => a.itemId));
  const usable = shuffle(input.sentences, input.rng)
    .filter((s) => s.scene !== undefined && isReadable(s.text, input.unlock, input.lexicon).ok)
    .sort((a, b) => a.levelId - b.levelId);
  const seen = usable.filter((s) => done.has(s.id));
  const unseen = usable.filter((s) => !done.has(s.id));
  const wantSeen = restricted ? count : Math.floor(count / 2);
  const ordered = [
    ...shuffle(seen, input.rng).slice(0, wantSeen),
    ...unseen,
    ...shuffle(seen, input.rng),
  ].filter((s, i, all) => all.findIndex((x) => x.id === s.id) === i);

  const items: MatchItem[] = [];
  for (const sentence of ordered) {
    if (items.length === count) break;
    if (!sentence.scene) continue;
    const choices = sceneChoices(sentence.scene, scenePool, input.pictures, input.rng);
    if (choices) items.push({ kind: 'match', sentenceId: sentence.id, choices });
  }
  return items;
}

/**
 * Build one Solo session plan. Every item is filtered through the checker
 * against the live unlock state before it is emitted.
 */
export function buildSession(input: BuildInput): SessionPlan {
  const { lexicon, unlock, rng, now } = input;
  const counts = ITEM_COUNTS[input.minutes];
  const notes: string[] = [];

  const unlocked = unlockedPatterns(unlock, lexicon.levels);
  const graphemes = listUnlockedGraphemes(input.patterns, input.sounds, unlocked);
  const topLevel = Math.max(0, ...unlock.levels);
  const topLevelPatterns = new Set(lexicon.levels.find((l) => l.id === topLevel)?.patterns ?? []);

  const rolling = rollingAccuracy(
    input.attempts.filter((a) => a.mode === 'solo'),
    MIX.rollingWindow,
  );
  const restricted = rolling !== undefined && rolling < MIX.restrictBelow;
  const boosted = consecutiveHighSessions(input.sessions, MIX.boostAtOrAbove) >= MIX.boostSessions;
  const newShare = boosted ? MIX.boostedNewShare : MIX.newShare;
  const ctx: MixContext = {
    cards: input.cards,
    seen: firstSeen(input.attempts),
    levelOf: (word) => wordLevel(word, lexicon.levels) ?? Number.MAX_SAFE_INTEGER,
    now,
    restricted,
    newShare,
    rng,
  };

  const decodable = [...lexicon.words.values()].filter(
    (w) => !isName(w) && classifyWord(w.text, unlock, lexicon).cls === 'decodable',
  );

  // Pick the Word: needs a cue picture and two decodable minimal pairs.
  const pickable = decodable.filter((w) => {
    const picture = w.pictureId ? input.pictures.get(w.pictureId) : undefined;
    return picture?.cue === true && pickWordOptions(w, lexicon, unlock, rng) !== undefined;
  });
  const pickWords = selectByMix(pickable, counts.pick, ctx);
  const picks = pickWords
    .map((w) => toPickItem(w, lexicon, unlock, rng))
    .filter((item): item is PickItem => item !== undefined);

  // Word Building: decodable words only, never heart words. Needs word audio.
  let builds: BuildItem[] = [];
  if (input.audioAvailable) {
    const used = new Set(pickWords.map((w) => w.id));
    const buildable = decodable.filter(
      (w) => !used.has(w.id) && w.graphemes.length >= 2 && w.graphemes.length <= 5,
    );
    builds = selectByMix(buildable, counts.build, ctx).map((w) => toBuildItem(w, graphemes, rng));
  } else {
    notes.push(SKIPPED_NO_AUDIO_NOTE);
  }

  const scenePool = decodable
    .map((w) => w.pictureId)
    .filter((id): id is string => id !== undefined && input.pictures.has(id));
  const matches = buildMatches(counts.match, input, restricted, [...new Set(scenePool)]);
  const warmups = buildWarmups(counts.warmup, graphemes, input, topLevelPatterns);

  const fillerTargets = graphemes.filter((g) => !topLevelPatterns.has(g.patternId));
  const fillers: SessionItem[] = shuffle(fillerTargets.length > 0 ? fillerTargets : graphemes, rng)
    .slice(0, MIX.requeueGap)
    .map((target) => ({ kind: 'warmup', variant: 'hear', target, options: [target] }));

  return {
    items: [...warmups, ...builds, ...picks, ...matches],
    fillers,
    closer: chooseCloser(input, decodable, pickable, graphemes),
    notes,
    restricted,
    newShare,
  };
}

/**
 * The session always ends on a mastered item. Before anything is mastered,
 * fall back to the best-known word, and finally to a tap-to-hear sound.
 */
export function chooseCloser(
  input: BuildInput,
  decodable: readonly WordEntry[],
  pickable: readonly WordEntry[],
  graphemes: readonly GraphemeOption[],
): SessionItem {
  const strength = (word: WordEntry) => {
    const card = input.cards.get(word.id);
    if (!card) return -1;
    return (isMastered(card) ? 100 : 0) + card.box * 10 + card.correctDays.length;
  };
  const known = shuffle(decodable, input.rng)
    .filter((w) => strength(w) > 10)
    .sort((a, b) => strength(b) - strength(a));
  for (const word of known) {
    if (pickable.includes(word)) {
      const item = toPickItem(word, input.lexicon, input.unlock, input.rng);
      if (item) return item;
    }
    if (input.audioAvailable && word.graphemes.length <= 5) {
      return toBuildItem(word, graphemes, input.rng);
    }
  }
  const target = graphemes[0] ?? {
    spelling: 'a',
    soundId: 'a_short',
    patternId: 'short_a',
    continuous: true,
  };
  return { kind: 'warmup', variant: 'hear', target, options: [target] };
}

/**
 * Re-queue a modeled item at least 3 items later in the same session
 * (spec §8.3), padding with easy fillers when the queue is nearly empty.
 */
export function requeue(
  queue: readonly SessionItem[],
  currentIdx: number,
  item: SessionItem,
  fillers: readonly SessionItem[],
): SessionItem[] {
  const next = queue.slice();
  const remaining = next.length - (currentIdx + 1);
  const padding = fillers.slice(0, Math.max(0, MIX.requeueGap - remaining));
  next.splice(currentIdx + 1 + remaining, 0, ...padding);
  const insertAt = Math.min(next.length, currentIdx + 1 + MIX.requeueGap);
  next.splice(insertAt, 0, item);
  return next;
}

/**
 * Runtime gate: true only when everything the item would put on screen is
 * readable under the live unlock state. The runner skips items that fail.
 */
export function isItemReadable(
  item: SessionItem,
  ctx: {
    lexicon: Lexicon;
    unlock: UnlockState;
    sentences: readonly Sentence[];
  },
): boolean {
  const decodable = (wordId: string) => {
    const entry = ctx.lexicon.words.get(wordId);
    return !!entry && classifyWord(entry.text, ctx.unlock, ctx.lexicon).cls === 'decodable';
  };
  switch (item.kind) {
    case 'warmup': {
      const unlocked = unlockedPatterns(ctx.unlock, ctx.lexicon.levels);
      return item.options.every((o) => unlocked.has(o.patternId));
    }
    case 'build':
      return decodable(item.wordId);
    case 'pick':
      return item.optionIds.every(decodable);
    case 'match': {
      const sentence = ctx.sentences.find((s) => s.id === item.sentenceId);
      return !!sentence && isReadable(sentence.text, ctx.unlock, ctx.lexicon).ok;
    }
  }
}
