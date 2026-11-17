import { useMemo, useState } from 'react';
import { useApp } from '@/app/AppData';
import { wordClipId } from '@/content/audioManifest';
import { spellingOf } from '@/engine/layout';
import { analyzePassage, buildPassageStory, withOneTimeHeartWords } from '@/engine/passage';
import { proposeSegmentation, requiresFor } from '@/engine/segment';
import type { HeartWordEntry, WordEntry } from '@/engine/types';
import { SegmentationEditor, type Segmentation } from './SegmentationEditor';
import { GRAPHEME_TABLE } from './WordPanels';

interface Resolving {
  word: string;
  mode: 'word' | 'heart';
  segmentation: Segmentation;
}

const CLASS_LABEL = {
  decodable: 'can sound out',
  heart: 'heart word',
  not_yet: 'not taught yet',
  unknown: 'new to the app',
} as const;

/** Class Passage (spec §9.5): paste the week's passage and prepare it for reading. */
export function PassagePanel() {
  const app = useApp();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [checked, setChecked] = useState(false);
  const [oneTime, setOneTime] = useState<HeartWordEntry[]>([]);
  const [resolving, setResolving] = useState<Resolving | null>(null);

  const lexicon = useMemo(
    () => withOneTimeHeartWords(app.lexicon, oneTime),
    [app.lexicon, oneTime],
  );
  const analysis = useMemo(
    () => (checked ? analyzePassage(text, app.unlock, lexicon) : null),
    [checked, text, app.unlock, lexicon],
  );
  const passages = app.storyRecords.filter((r) => r.type === 'class_passage');

  const startResolve = (word: string, mode: Resolving['mode']) =>
    setResolving({
      word,
      mode,
      segmentation: {
        graphemes: proposeSegmentation(word, GRAPHEME_TABLE).graphemes,
        irregularIdx: [],
      },
    });

  const confirmResolve = async () => {
    if (!resolving) return;
    const { word, mode, segmentation } = resolving;
    if (mode === 'word') {
      const requires = requiresFor(segmentation.graphemes, GRAPHEME_TABLE);
      const entry: WordEntry = {
        id: word,
        text: word,
        graphemes: segmentation.graphemes,
        audioWord: wordClipId(word),
        ...(requires.length ? { requires } : {}),
      };
      await app.saveCustom(entry);
    } else {
      setOneTime((previous) => [
        ...previous.filter((e) => e.id !== word),
        {
          id: word,
          text: word,
          graphemes: segmentation.graphemes,
          irregularIdx: segmentation.irregularIdx,
          unlockLevel: 1,
          audioWord: wordClipId(word),
          isHeartWord: true,
        },
      ]);
    }
    setResolving(null);
  };

  const save = async () => {
    if (!analysis || analysis.unknown.length > 0 || analysis.tokens.length === 0) return;
    const id = `cp_${Date.now().toString(36)}`;
    const used = new Set(analysis.tokens.map((t) => t.token.key));
    await app.putStoryRecord({
      id,
      type: 'class_passage',
      reads: [],
      passage: {
        story: buildPassageStory(id, title.trim() || 'Class passage', text, lexicon),
        oneTimeHeartWords: oneTime.filter((e) => used.has(e.id)),
      },
    });
    setTitle('');
    setText('');
    setChecked(false);
    setOneTime([]);
  };

  const resolvingValid = resolving
    ? spellingOf(resolving.segmentation.graphemes).toLowerCase() === resolving.word
    : false;
  const preTeach = analysis ? [...new Set([...analysis.notYet])] : [];

  return (
    <div className="panel" data-testid="passage-panel">
      <h1>Class passage</h1>
      <p className="panel__lead">
        Paste this week’s class passage. The app checks every word, pre-teaches the ones she has not
        been taught, and then she reads it in Coach mode at her current step.
      </p>

      <section className="panel__section">
        <label className="field">
          <span>Title (for you; she does not see it)</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            data-testid="passage-title"
          />
        </label>
        <label className="field">
          <span>Passage</span>
          <textarea
            rows={5}
            value={text}
            data-testid="passage-text"
            onChange={(event) => {
              setText(event.target.value);
              setChecked(false);
            }}
          />
        </label>
        <button
          type="button"
          className="button button--primary"
          disabled={text.trim() === ''}
          onClick={() => setChecked(true)}
          data-testid="passage-check"
        >
          Check the words
        </button>
      </section>

      {analysis && (
        <section className="panel__section" data-testid="passage-analysis">
          <h2>Word check</h2>
          <p className="passage-preview">
            {analysis.tokens.map((t, i) => (
              <span
                key={i}
                className={`token token--${t.cls}`}
                data-cls={t.cls}
                title={CLASS_LABEL[t.cls]}
              >
                {t.token.raw}{' '}
              </span>
            ))}
          </p>
          <div className="chart-legend">
            {(['decodable', 'heart', 'not_yet', 'unknown'] as const).map((cls) => (
              <span key={cls}>
                <i className={`token-swatch token--${cls}`} />
                {CLASS_LABEL[cls]}:{' '}
                {new Set(analysis.tokens.filter((t) => t.cls === cls).map((t) => t.token.key)).size}
              </span>
            ))}
          </div>

          {analysis.unknown.length > 0 && (
            <>
              <h3>Words new to the app</h3>
              <p className="panel__note">
                Add each one to the word list, or mark it as a one-time heart word for this passage
                only.
              </p>
              <ul className="entry-list" data-testid="unknown-list">
                {analysis.unknown.map((word) => (
                  <li key={word} className="entry-row" data-word={word}>
                    <span className="entry-row__word entry-row__word--plain">{word}</span>
                    <button
                      type="button"
                      className="button"
                      onClick={() => startResolve(word, 'word')}
                      data-testid="add-to-lexicon"
                    >
                      Add to word list
                    </button>
                    <button
                      type="button"
                      className="button"
                      onClick={() => startResolve(word, 'heart')}
                      data-testid="one-time-heart"
                    >
                      One-time heart word
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {resolving && (
            <div className="resolve-box" data-testid="resolve-box">
              <h3>
                {resolving.mode === 'word' ? 'Add to word list' : 'One-time heart word'}: “
                {resolving.word}”
              </h3>
              <SegmentationEditor
                word={resolving.word}
                value={resolving.segmentation}
                onChange={(segmentation) => setResolving({ ...resolving, segmentation })}
                heartMode={resolving.mode === 'heart'}
                table={GRAPHEME_TABLE}
              />
              <div className="form-row">
                <button
                  type="button"
                  className="button button--primary"
                  disabled={!resolvingValid}
                  onClick={() => void confirmResolve()}
                  data-testid="resolve-confirm"
                >
                  Confirm
                </button>
                <button type="button" className="button" onClick={() => setResolving(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {preTeach.length > 0 && (
            <p className="panel__note" data-testid="preteach-note">
              Before reading, she will practise these with tap-and-blend:{' '}
              <strong>{preTeach.join(', ')}</strong>.
            </p>
          )}
          <button
            type="button"
            className="button button--primary"
            disabled={analysis.unknown.length > 0 || analysis.tokens.length === 0}
            onClick={() => void save()}
            data-testid="passage-save"
          >
            Save passage
          </button>
        </section>
      )}

      <section className="panel__section">
        <h2>Saved passages</h2>
        {passages.length === 0 ? (
          <p className="panel__note">
            None yet. Saved passages appear in Coach mode under “Class passages”.
          </p>
        ) : (
          <ul className="entry-list" data-testid="passage-list">
            {passages.map((record) => (
              <li key={record.id} className="entry-row">
                <span className="entry-row__word entry-row__word--plain">
                  {record.passage?.story.title}
                </span>
                <span className="entry-row__meta">
                  {record.passage?.story.pages.flat().length} sentences · read {record.reads.length}{' '}
                  of 3 times
                </span>
                <button
                  type="button"
                  className="button button--quiet"
                  onClick={() => void app.deleteStoryRecord(record.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
