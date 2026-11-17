import { useMemo, useState } from 'react';
import { useApp } from '@/app/AppData';
import { wordClipId } from '@/content/audioManifest';
import { CONTENT } from '@/content/index';
import { isMinimalPair } from '@/engine/distractors';
import { spellingOf } from '@/engine/layout';
import { displayForm, wordLevel } from '@/engine/lexicon';
import { buildGraphemeTable, proposeSegmentation, requiresFor } from '@/engine/segment';
import type { AnyEntry, HeartWordEntry, WordEntry } from '@/engine/types';
import { Word } from '@/ui/Word';
import { SegmentationEditor, type Segmentation } from './SegmentationEditor';

export const GRAPHEME_TABLE = buildGraphemeTable(CONTENT.patterns, CONTENT.sounds);
const WORD_PATTERN = /^[a-z]{1,14}$/u;

const segmentationText = (entry: AnyEntry) => entry.graphemes.map((g) => g.spelling).join(' · ');

function PictureSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <label className="field">
      <span>Picture (optional)</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">No picture</option>
        {CONTENT.pictures.map((p) => (
          <option key={p.id} value={p.id}>
            {p.id}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Shared "type a word, confirm its sounds" form start. */
function useWordDraft() {
  const [text, setText] = useState('');
  const [segmentation, setSegmentation] = useState<Segmentation | null>(null);
  const word = text.trim().toLowerCase();
  const propose = (initial?: AnyEntry) => {
    if (initial) {
      setText(initial.text.toLowerCase());
      setSegmentation({
        graphemes: initial.graphemes,
        irregularIdx: initial.isHeartWord === true ? initial.irregularIdx : [],
      });
      return;
    }
    if (!WORD_PATTERN.test(word)) return;
    setSegmentation({
      graphemes: proposeSegmentation(word, GRAPHEME_TABLE).graphemes,
      irregularIdx: [],
    });
  };
  const reset = () => {
    setText('');
    setSegmentation(null);
  };
  const valid = segmentation !== null && spellingOf(segmentation.graphemes).toLowerCase() === word;
  return {
    text,
    setText,
    word,
    segmentation,
    setSegmentation,
    propose,
    reset,
    valid,
    wellFormed: WORD_PATTERN.test(word),
  };
}

// ---------------------------------------------------------------------------
// Heart words
// ---------------------------------------------------------------------------

/** Heart-word editor (spec §10.2). */
export function HeartWordsPanel() {
  const app = useApp();
  const draft = useWordDraft();
  const [unlockLevel, setUnlockLevel] = useState(1);
  const [pictureId, setPictureId] = useState('');
  const hearts = useMemo(() => [...app.lexicon.heartWords.values()], [app.lexicon]);
  const customIds = new Set(app.custom.map((e) => e.id));

  const toggle = (id: string) => {
    const on = app.unlock.heartWords.includes(id);
    void app.saveUnlock({
      ...app.unlock,
      heartWords: on
        ? app.unlock.heartWords.filter((h) => h !== id)
        : [...app.unlock.heartWords, id],
    });
  };

  const save = async () => {
    if (!draft.segmentation || !draft.valid) return;
    const entry: HeartWordEntry = {
      id: draft.word,
      text: draft.word,
      graphemes: draft.segmentation.graphemes,
      irregularIdx: draft.segmentation.irregularIdx,
      unlockLevel,
      audioWord: wordClipId(draft.word),
      ...(pictureId ? { pictureId } : {}),
      isHeartWord: true,
    };
    await app.saveCustom(entry);
    // Available straight away when its level is already unlocked.
    if (app.unlock.levels.includes(unlockLevel) && !app.unlock.heartWords.includes(entry.id)) {
      await app.saveUnlock({ ...app.unlock, heartWords: [...app.unlock.heartWords, entry.id] });
    }
    draft.reset();
    setPictureId('');
  };

  return (
    <div className="panel" data-testid="heart-panel">
      <h1>Heart words</h1>
      <p className="panel__lead">
        Heart words show a dot under every sound. A heart marks only the part she has to know by
        heart. Hearts drop away on their own as patterns unlock.
      </p>

      <section className="panel__section">
        <h2>Add a heart word</h2>
        <div className="form-row">
          <label className="field">
            <span>Word</span>
            <input
              value={draft.text}
              onChange={(event) => draft.setText(event.target.value)}
              placeholder="for example: and"
              autoCapitalize="none"
              autoCorrect="off"
              data-testid="heart-word-input"
            />
          </label>
          <button
            type="button"
            className="button"
            disabled={!draft.wellFormed}
            onClick={() => draft.propose()}
            data-testid="heart-propose"
          >
            Split into sounds
          </button>
        </div>
        {draft.segmentation && (
          <>
            <p className="panel__note">
              Check each part and its sound. Tap “♥ irregular” on any part that does not follow the
              rules.
            </p>
            <SegmentationEditor
              word={draft.word}
              value={draft.segmentation}
              onChange={draft.setSegmentation}
              heartMode
              table={GRAPHEME_TABLE}
            />
            <div className="form-row">
              <label className="field">
                <span>Becomes available at</span>
                <select
                  value={unlockLevel}
                  onChange={(event) => setUnlockLevel(Number(event.target.value))}
                >
                  {CONTENT.levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      Level {l.id}: {l.title}
                    </option>
                  ))}
                </select>
              </label>
              <PictureSelect value={pictureId} onChange={setPictureId} />
            </div>
            <p className="panel__note">
              Audio: record the clip <code>{wordClipId(draft.word)}</code> in Sound Studio after
              saving.
            </p>
            <div className="form-row">
              <button
                type="button"
                className="button button--primary"
                disabled={!draft.valid}
                onClick={() => void save()}
                data-testid="heart-save"
              >
                Save heart word
              </button>
              <button type="button" className="button" onClick={draft.reset}>
                Cancel
              </button>
            </div>
          </>
        )}
      </section>

      <section className="panel__section">
        <h2>All heart words</h2>
        <ul className="entry-list" data-testid="heart-list">
          {hearts.map((entry) => {
            const on = app.unlock.heartWords.includes(entry.id);
            return (
              <li key={entry.id} className="entry-row" data-entry={entry.id}>
                <span className="entry-row__word">
                  <Word
                    entry={entry}
                    unlock={app.unlock}
                    display={displayForm(entry)}
                    size="sentence"
                    showDots
                  />
                </span>
                <span className="entry-row__meta">
                  {segmentationText(entry)}
                  {entry.optional && <em> · interest word</em>}
                  {customIds.has(entry.id) && <em> · added by you</em>}
                </span>
                {customIds.has(entry.id) && (
                  <button
                    type="button"
                    className="button button--quiet"
                    onClick={() => void app.deleteCustom(entry.id)}
                  >
                    Remove
                  </button>
                )}
                <button
                  type="button"
                  className={`switch${on ? ' switch--on' : ''}`}
                  role="switch"
                  aria-checked={on}
                  aria-label={`${entry.text} available`}
                  onClick={() => toggle(entry.id)}
                >
                  <span />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lexicon
// ---------------------------------------------------------------------------

/** Lexicon editor (spec §10.2): add or edit regular words. */
export function LexiconPanel() {
  const app = useApp();
  const draft = useWordDraft();
  const [pictureId, setPictureId] = useState('');
  const [pairs, setPairs] = useState<string[]>([]);
  const [isName, setIsName] = useState(false);
  const [query, setQuery] = useState('');
  const customIds = new Set(app.custom.map((e) => e.id));

  const words = useMemo(() => {
    const all = [...app.lexicon.words.values()];
    const q = query.trim().toLowerCase();
    return (q ? all.filter((w) => w.id.includes(q)) : all).slice(0, 400);
  }, [app.lexicon, query]);

  const candidate: WordEntry | null = useMemo(() => {
    if (!draft.segmentation || !draft.valid) return null;
    const requires = requiresFor(draft.segmentation.graphemes, GRAPHEME_TABLE);
    return {
      id: draft.word,
      text: draft.word,
      graphemes: draft.segmentation.graphemes,
      audioWord: wordClipId(draft.word),
      ...(pictureId ? { pictureId } : {}),
      ...(requires.length ? { requires } : {}),
      ...(isName ? { tags: ['name'] } : {}),
    };
  }, [draft.segmentation, draft.valid, draft.word, pictureId, isName]);

  // Minimal pairs are suggested automatically; the parent confirms them.
  const suggestedPairs = useMemo(
    () =>
      candidate
        ? [...app.lexicon.words.values()]
            .filter((w) => w.id !== candidate.id && isMinimalPair(candidate, w))
            .map((w) => w.id)
        : [],
    [candidate, app.lexicon],
  );

  const edit = (entry: WordEntry) => {
    draft.propose(entry);
    setPictureId(entry.pictureId ?? '');
    setPairs(entry.minimalPairs ?? []);
    setIsName(entry.tags?.includes('name') ?? false);
    window.scrollTo({ top: 0 });
  };

  const reset = () => {
    draft.reset();
    setPictureId('');
    setPairs([]);
    setIsName(false);
  };

  const save = async () => {
    if (!candidate) return;
    const chosen = pairs.filter((id) => suggestedPairs.includes(id));
    await app.saveCustom({ ...candidate, ...(chosen.length ? { minimalPairs: chosen } : {}) });
    reset();
  };

  const level = candidate ? wordLevel(candidate, CONTENT.levels) : undefined;

  return (
    <div className="panel" data-testid="lexicon-panel">
      <h1>Word list</h1>
      <p className="panel__lead">
        Every word is split into sounds by hand, because the split decides when she is ready to read
        it.
      </p>

      <section className="panel__section">
        <h2>Add or edit a word</h2>
        <div className="form-row">
          <label className="field">
            <span>Word</span>
            <input
              value={draft.text}
              onChange={(event) => draft.setText(event.target.value)}
              placeholder="for example: jam"
              autoCapitalize="none"
              autoCorrect="off"
              data-testid="word-input"
            />
          </label>
          <button
            type="button"
            className="button"
            disabled={!draft.wellFormed}
            onClick={() => draft.propose()}
            data-testid="word-propose"
          >
            Split into sounds
          </button>
        </div>
        {draft.segmentation && (
          <>
            <SegmentationEditor
              word={draft.word}
              value={draft.segmentation}
              onChange={draft.setSegmentation}
              heartMode={false}
              table={GRAPHEME_TABLE}
            />
            {candidate && (
              <p className="panel__note" data-testid="word-level">
                {level === undefined
                  ? 'This word uses a pattern outside the eight levels. It stays locked until you unlock that pattern.'
                  : `Readable from Level ${level}.`}
                {candidate.requires?.length ? ' It has a consonant blend.' : ''}
              </p>
            )}
            <div className="form-row">
              <PictureSelect value={pictureId} onChange={setPictureId} />
              <label className="field field--check">
                <input
                  type="checkbox"
                  checked={isName}
                  onChange={(event) => setIsName(event.target.checked)}
                />
                <span>A name (shown with a capital letter)</span>
              </label>
            </div>
            {suggestedPairs.length > 0 && (
              <fieldset className="pair-picker">
                <legend>Look-alike words for “Pick the word” (differ by one sound)</legend>
                {suggestedPairs.map((id) => (
                  <label key={id}>
                    <input
                      type="checkbox"
                      checked={pairs.includes(id)}
                      onChange={(event) =>
                        setPairs(
                          event.target.checked ? [...pairs, id] : pairs.filter((p) => p !== id),
                        )
                      }
                    />
                    {id}
                  </label>
                ))}
              </fieldset>
            )}
            <div className="form-row">
              <button
                type="button"
                className="button button--primary"
                disabled={!candidate}
                onClick={() => void save()}
                data-testid="word-save"
              >
                Save word
              </button>
              <button type="button" className="button" onClick={reset}>
                Cancel
              </button>
            </div>
          </>
        )}
      </section>

      <section className="panel__section">
        <h2>All words ({app.lexicon.words.size})</h2>
        <label className="field">
          <span>Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </label>
        <table className="data-table" data-testid="word-table">
          <thead>
            <tr>
              <th>Word</th>
              <th>Sounds</th>
              <th>Level</th>
              <th>Picture</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {words.map((entry) => (
              <tr key={entry.id} data-entry={entry.id}>
                <td className="data-table__word">{displayForm(entry)}</td>
                <td>{segmentationText(entry)}</td>
                <td>{wordLevel(entry, CONTENT.levels) ?? '–'}</td>
                <td>{entry.pictureId ?? ''}</td>
                <td className="data-table__actions">
                  <button
                    type="button"
                    className="button button--quiet"
                    onClick={() => edit(entry)}
                  >
                    Edit
                  </button>
                  {customIds.has(entry.id) && (
                    <button
                      type="button"
                      className="button button--quiet"
                      onClick={() => void app.deleteCustom(entry.id)}
                    >
                      {CONTENT.words.some((w) => w.id === entry.id) ? 'Undo changes' : 'Remove'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
