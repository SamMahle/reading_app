import { useMemo, useState } from 'react';
import { useApp } from '@/app/AppData';
import { audio } from '@/audio/AudioService';
import { soundClipsForLevel } from '@/content/audioManifest';
import { CONTENT, SOUND_MAP } from '@/content/index';
import { unlockedPatterns } from '@/engine/lexicon';
import { classifyWord, partitionReadable } from '@/engine/readability';
import type { Level, Lexicon, PatternDef, UnlockState } from '@/engine/types';
import { navigate } from '@/app/router';

interface Counts {
  words: number;
  sentences: number;
  stories: number;
}

/** How much content is available under an unlock state (for the change preview). */
function countAvailable(unlock: UnlockState, lexicon: Lexicon): Counts {
  const words = [...lexicon.words.values()].filter(
    (w) => classifyWord(w.text, unlock, lexicon).cls === 'decodable',
  ).length;
  const sentences = partitionReadable(CONTENT.sentences, unlock, lexicon).shown.length;
  const stories = CONTENT.stories.filter(
    (story) =>
      partitionReadable([{ text: story.title }, ...story.pages.flat()], unlock, lexicon).refused
        .length === 0,
  ).length;
  return { words, sentences, stories };
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

interface Proposal {
  title: string;
  unlock: UnlockState;
}

const LEVEL_PATTERNS = new Set(CONTENT.levels.flatMap((l) => l.patterns));
const OTHER_PATTERNS = CONTENT.patterns.filter(
  (p) => !LEVEL_PATTERNS.has(p.id) && p.group !== 'irregular',
);

/** Levels and patterns (spec §10.2), with a preview before any change is applied. */
export function LevelsPanel() {
  const app = useApp();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const unlocked = useMemo(() => unlockedPatterns(app.unlock, CONTENT.levels), [app.unlock]);
  const preview = useMemo(() => {
    if (!proposal) return null;
    const before = countAvailable(app.unlock, app.lexicon);
    const after = countAvailable(proposal.unlock, app.lexicon);
    return {
      words: after.words - before.words,
      sentences: after.sentences - before.sentences,
      stories: after.stories - before.stories,
    };
  }, [proposal, app.unlock, app.lexicon]);

  const toggleLevel = (level: Level) => {
    setBlocked(null);
    const on = app.unlock.levels.includes(level.id);
    if (!on) {
      // Production builds do not unlock a level whose sound clips are missing (spec §12).
      const missing = soundClipsForLevel(level.id, CONTENT).filter((clip) => !audio.has(clip));
      if (missing.length > 0 && !import.meta.env.DEV) {
        const names = missing
          .map((clip) => SOUND_MAP.get(clip.replace(/^snd_/u, ''))?.label ?? clip)
          .join(', ');
        setBlocked(
          `Level ${level.id} needs these sounds recorded first: ${names}. Record them in Sound Studio, then unlock the level.`,
        );
        return;
      }
    }
    const levels = on
      ? app.unlock.levels.filter((id) => id !== level.id)
      : [...app.unlock.levels, level.id].sort((a, b) => a - b);
    // Heart words set to become available at this level come with it.
    const arriving = on
      ? []
      : [...app.lexicon.heartWords.values()]
          .filter((h) => h.unlockLevel === level.id && h.optional !== true)
          .map((h) => h.id);
    setProposal({
      title: `${on ? 'Lock' : 'Unlock'} Level ${level.id}: ${level.title}`,
      unlock: {
        ...app.unlock,
        levels,
        heartWords: [...new Set([...app.unlock.heartWords, ...arriving])],
      },
    });
  };

  const togglePattern = (pattern: PatternDef) => {
    setBlocked(null);
    const { extraPatterns, lockedPatterns } = app.unlock;
    const isOn = unlocked.has(pattern.id);
    let next: UnlockState;
    if (isOn) {
      next = extraPatterns.includes(pattern.id)
        ? { ...app.unlock, extraPatterns: extraPatterns.filter((p) => p !== pattern.id) }
        : { ...app.unlock, lockedPatterns: [...lockedPatterns, pattern.id] };
    } else {
      next = lockedPatterns.includes(pattern.id)
        ? { ...app.unlock, lockedPatterns: lockedPatterns.filter((p) => p !== pattern.id) }
        : { ...app.unlock, extraPatterns: [...extraPatterns, pattern.id] };
    }
    setProposal({ title: `${isOn ? 'Lock' : 'Unlock'} pattern: ${pattern.label}`, unlock: next });
  };

  const chip = (pattern: PatternDef) => (
    <button
      key={pattern.id}
      type="button"
      className={`pattern-chip${unlocked.has(pattern.id) ? ' pattern-chip--on' : ''}`}
      aria-pressed={unlocked.has(pattern.id)}
      data-pattern={pattern.id}
      onClick={() => togglePattern(pattern)}
    >
      {pattern.label}
    </button>
  );

  return (
    <div className="panel" data-testid="levels-panel">
      <h1>Levels and patterns</h1>
      <p className="panel__lead">
        She only ever sees words made from unlocked patterns. Unlock a level when her class has
        taught it. Tap a single pattern to lock or unlock it on its own.
      </p>
      {blocked && (
        <p className="form-error" data-testid="level-blocked">
          {blocked}{' '}
          <button type="button" className="link-button" onClick={() => navigate('/parent/studio')}>
            Open Sound Studio
          </button>
        </p>
      )}
      {CONTENT.levels.map((level) => {
        const on = app.unlock.levels.includes(level.id);
        return (
          <section
            key={level.id}
            className={`level-row${on ? ' level-row--on' : ''}`}
            data-testid="level-row"
            data-level={level.id}
          >
            <div className="level-row__head">
              <h2>
                Level {level.id}: {level.title}
              </h2>
              <button
                type="button"
                className={`switch${on ? ' switch--on' : ''}`}
                role="switch"
                aria-checked={on}
                aria-label={`Level ${level.id}`}
                onClick={() => toggleLevel(level)}
              >
                <span />
              </button>
            </div>
            <div className="chip-row">
              {CONTENT.patterns.filter((p) => level.patterns.includes(p.id)).map(chip)}
            </div>
          </section>
        );
      })}
      <section className="level-row">
        <div className="level-row__head">
          <h2>Not in a level yet</h2>
        </div>
        <p className="panel__note">
          Letters and patterns outside the eight levels. Unlock one when it has been taught (for
          example k or w).
        </p>
        <div className="chip-row">{OTHER_PATTERNS.map(chip)}</div>
      </section>

      {proposal && preview && (
        <div
          className="dialog-backdrop"
          role="dialog"
          aria-modal="true"
          data-testid="unlock-preview"
        >
          <div className="dialog">
            <h2>{proposal.title}</h2>
            <p>This changes what she can be shown:</p>
            <ul className="dialog__list">
              <li>{signed(preview.words)} words</li>
              <li>{signed(preview.sentences)} sentences</li>
              <li>{signed(preview.stories)} stories</li>
            </ul>
            <div className="dialog__actions">
              <button type="button" className="button" onClick={() => setProposal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="button button--primary"
                data-testid="apply-unlock"
                onClick={() => {
                  void app.saveUnlock(proposal.unlock);
                  setProposal(null);
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
