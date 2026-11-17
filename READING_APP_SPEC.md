# Reading App — Build Spec

**Version:** 1.0 (2026-11-16)
**Audience:** Claude Code. This file is the complete, authoritative spec, so build from it.
**Product:** An offline-first iPad web app (PWA) that teaches one kindergarten learner to decode words instead of guessing, and builds confidence with text through controlled, high-success reading.

---

## 0. How to use this spec (instructions to the builder)

1. **Build in the gated phases of §14, in order.** At the end of each phase, run every test, meet that phase's acceptance criteria, then stop and report. The report covers what was built, test results, deviations, and open questions. Do not start the next phase until the owner says to.
2. **The instructional rules in §2 are requirements, not suggestions.** If an implementation detail would violate one, stop and ask. Never trade a rule for convenience.
3. **Zero runtime network access.** No CDNs, remote fonts, analytics, telemetry, external APIs, or accounts. Every asset ships in the bundle and is precached.
4. **Content is data, gated by code.** The app must never render text that fails the decodability checker (§6.4) for the current unlock state. CI fails if any bundled content fails the checker.
5. **Professional quality.** Strict TypeScript, no `any` without a comment saying why, small pure functions in `engine/`, consistent naming, and no dead code or leftover debug UI in production builds.
6. **When a fact is missing** (audio files, illustrations, a sound the learner knows), use the documented placeholder strategy and list the gap in the phase report. Do not invent pedagogy.
7. Keep `README.md` current: setup, scripts, deploy, iPad install, Guided Access setup, and how to add content.

---

## 1. Purpose and learner profile

### 1.1 Problem
The learner is in kindergarten and knows many individual words, but:
- She is **overwhelmed by larger blocks of text**, even when she knows every word in them.
- When she meets an unfamiliar word, she **gives up or guesses**.
- She has **low reading confidence**.

The working hypothesis is that her problem is text load and a missing decoding routine, not her vocabulary. Class passages (around 60 words in long lines) include patterns she has not been taught yet, and she has no reliable fallback when she gets stuck.

### 1.2 Current skills (from school work, Nov 2026)
| Area | Status |
| --- | --- |
| Phoneme segmentation | Counts sounds on her fingers. Solid foundation. |
| Short vowels | *a* and *i* known. *o* is the current class lesson (week of Nov 10). *u* and *e* not yet taught. |
| Consonants taught | m, s, t, p, n, c, f, d, g, h, b, r, l, z (treat any others as not yet taught). |
| Digraphs | *ch* and *th* known. *sh* introduced in class spelling ("shop") but not solid. |
| Word families | Taught as onset + rime (n + ap = nap). |
| Sight words (20) | I, a, the, they, she, he, we, go, see, like, was, is, has, her, can, friend, down, eat, to, are |

### 1.3 Classroom alignment
- **Curriculum:** likely McGraw-Hill *Wonders*. Unconfirmed, so build the scope and sequence as editable data rather than hard-coding it.
- The teacher already puts **sound dots** under words and **marks the irregular part** of sight words. The app uses the same two routines.
- Class word families use onset + rime. The app adds full **sound-by-sound blending** (n-a-p), which transfers better to unfamiliar words, without contradicting the class method.

### 1.4 Usage context
- Used **solo** on her own iPad, and **with a parent** (Coach mode) sometimes.
- Must work **fully offline**. No App Store.
- The parent is a capable developer and will deploy the app and record the audio.

### 1.5 Success criteria (product level)
- She uses the sound-it-out routine instead of guessing or quitting. Measured as completed help uses rising while "modeled" outcomes fall.
- Coach-mode accuracy is ≥ 90% on current-level text.
- She moves up the text-load ladder (§9.2) from single phrases to full short pages.
- She chooses to use the app.

---

## 2. Instructional principles (non-negotiable)

| # | Principle | Implementation requirement |
| --- | --- | --- |
| 1 | Systematic, explicit phonics | Content follows the scope and sequence (§6.1). Nothing appears that hasn't been unlocked. |
| 2 | One decoding routine, used everywhere | **Tap each sound, then swipe to blend** (§8.1). This is the only form of help anywhere in the app. |
| 3 | Decodable text only | Every rendered word is decodable from unlocked patterns or is an unlocked heart word. Enforced by `isReadable` (§6.4). |
| 4 | High success rate | Solo targets ~95% accuracy and Coach targets ~90%. The session builder adapts (§8.5). |
| 5 | Heart words, not shape memorization | Sight words show sound dots on every grapheme. Only the irregular graphemes carry a heart (§6.2). |
| 6 | Gradual release of text load | The text-load ladder (§9.2) decides how much text is visible at once. |
| 7 | Repeated reading | Each story is read 3 times across days (§9.4). |
| 8 | Spaced review | Leitner scheduling for words (§8.6). |
| 9 | Errorless correction | A miss leads to the routine, then the model, then her own correct response. She never ends on a miss. |
| 10 | Short sessions | Solo sessions run 4, 6 or 8 minutes (default 6) and always end on a mastered item. |

**Prohibited anywhere in the app:**
- Picture or context guessing prompts ("What would make sense?", "Look at the picture").
- Pictures shown *before* a text is read. In read-then-match, pictures appear only after the reading step.
- Timers, countdowns, speed scoring, lives, losing, or penalty sounds.
- Random or variable rewards (loot, spins, mystery boxes) and streak-loss mechanics.
- Whole-word audio offered as a shortcut before the learner has tapped through the sounds (§8.1).

---

## 3. Scope

### 3.1 In scope (v1)
- Solo mode with four activities (§8).
- Coach mode with the focus reader, text-load ladder, parent scoring, repeated reading, and Class Passage (§9).
- Parent panel with unlocks, heart-word editor, lexicon editor, Sound Studio (in-app recording), reports, and backup (§10).
- An offline PWA installable to the iPad home screen (§4).

### 3.2 Out of scope (v1)
- Speech recognition. It is unreliable for child speech, especially offline, so adults judge oral reading in Coach mode.
- Multiple learner profiles. The data model should not block adding them later.
- Cloud sync, accounts, and analytics.
- Native app or App Store distribution.
- Any AI or LLM call at runtime.

---

## 4. Platform and architecture

### 4.1 Stack
| Area | Decision | Notes |
| --- | --- | --- |
| Build | Vite, current stable | |
| UI | React + TypeScript (`strict: true`) | Function components and hooks. No class components. |
| State | React context + `useReducer` for session state. Zustand allowed if justified in the phase report. | Keep engine logic outside React. |
| Styling | CSS Modules or plain CSS with custom properties | No UI framework. Design tokens live in `ui/tokens.css`. |
| PWA | `vite-plugin-pwa` (Workbox), `registerType: 'prompt'` | Precache **everything**: JS, CSS, fonts, SVGs, audio, content JSON. |
| Storage | IndexedDB via `idb` | Schema in §11. Versioned, with migrations. |
| Audio | Web Audio API (`AudioContext`) with decoded `AudioBuffer`s | HTML `<audio>` lags on iOS. See §12. |
| Tests | Vitest (unit), Playwright with **WebKit** (e2e, offline) | |
| Lint/format | ESLint (typescript-eslint, react-hooks) + Prettier | CI fails on lint errors. |
| Hosting | Static HTTPS host (GitHub Pages or Netlify, chosen by the owner) | Service workers require HTTPS. Provide deploy instructions for both. |

### 4.2 Target device
- iPad running current iPadOS, using Safari "Add to Home Screen." The exact model is unconfirmed, so test layouts at 1024×768 (minimum) up to 1366×1024 (iPad Pro 12.9").
- Landscape is the primary layout, and portrait must also work.
- Home-screen web apps on iPadOS run in standalone mode. Set `display: standalone` and `viewport-fit=cover` in the manifest, and respect the safe areas.

### 4.3 Repository structure
```
/
├─ README.md
├─ READING_APP_SPEC.md            # this file
├─ index.html
├─ vite.config.ts
├─ public/
│  ├─ icons/                      # PWA icons (incl. apple-touch-icon 180x180)
│  └─ fonts/andika/               # self-hosted woff2 (SIL OFL) + OFL.txt
├─ content/                       # pure data, JSON (or TS consts), no logic
│  ├─ graphemes.json
│  ├─ scope.json                  # levels → pattern ids
│  ├─ lexicon.json                # every word, explicitly segmented
│  ├─ heartWords.json
│  ├─ sentences.json
│  ├─ stories.json
│  └─ pictures.json               # picture id → bundled SVG path
├─ assets/
│  ├─ audio/sounds/               # snd_<soundId>.m4a
│  ├─ audio/words/                # wd_<word>.m4a
│  ├─ audio/prompts/              # spoken UI directions, pr_<id>.m4a
│  └─ pictures/                   # OpenMoji SVG subset (CC BY-SA 4.0)
├─ src/
│  ├─ engine/                     # pure TS, no React, 100% unit tested
│  │  ├─ types.ts
│  │  ├─ tokenize.ts
│  │  ├─ segment.ts
│  │  ├─ readability.ts           # isReadable, classifyWord
│  │  ├─ heart.ts                 # computes heart marks from unlock state
│  │  ├─ scheduler.ts             # Leitner
│  │  ├─ ladder.ts                # Coach text-load ladder
│  │  ├─ sessionBuilder.ts
│  │  ├─ distractors.ts
│  │  └─ metrics.ts
│  ├─ data/                       # IndexedDB access layer + migrations
│  ├─ audio/                      # AudioService, blend scheduler, unlock
│  ├─ ui/                         # shared components (§7)
│  ├─ modes/
│  │  ├─ solo/
│  │  ├─ coach/
│  │  └─ parent/
│  ├─ app/                        # routing, providers, error boundary
│  └─ main.tsx
├─ scripts/
│  ├─ validate-content.ts         # runs checker over all content; used in CI
│  └─ audio-manifest.ts           # lists required clips and reports missing ones
└─ tests/
   ├─ unit/
   └─ e2e/
```

### 4.4 Routing
Use a minimal hash-based router (no server rewrites needed on static hosts):
`#/` (home) · `#/solo` · `#/coach` · `#/coach/read/:id` · `#/parent` (PIN-gated) · `#/parent/*`.

---

## 5. Domain model (TypeScript)

Put these in `src/engine/types.ts`. Names are binding. Fields may be added if justified.

```ts
export type SoundId = string;          // e.g. "m", "a_short", "th_voiced", "e_long", "schwa"
export type PatternId = string;        // e.g. "short_a", "cons_m", "dig_ch", "suffix_s"
export type LevelId = number;          // 1..8

export interface Grapheme {
  spelling: string;                    // "ch", "a", "s"
  soundId: SoundId;                    // the sound THIS grapheme makes in THIS context
  patternId: PatternId;                // which taught pattern makes it decodable
  continuous: boolean;                 // can be held (m, s, f, a...) vs stop (b, t, p...)
}

export interface WordEntry {
  id: string;                          // lowercase word, e.g. "chip"; homographs get suffix
  text: string;                        // display form, lowercase
  graphemes: Grapheme[];               // explicit, hand-verified segmentation
  pictureId?: string;
  audioWord?: string;                  // "wd_chip"
  minimalPairs?: string[];             // ids of words differing by one grapheme (for Pick the Word)
  tags?: string[];                     // "noun", "verb", "name" ...
  isHeartWord?: false;
}

export interface HeartWordEntry {
  id: string;                          // "they"
  text: string;
  graphemes: Grapheme[];               // full segmentation, INCLUDING irregular graphemes
  irregularIdx: number[];              // indexes into graphemes that are irregular *by nature*
  unlockLevel: LevelId;                // when it becomes available as a heart word
  audioWord: string;
  pictureId?: string;
  isHeartWord: true;
}

export interface Level {
  id: LevelId;
  title: string;                       // "Short o"
  patterns: PatternId[];
}

export interface Scene {                // for read-then-match pictures
  subject: string;                     // pictureId, e.g. "cat"
  object?: string;                     // pictureId, e.g. "mat"
  relation?: "on" | "in" | "with" | "next_to" | "none";
}

export interface Sentence {
  id: string;
  text: string;                        // "The cat is on a mat."
  levelId: LevelId;                    // highest level required
  scene?: Scene;                       // required if used in read-then-match
  chunks?: number[];                   // token indexes where phrase breaks occur (focus reader)
}

export interface Story {
  id: string;
  title: string;
  levelId: LevelId;
  pages: Sentence[][];                 // page → sentences
  source: "app" | "class_passage";
}

export type Outcome = "correct" | "self_corrected" | "helped" | "modeled";

export interface Attempt {
  id: string;                          // uuid
  ts: number;                          // epoch ms
  mode: "solo" | "coach";
  activity: "warmup" | "build" | "pick" | "match" | "read";
  itemId: string;                      // word id, sentence id, or grapheme spelling
  outcome: Outcome;
  usedHelp: boolean;                   // opened sound-it-out
  completedHelp: boolean;              // tapped all dots AND swiped the blend
  sessionId: string;
}

export interface UnlockState {
  levels: LevelId[];                   // unlocked levels
  extraPatterns: PatternId[];          // individually unlocked patterns
  lockedPatterns: PatternId[];         // individually locked overrides
  heartWords: string[];                // unlocked heart word ids
}
```

**Why every word is explicitly segmented:** automatic segmentation is ambiguous (voiced vs unvoiced *th*, *s* as /s/ vs /z/, *c* vs *ch*). The lexicon is the source of truth, and `segment.ts` only proposes a split when a parent adds a new word, for the parent to confirm.

---

## 6. Content model

### 6.1 Scope and sequence (default; editable in the parent panel)
| Level | Title | Patterns | Example words | Default state |
| --- | --- | --- | --- | --- |
| 1 | Short a, i | short a, short i; consonants m s t p n c f d g h b r l z | cap, map, sit, pin | **Unlocked** |
| 2 | Short o | short o | hop, dog, top, pot | **Unlocked** (current class lesson) |
| 3 | ch, th | ch; th (voiced and unvoiced) | chip, chat, this, math | **Unlocked** |
| 4 | Ending -s | suffix -s as /s/ and as /z/ | hops, dogs, has, is | Locked (unlock when ready; it already appears in class passages) |
| 5 | sh | sh | ship, shop, fish | Locked (next new skill) |
| 6 | Short u, e | short u, short e | sun, bed, run | Locked |
| 7 | Blends | initial (st, sp, fl, gr, tr…) and final (-nd, -st, -mp, -nt) | stop, pond, hand | Locked (Class Passage pre-teach only) |
| 8 | ck, wh, silent-e | ck, wh, a_e, i_e, o_e, u_e | duck, cake, like | Locked |

A level unlocks all of its patterns. The parent can also lock or unlock individual patterns.

### 6.2 Heart words
Heart marks are **computed**, never hand-stored per state:

```
heartIdx(word, unlock) = graphemes indexes i where
    i ∈ word.irregularIdx  OR  graphemes[i].patternId ∉ unlockedPatterns(unlock)
```

So "she" shows hearts on *sh* and *e* until Level 5 unlocks *sh*. After that only *e* has a heart. When a pattern unlocks, every heart word containing it updates automatically.

**Starting heart word set** (all 20 unlocked at install):

| Word | Segmentation (spelling→sound) | Irregular by nature | Heart drops when |
| --- | --- | --- | --- |
| can | c→k, a→a_short, n→n | — | Decodable now; store as a regular word, not a heart word |
| is | i→i_short, s→z | — | Level 4 (suffix_s /z/ pattern) |
| has | h→h, a→a_short, s→z | — | Level 4 |
| the | th→th_voiced, e→schwa | e | Stays partly a heart word |
| they | th→th_voiced, ey→a_long | ey | Stays partly a heart word |
| he | h→h, e→e_long | e | When open syllables are taught (future) |
| we | w→w, e→e_long | e (w not yet taught → also hearted) | Future |
| go | g→g, o→o_long | o | Future |
| she | sh→sh, e→e_long | e | sh at Level 5; e stays |
| see | s→s, ee→e_long | ee | Vowel teams (future) |
| eat | ea→e_long, t→t | ea | Vowel teams (future) |
| like | l→l, i_e→i_long, k→k | i_e (k not yet taught → hearted) | Level 8 |
| her | h→h, er→er | er | R-controlled (future) |
| I | I→i_long | I | Stays a heart word |
| a | a→schwa | a | Stays a heart word |
| to | t→t, o→oo | o | Stays a heart word |
| was | w→w, a→schwa, s→z | a | Partly a heart word |
| are | are→ar | are | Stays a heart word |
| down | d→d, ow→ow, n→n | ow | When *ow* is taught (future) |
| friend | f→f, r→r, ie→e_short, n→n, d→d | ie | Stays partly a heart word |

Note: "like" uses the split digraph *i_e*. Represent it as grapheme spelling `"i_e"` spanning the *i* and the final *e*. The `Word` UI component must render one dot under *i* and link it visually to *e* (a small arc). The same goes for any future silent-e word.

### 6.3 Sound inventory
`graphemes.json` defines every SoundId with its clip file. Minimum set for v1:

- **Consonants:** b, c/k (one sound id `k`), d, f, g, h, l, m, n, p, r, s, t, w, z, plus `ch`, `sh`, `th_voiced`, `th_unvoiced`.
- **Short vowels:** a_short, i_short, o_short, u_short, e_short.
- **Heart-word sounds:** e_long, o_long, i_long, a_long, oo, ow, er, ar, schwa.

The `audio-manifest.ts` script prints every clip the bundled content requires and flags missing files.

### 6.4 Decodability checker (core guarantee)
```ts
type WordClass = "decodable" | "heart" | "not_yet" | "unknown";

classifyWord(token: string, unlock: UnlockState, lex: Lexicon): {
  cls: WordClass; missingPatterns: PatternId[]; entry?: WordEntry | HeartWordEntry;
}

isReadable(text: string, unlock: UnlockState, lex: Lexicon): {
  ok: boolean; offenders: { token: string; cls: WordClass; missingPatterns: PatternId[] }[];
}
```
Rules:
- Tokenize on whitespace, strip leading and trailing punctuation, and compare case-insensitively. "I" is matched as the heart word *I*.
- `decodable`: the token is in the lexicon and every grapheme's `patternId` is unlocked.
- `heart`: the token is an **unlocked** heart word. Its tricky parts are allowed.
- `not_yet`: the token is in the lexicon or heart list, but required patterns are locked or the heart word itself is locked.
- `unknown`: the token is not in the lexicon.
- `ok` is true only if every token is `decodable` or `heart`.
- **Proper names** (Bob, Tom, Pam) are lexicon entries tagged `name` and segmented like any word.
- `scripts/validate-content.ts` runs `isReadable` on every sentence and story at **its own level's unlock state** (that level and everything below it, plus the heart words available at it), and exits non-zero on failure, printing each offending token and its missing patterns.
- At runtime, every render path for reading text calls `isReadable` with the live unlock state and refuses to show failing text. It logs a dev warning and the session builder skips that item. The one exception is Class Passage (§9.5), which deliberately shows `not_yet` words *after* pre-teaching them.

### 6.5 Pictures
- Use **OpenMoji** SVGs (CC BY-SA 4.0), bundling only the subset actually used. Add an About screen in the parent panel with attribution and a license link. The app shows it offline; the link isn't required to work.
- Each picturable noun or verb in the lexicon has a `pictureId`.
- **Read-then-match scenes** are composed from two pictures and a relation: the subject drawn over or beside the object. Distractors change **exactly one** element (a different subject, a different object, or a different relation), so she has to read every content word. `distractors.ts` generates them and guarantees each one is visually distinct.

### 6.6 Seed content (Phase 0 deliverable)
At launch, across Levels 1–5:
- At least 150 lexicon words, each with explicit segmentation and, where picturable, a picture.
- At least 60 sentences with scenes where possible. Each sentence is 3–8 words.
- At least 12 stories of 2–4 pages, 1–3 sentences per page.
- Words should be concrete and kid-relevant (animals, food, family actions). No proper names beyond a small set of easy ones (Bob, Tom, Pam, Sam).
- You may draft the content, but all of it must pass `validate-content` **and** be listed in `content/REVIEW.md` for the parent's read-through. Mark each item `reviewed: false` until the parent approves it.

**Test fixture (original text written to mirror the class passage's shape; use it in e2e and Class Passage tests):**
> I see Pam. She has a cat. The cat sits on the mat. Pam can pat the cat. Pam and her friend go to the pond. They stop at the top. I like to see Pam and her cat run.

At the default unlock state (Levels 1–3 + all 20 heart words), the expected classification is:
- `decodable`: Pam, cat, on, mat, can, pat, at, top
- `heart`: I, see, she, has, a, the, her, friend, go, to, they, like
- `not_yet`: sits (suffix -s, L4), and (final blend -nd, L7), pond (L7), stop (L7), run (short u, L6)

Write this as a snapshot test. Note that *and* is not decodable until blends unlock. Because it is so frequent, the parent may add it as an early heart word. Leave that to the parent; don't add it by default.

---

## 7. Shared UI components (`src/ui/`)

| Component | Responsibility | Key props and behavior |
| --- | --- | --- |
| `Word` | Renders one word with optional SoundDots, heart marks, and highlight state | `entry`, `unlock`, `showDots`, `onTap`. Hearts appear above the affected graphemes, and a split digraph shows an arc. |
| `SoundDots` | One dot per grapheme under the word | Tapping a dot plays that grapheme's sound and briefly highlights its letters. Tracks which dots have been tapped. |
| `BlendSlider` | A track under the word with a draggable thumb | As the thumb enters each grapheme's span, that sound plays. Continuous sounds are held while inside the span; stop sounds play once. Fires `onComplete` when it reaches the end. Works left-to-right only. |
| `SoundItOut` | Overlay that runs the full routine (§8.1) on a word | Orchestrates SoundDots → BlendSlider → whole-word reveal. Reports `usedHelp` and `completedHelp`. |
| `FocusReader` | Shows text one chunk at a time | `chunkSize` from the ladder. Past chunks dim to 35% opacity and future chunks are hidden. Advances on tap or swipe. |
| `PictureChoice` | Grid of 3 tappable pictures or scenes | Large targets. Debounced input (§8.4). |
| `WordChoice` | Grid of 3 word cards | Same rules as PictureChoice. |
| `TileBoard` | Letter tiles plus sound boxes for word building | Drag and drop with tap-to-place as a fallback. One box per grapheme, so a digraph is one tile. |
| `ParentStrip` | Coach-mode scoring bar | ✓ correct · ↻ self-corrected · ✕ needed help, plus the correction script. |
| `Bookshelf` | Her collection of completed sentences and stories | Tapping one rereads it in FocusReader. |
| `PromptAudio` | Plays spoken directions | Each screen auto-plays its direction once, and a speaker icon replays it. |

### 7.1 Visual design tokens
- **Font:** Andika (SIL, OFL), self-hosted woff2. It has a single-story *a* and *g*, which beginning readers expect.
- **Text sizes:** single word ≥ 56 pt, sentence ≥ 40 pt, line-height 1.6, letter-spacing +0.02em, word-spacing +0.25em.
- **Touch targets:** ≥ 60 pt, letter tiles ≥ 80 pt, ≥ 16 pt between targets.
- **Palette:** calm, low saturation, plain backgrounds behind text. Text contrast ≥ 7:1 (WCAG AAA). Dots are neutral gray, turning an accent color once tapped. Hearts are a soft red.
- **Motion:** short (≤ 200 ms) and purposeful. Respect `prefers-reduced-motion`.
- **Feedback:**
  - Correct: a soft chime and a gentle check.
  - Miss: a neutral slide transition into help, with **no** buzzer, red X, or shake.
- **No instructional text she has to read.** All directions are spoken and use icons.

---

## 8. Solo mode

The learner uses it alone, so every activity must be verifiable by the app with no microphone. Content is drawn one step easier than Coach mode, targeting about 95% accuracy.

### 8.1 Sound-it-out routine (the only help)
1. She taps a word, or it opens automatically after a miss. The word splits into graphemes, with a dot under each.
2. She taps each dot to hear its sound. Heart graphemes play their actual sound and show the heart.
3. She drags along the BlendSlider, and the sounds play in sequence and run together.
4. The direction plays: "Say the word." There's a short pause of about 1.5 s.
5. Only now does a speaker button appear. Tapping it plays the whole word to confirm.

**Gate:** whole-word audio is unreachable until every dot has been tapped at least once and the slider has completed. `completedHelp = true` only if steps 2 and 3 were done.

### 8.2 Activities
| Activity | Flow | Verified by | Item source |
| --- | --- | --- | --- |
| **Sound warm-up** | (a) A grapheme shows and she taps it to hear it. (b) A sound plays and she picks the matching grapheme from 3. | Correct tile | Unlocked graphemes, weighted toward recent and missed ones |
| **Word building** | A picture shows (if available) and the word audio plays. She drags tiles into sound boxes, one box per grapheme. Tiles = correct graphemes + 2 distractors. | Tile sequence matches | Decodable words only. **Never heart words.** |
| **Pick the word** | A picture shows. She picks from 3 words: the target + 2 minimal pairs (e.g. cat / cot / cut). | Correct word | Decodable words with ≥ 2 unlocked minimal pairs |
| **Read then match** | A sentence shows alone. After she taps "done" (or 4 s pass), 3 scenes appear. She taps the matching one. | Correct scene | Sentences with scenes |

**Minimal-pair rule:** distractors must be real lexicon words that are readable under the current unlock state, and must differ from the target by exactly one grapheme.

### 8.3 Error handling (all activities)
1. **First miss:** a neutral transition, then SoundItOut opens on the target word (warm-up replays the sound instead). She tries again.
2. **Second miss:** the app models the answer (sounds, blend, whole word), then highlights the correct choice and she taps it herself. Outcome = `modeled`.
3. The item is re-queued later in the same session (at least 3 items later) and its Leitner box resets (§8.6).

### 8.4 Anti-guessing guardrails
- Taps on choices within 1.0 s of the prompt finishing are ignored.
- Three wrong taps within 3 s pause input for 2 s with a calm "Let's look closely" prompt, then run the routine.
- Answer positions are shuffled every time.
- Rewards are tied only to completed items. Fast tapping never earns anything.

### 8.5 Session builder
- Length: parent-set at 4, 6 or 8 minutes (default 6). When time is up, the current item finishes, and then one mastered item closes the session.
- Default order (about 6 minutes):
  1. Sound warm-up: 4 items
  2. Word building: 4 items
  3. Pick the word: 5 items
  4. Read then match: 3 sentences
  5. Finish: the new sentence or story goes on the Bookshelf
- Item mix: about 70% review (due by the scheduler), 20% recent (introduced in the last 7 days), and 10% new.
- **Adaptive difficulty:** keep a rolling accuracy over her last 10 items. Below 85%, draw only review and mastered items until accuracy recovers. At 98% or above for 2 sessions, raise the new-item share to 20%.
- Every item is filtered through `isReadable` against the live unlock state.

### 8.6 Spaced review (Leitner)
- 5 boxes with intervals of **0, 1, 2, 4 and 8 days**. New words start in box 1.
- `correct` (no help): move up one box. `helped` or `self_corrected`: stay. `modeled`: back to box 1.
- **Mastered** means correct with no help on **3 different calendar days**, at box 4 or higher.
- Coach-mode ✕ words enter box 1 of the Solo queue.

### 8.7 Rewards
- **Bookshelf:** each completed sentence or story becomes a book spine she can tap to reread, so progress is reading.
- A simple day tracker (a dot per day she practiced) that **never shows lost streaks**.

---

## 9. Coach mode

She reads aloud while a parent scores. This mode builds oral fluency and tolerance for more text.

### 9.1 Focus reader
- Only the current chunk shows at full contrast. Past chunks dim and future chunks are hidden.
- She advances by tapping or swiping (no auto-advance), and any word can be tapped to open SoundItOut.
- Chunks come from `Sentence.chunks` when present, otherwise from a phrase-break heuristic: break at punctuation, then aim for 2–4 words.

### 9.2 Text-load ladder
| Rung | Chunk shown |
| --- | --- |
| 1 | One word |
| 2 | One phrase (2–4 words) |
| 3 | One line (one sentence) |
| 4 | Two lines |
| 5 | Full page (3–5 lines) |

- Move up after **2 consecutive Coach sessions at ≥ 90%** word accuracy.
- Move down after **one session below 80%**.
- The parent can override the rung manually. The override is logged.
- The default starting rung is **2**.

### 9.3 Parent scoring
- `ParentStrip` sits at the screen edge nearest the parent (left or right, configurable).
- **Per-chunk fast path:** one ✓ scores the whole chunk correct. Long-pressing a word in the chunk scores that word individually (✓ / ↻ / ✕).
- Accuracy = (correct + self_corrected) / total words. `helped` counts as an error for ladder purposes.
- Every ✕ word is logged as a stall word and added to the Solo review queue.
- The **correction script** shows on the strip so every adult uses the same words:
  1. "Look at all the letters."
  2. "Tap the sounds" (or point to the dots).
  3. "Slide and blend."
  4. If she's still stuck: model it, then "Your turn. Read it again."

  Also on the strip: **Don't say** "What would make sense?" or "Look at the picture."

### 9.4 Repeated reading
- Each story has a 3-star track: read 1, read 2 (same day or the next), and read 3 (later that week).
- The home screen surfaces stories that are due for their next read.
- Stars are earned by **completing** a read, never by speed.

### 9.5 Class Passage (homework support)
1. In the parent panel, the parent pastes or types the week's class passage and gives it a title.
2. The checker classifies every token as `decodable`, `heart`, `not_yet`, or `unknown`.
3. For each `unknown` word, the parent adds it to the lexicon (the editor proposes a segmentation via `segment.ts`, and the parent confirms) or marks it as a **one-time heart word** for this passage.
4. **Pre-teach** runs before reading: a 1–2 minute warm-up on the `not_yet` and one-time heart words only, using SoundItOut cards (and heart-word cards for irregular ones).
5. She reads the passage in FocusReader at her current ladder rung (never forced to rung 5).
6. The passage is saved as a `Story` with `source: "class_passage"` and gets the repeated-reading star track.

This is the **only** path where `not_yet` words are shown, and only after pre-teaching them in the same session.

---

## 10. Parent panel

### 10.1 Access
- Enter by holding the gear icon in a corner for 3 seconds, then entering a 4-digit PIN.
- The PIN is set on first run, stored as a SHA-256 hash with a random salt (SubtleCrypto), and can be reset from inside the panel.
- The panel auto-locks after 5 minutes of inactivity or when the app goes to the background.

### 10.2 Controls
- **Levels and patterns:** unlock or lock each level, with per-pattern overrides. Before applying a change, show a preview of how many content items become available.
- **Heart words:** add a word, confirm its segmentation, tap the irregular graphemes, choose the unlock level, attach a picture, and link a word audio clip.
- **Lexicon editor:** add or edit regular words, including segmentation, picture, and minimal pairs (auto-suggested and confirmable).
- **Class Passage:** see §9.5.
- **Session settings:** Solo length (4/6/8 minutes), daily Solo limit (default 2 sessions), and which side the ParentStrip sits on.
- **Backup:** export all IndexedDB stores as one versioned JSON file (`readingapp-backup-YYYYMMDD.json`), and import with schema validation and a confirmation dialog. Import replaces existing data. Never silently merge.
- **About:** version, licenses (Andika OFL, OpenMoji CC BY-SA 4.0), and a privacy statement.

### 10.3 Sound Studio (in-app recording)
The parent records all audio on the iPad itself, so nothing depends on a desktop audio workflow.
- Lists every required clip (from the audio manifest) with its status: missing, bundled, or recorded.
- For each clip: record (MediaRecorder; Safari produces `audio/mp4`), play back, re-record, and delete.
- **Auto-processing** after recording: trim leading and trailing silence (RMS threshold), normalize peak to −1 dBFS, and add 10 ms fades.
- Each sound clip shows its articulation guidance. Continuous sounds are held about 0.6 s. Stop sounds are clipped with no added vowel (/b/ not "buh").
- Recorded clips are stored in IndexedDB and **override** bundled clips with the same id.
- A "Test blend" button plays a sample word with the current clips.

### 10.4 Reports
| Report | Content |
| --- | --- |
| Stall words | Ranked by (misses + help uses) over the last 14 days, with last-seen date and current Leitner box |
| Pattern accuracy | Accuracy per pattern over the last 14 days, with weak patterns highlighted (e.g. short *o* vs short *u*) |
| Help use | Help opened vs completed per session. A rising completion rate means the routine is replacing guessing. |
| Ladder | Current rung and a rung-over-time history |
| Session log | Date, mode, duration, items, accuracy |

Present the history and trend views as charts rendered locally (inline SVG, no chart library unless justified).

### 10.5 Privacy
All data stays on the device. There are no network calls, accounts, analytics, or third-party scripts. The backup file leaves the device only when the parent exports it.

---

## 11. Persistence (IndexedDB)

Database `readingapp`, versioned. Write a migration for every version bump.

| Store | Key | Content |
| --- | --- | --- |
| `settings` | `"settings"` | PIN hash/salt, session length, daily limit, strip side, schema version |
| `unlock` | `"unlock"` | `UnlockState` |
| `attempts` | `id` | `Attempt`, with indexes on `ts`, `itemId`, `sessionId` |
| `leitner` | `wordId` | `{ box, dueTs, correctDays: string[] }` (ISO dates) |
| `ladder` | `"ladder"` | `{ rung, history: {ts, rung, reason}[] }` |
| `stories` | `id` | Repeated-reading progress and class passages |
| `customContent` | `id` | Parent-added lexicon words and heart words |
| `audio` | `clipId` | `Blob` recordings from Sound Studio |
| `sessions` | `id` | Session summaries |

- Request persistent storage at first launch with `navigator.storage.persist()`, and show its status in the panel.
- The parent panel shows the last backup date, with a gentle reminder after 30 days.

---

## 12. Audio system

- **AudioService** is a singleton that owns one `AudioContext`. It is created or resumed on the **first user gesture**, which iOS requires. The home screen has a large "Start" button that also unlocks audio.
- At launch it preloads and decodes every clip needed for the unlocked content into an `AudioBuffer` cache, preferring Sound Studio recordings over bundled clips.
- **Latency target:** under 50 ms from tap to sound on the device.
- **Blend playback** has two modes:
  1. Scrub (BlendSlider): plays each grapheme as the thumb enters its span. Continuous sounds loop a sustain segment while held. Stop sounds play once.
  2. Auto-blend (the modeling step): schedules clips back to back with an 80 ms equal-power crossfade between continuous sounds and no overlap after stop sounds.
- **Missing clip fallback** (development only): `speechSynthesis` for **whole words and prompts only**, never for single sounds. A missing sound clip shows a visible "missing audio" badge in dev builds, and production builds block a level from unlocking if its sound clips are missing.
- **Prompt audio:** about 25 short spoken directions ("Tap the sounds," "Slide and blend," "Find the picture," "Your turn," "Great reading"). They're recorded in Sound Studio and listed in the manifest.

---

## 13. Accessibility, robustness, and quality

- Works in both orientations, and the layout reflows without clipping at 1024×768.
- `prefers-reduced-motion` is respected.
- **Muted device:** audio-dependent items (warm-up part b, word building) are skipped with a parent-visible note, and the session continues.
- A React error boundary per mode shows a calm "Let's start again" screen, records the error locally (viewable in the parent panel), and never shows a stack trace to the learner.
- **Guided Access:** the README documents how to enable it (Settings → Accessibility → Guided Access) so solo use stays inside the app.
- **Performance:** first interaction under 2 s on device after install, and transitions at 60 fps.
- **Lighthouse PWA checks** pass: installable, offline, valid manifest, and icons (including `apple-touch-icon`).

---

## 14. Build phases and acceptance gates

Stop at the end of each phase and report (§0.1).

| Phase | Deliverable | Acceptance criteria |
| --- | --- | --- |
| **0. Foundations + content engine** | Repo scaffold, lint/test/CI, `engine/` types, tokenize, segment proposal, `classifyWord`/`isReadable`, heart computation, `validate-content`, `audio-manifest`, Levels 1–5 seed content, `REVIEW.md` | Unit test coverage ≥ 95% in `engine/`. All content passes the checker. The fixture (§6.6) classifies exactly as snapshotted. A deliberately bad sentence fails with the right missing patterns named. Heart marks for all 20 heart words are correct at Levels 3, 4 and 5. |
| **1. Core reading UI + audio** | Tokens and fonts; `Word`, `SoundDots`, `BlendSlider`, `SoundItOut`; AudioService; Sound Studio (it's needed early to produce audio) | On device: tap-to-sound under 50 ms. The whole-word button is unreachable until the routine completes (unit + e2e tested). Split digraph rendering is correct for "like." Sound Studio records, trims, normalizes, and overrides a bundled clip. |
| **2. Solo mode** | All 4 activities, error handling, guardrails, session builder, Leitner, Bookshelf | A 6-minute session completes end to end (e2e). Rapid random tapping cannot complete any item (e2e). The session ends on a mastered item. Leitner transitions match the §8.6 table (unit). Only readable items ever render (property test over random unlock states). |
| **3. PWA packaging** | Manifest, icons, service worker precache, update prompt, persistent storage, IndexedDB with migrations | Installs from Safari to the home screen. A cold start in airplane mode works with all content and audio. Progress survives a force-quit and a reboot. Playwright WebKit offline test passes. |
| **4. Coach mode** | FocusReader, ladder, ParentStrip, correction script, repeated reading, Class Passage | Ladder moves up and down per §9.2 (unit). A ✕ word appears in the Solo review queue. The fixture passage runs through pre-teach and then reading at rung 2. |
| **5. Parent panel** | PIN gate, unlock editor, heart word and lexicon editors, reports, backup/import, About | A new heart word added in the panel appears in Solo within one session. Backup → clean install → import restores all stores exactly (e2e). The PIN is never stored in plaintext. |
| **6. Pilot hardening** | Fixes and tuning from 2 weeks of real use | Owner sign-off. No open P1 bugs. Content `REVIEW.md` fully approved. |

### 14.1 Testing requirements
- **Unit** (Vitest): every `engine/` module, plus the IndexedDB layer against `fake-indexeddb`.
- **Property tests** (fast-check): over random unlock states, nothing the session builder emits fails `isReadable`.
- **E2E** (Playwright, WebKit project, iPad viewport): a Solo session, the help gate, anti-guessing, an offline cold start, backup round-trip, and Class Passage.
- **Manual device checklist** (in `tests/DEVICE_CHECKLIST.md`): install, audio unlock, latency feel, touch targets, Guided Access, orientation, and a muted device.

---

## 15. Open items (owner to resolve; use placeholders until then)

| Item | Placeholder strategy |
| --- | --- |
| Curriculum confirmation (likely McGraw-Hill *Wonders*) and the year's letter and sight-word schedule | Keep scope data-driven. Defaults are in §6.1. |
| iPad model and iPadOS version | Test the viewport range in §4.2. |
| Audio recordings | Sound Studio (§10.3). Dev-only TTS fallback for words and prompts. |
| Hosting choice | Document both GitHub Pages and Netlify. |
| App name and icon | Use the working name "Reading App" and a simple book-icon placeholder. Make both config values. |
| Teacher conversation and screening | Not a build item. Noted for the owner. |

---

## 16. Glossary
- **Grapheme:** a letter or letter group that spells one sound (*sh*, *a*, *i_e*).
- **Heart word:** a high-frequency word with one or more irregular parts. Only those parts are memorized "by heart."
- **Decodable:** readable using only taught letter-sound patterns.
- **Continuous vs stop sound:** a continuous sound can be held (/m/, /s/, /a/). A stop sound is a short burst (/b/, /t/, /p/).
- **Minimal pair:** two words that differ by exactly one grapheme (cat / cot).
- **Onset-rime:** splitting a word into its first consonant(s) and the rest (n + ap). Contrast with full segmentation (n-a-p).
