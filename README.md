# Reading App

An offline-first iPad web app (PWA) that teaches one kindergarten learner to
**decode words instead of guessing**, and builds her confidence with text
through controlled, high-success reading.

- **Solo mode**: she works alone for 4, 6 or 8 minutes. The app checks every answer.
- **Coach mode**: she reads aloud while a parent scores, a little more text at a time.
- **Parent area**: unlock levels, add words, paste the week's class passage, record audio, read reports, back up.

Everything runs on the device. There are no accounts, no analytics and no
network calls at runtime.

| Document                                                                           | What it is                                                             |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [`READING_APP_SPEC.md`](READING_APP_SPEC.md)                                       | The build spec. Authoritative.                                         |
| [`docs/Reading-App-Executive-Summary.pdf`](docs/Reading-App-Executive-Summary.pdf) | Two-page explainer: what was built and why.                            |
| [`docs/Reading-App-Manual.pdf`](docs/Reading-App-Manual.pdf)                       | Instruction manual for the parent: install, set up, daily use.         |
| [`docs/BUILD_REPORT.md`](docs/BUILD_REPORT.md)                                     | Phase-by-phase results, deviations from the spec, open questions.      |
| [`content/REVIEW.md`](content/REVIEW.md)                                           | Every bundled word, sentence and story, for the parent's read-through. |
| [`tests/DEVICE_CHECKLIST.md`](tests/DEVICE_CHECKLIST.md)                           | Manual checks to run on the real iPad.                                 |

## Setup

Requires Node 20 or later (developed on Node 22).

```bash
npm install
```

```bash
npm run dev
```

The dev server prints a local URL. In development builds, words and spoken
directions fall back to the browser's speech voice so the app is usable before
any audio is recorded. Single letter sounds never use synthetic speech.

## Scripts

| Command                                | What it does                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `npm run dev`                          | Development server with hot reload.                                                                      |
| `npm run build`                        | Typecheck, then production build to `dist/` with the service worker.                                     |
| `npm run preview`                      | Serve the production build at `http://localhost:4173`.                                                   |
| `npm run check`                        | Lint, format check, typecheck, content validation and unit tests with coverage. Run before every commit. |
| `npm run lint` / `npm run format`      | ESLint / Prettier.                                                                                       |
| `npm test` / `npm run test:coverage`   | Vitest unit tests. Coverage must stay at 95% or more in `src/engine/`.                                   |
| `npm run test:e2e`                     | Playwright end-to-end tests in **WebKit** at an iPad viewport, against the production build.             |
| `npm run test:e2e:chromium`            | The same tests in Chromium, for machines without WebKit.                                                 |
| `npm run validate-content`             | Runs the decodability checker over all bundled content. Fails on any unreadable text.                    |
| `npm run audio-manifest`               | Lists every audio clip the content needs and which are bundled. `-- --strict` fails if any is missing.   |
| `npm run review-list`                  | Regenerates `content/REVIEW.md`, keeping the items you have marked `true`.                               |
| `npm run icons`                        | Re-renders the PWA icons from `public/icons/icon.svg`.                                                   |
| `npm run screenshots` / `npm run docs` | Regenerate the manual's screenshots and the PDFs (needs `npm run preview` running).                      |

First-time end-to-end setup on a development machine:

```bash
npx playwright install webkit
```

## How the core guarantee works

The app never shows her a word she has not been taught to read.

1. Every word in `content/lexicon.json` is split into graphemes **by hand**. Each
   grapheme names the taught pattern that makes it decodable (`short_a`, `dig_ch`,
   `suffix_s`…).
2. `content/scope.json` maps levels to patterns. The parent unlocks levels (and
   single patterns) in the parent area.
3. `src/engine/readability.ts` classifies any word as `decodable`, `heart`,
   `not_yet` or `unknown`. Text is readable only if every word is decodable or an
   unlocked heart word.
4. That check runs in three places: in CI over all bundled content
   (`validate-content`), in the session builder before an item is planned, and
   again at render time against the live unlock state. Text that fails is not shown.

The one exception is a Class Passage, which may contain not-yet-taught words
only after they have been pre-taught in the same session.

## Project layout

```
content/          Pure data: graphemes, scope, lexicon, heart words, sentences, stories, pictures, prompts
assets/pictures/  OpenMoji SVG subset plus five original drawings
assets/audio/     Optional bundled clips (sounds/, words/, prompts/). Empty by default.
public/           Icons and the self-hosted Andika font
src/engine/       Pure TypeScript, no React, fully unit tested (checker, scheduler, ladder, session builder…)
src/data/         IndexedDB access, migrations, backup, PIN
src/audio/        Web Audio service, blend scheduling, recording clean-up
src/ui/           Shared components (Word, SoundDots, BlendSlider, SoundItOut, FocusReader…)
src/modes/        solo/, coach/, parent/
src/app/          Routing, data provider, error boundary, home, bookshelf
scripts/          Content validation, audio manifest, review list, icons, screenshots, docs
tests/            unit/ (Vitest) and e2e/ (Playwright)
```

## Deploy

The build is a folder of static files. It must be served over **HTTPS**
(service workers require it). Routing is hash-based and asset paths are
relative, so no rewrite rules are needed and the app works at a domain root or
in a sub-folder.

### Option A: GitHub Pages

1. In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Actions → Deploy to GitHub Pages → Run workflow**.
3. The app is published at `https://<user>.github.io/<repository>/`
   (for this repository: `https://sammahle.github.io/reading_app/`).

A GitHub Pages site is always public. On a free GitHub plan the repository must
be public too; Pages for a private repository needs a paid plan. The app
contains no personal data (her progress stays on the iPad), but choose Netlify
with a password-protected site if you want the app itself private.

### Option B: Netlify

1. **Add new site → Import an existing project**, and pick this repository.
2. Netlify reads `netlify.toml`: build command `npm run build`, publish directory `dist`.
3. Deploy. Use the `https://<name>.netlify.app` address.

### Updating

Deploy again. The next time the iPad opens the app online, the new version
downloads in the background. It is **not** applied mid-session: the parent sees
a dot on the gear and applies it from **Parent area → About → Update now**.

## Install on the iPad

1. Open the site address in **Safari** (not another browser).
2. Tap **Share → Add to Home Screen → Add**.
3. Open the app **from the home screen** once while still online, and leave it
   open for a few seconds. iPadOS keeps home-screen apps separate from Safari,
   so this first launch is what downloads the app for offline use.
4. Hold the gear for 3 seconds, set a PIN, and check **About** shows
   "Ready to work offline". From now on it works in Airplane Mode.

### Guided Access (keeps solo use inside the app)

1. **Settings → Accessibility → Guided Access**: turn it on and set a passcode.
2. Open the Reading app, then **triple-click the top button** (or the Home
   button on older iPads) and tap **Start**.
3. To leave: triple-click again and enter the passcode.

## First-run setup

1. **Record the sounds.** Parent area → **Sound Studio** → "Sounds she is using
   now". There are about 30, and each takes a few seconds. The app is not useful
   without them: sound dots and blending are silent until they exist.
2. **Record directions and words** as time allows, or turn on
   **Settings → Use the iPad's voice until you have recorded** as a stopgap for
   whole words and directions.
3. **Check the levels** match what her class has taught (Levels 1–3 start unlocked).
4. **Read through `content/REVIEW.md`** and mark what you approve.

Bundling audio in the app instead of recording on the iPad: put files in
`assets/audio/sounds/snd_<soundId>.m4a`, `assets/audio/words/wd_<word>.m4a` or
`assets/audio/prompts/pr_<id>.m4a` (`.mp3` and `.wav` also work) and rebuild.
`npm run audio-manifest` lists the exact names. A recording made in Sound Studio
always overrides a bundled clip with the same id.

## Adding content

**From the iPad (no rebuild):**

- **Words**: Parent area → Word list → type the word → _Split into sounds_ →
  confirm each sound → Save.
- **Heart words**: Parent area → Heart words. Tap "♥ irregular" on the parts she
  must know by heart. Example: adding _and_ lets her read it before blends are taught.
- **This week's class passage**: Parent area → Class passage.

**In the repository (bundled for every install):**

1. Edit the JSON in `content/`. A lexicon entry looks like this:

   ```json
   {
     "id": "jam",
     "text": "jam",
     "graphemes": [
       { "spelling": "j", "soundId": "j", "patternId": "cons_j", "continuous": false },
       { "spelling": "a", "soundId": "a_short", "patternId": "short_a", "continuous": true },
       { "spelling": "m", "soundId": "m", "patternId": "cons_m", "continuous": true }
     ],
     "audioWord": "wd_jam"
   }
   ```

   Blends are a word-level skill: add `"requires": ["blend_initial"]` (or
   `blend_final`) rather than changing the graphemes. A silent-e vowel is one
   grapheme written `"a_e"`, `"i_e"`, `"o_e"` or `"u_e"`.

2. Give each sentence the **lowest** `levelId` at which it is readable, and a
   `scene` if it should appear in read-then-match.
3. Run the validator. It names every offending word and the patterns it is missing:

   ```bash
   npm run validate-content
   ```

4. Refresh the review list:

   ```bash
   npm run review-list
   ```

The scope and sequence itself (`content/scope.json`) is data too. If the class
turns out to follow a different order, move patterns between levels there and
re-run the validator.

## Testing

- **Unit** (`tests/unit`): every `engine/` module, the IndexedDB layer against
  `fake-indexeddb`, audio processing, and a property test that no session the
  builder emits contains unreadable text, over random unlock states.
- **End-to-end** (`tests/e2e`): a full Solo session, the help gate, error
  handling, anti-guessing, an offline cold start, backup round-trip, Class
  Passage, the ladder, and the PIN.
- **On the device**: [`tests/DEVICE_CHECKLIST.md`](tests/DEVICE_CHECKLIST.md).

CI (`.github/workflows/ci.yml`) runs all of the automated checks on every push.

## Licenses

- Application code: MIT (see `LICENSE`).
- **Andika** typeface © SIL International, SIL Open Font License 1.1
  (`public/fonts/andika/OFL.txt`).
- **OpenMoji** pictures: CC BY-SA 4.0, © OpenMoji, openmoji.org. The pictures
  `mat`, `pod`, `dot`, `lid` and `mop` were drawn for this app.

The attribution also appears offline in the app under Parent area → About.
