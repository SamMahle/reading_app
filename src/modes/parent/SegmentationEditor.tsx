import { CONTENT } from '@/content/index';
import { spellingOf } from '@/engine/layout';
import type { GraphemeTable } from '@/engine/segment';
import type { Grapheme } from '@/engine/types';

export interface Segmentation {
  graphemes: Grapheme[];
  irregularIdx: number[];
}

interface Props {
  word: string;
  value: Segmentation;
  onChange: (value: Segmentation) => void;
  /** Heart words let the parent tap the parts that are irregular. */
  heartMode: boolean;
  table: GraphemeTable;
}

const encode = (g: Pick<Grapheme, 'soundId' | 'patternId'>) => `${g.soundId}|${g.patternId}`;
const SOUND_LABEL = new Map(CONTENT.sounds.map((s) => [s.id, `${s.label} as in ${s.example}`]));
const PATTERN_LABEL = new Map(CONTENT.patterns.map((p) => [p.id, p.label]));
const CONTINUOUS = new Map(CONTENT.sounds.map((s) => [s.id, s.continuous]));

/** The best guess for a spelling: a taught reading if one exists, else irregular. */
function defaultGrapheme(spelling: string, table: GraphemeTable, fallbackSound: string): Grapheme {
  const option = table.optionsFor(spelling)[0];
  if (option) return { ...option };
  return {
    spelling,
    soundId: fallbackSound,
    patternId: 'irregular',
    continuous: CONTINUOUS.get(fallbackSound) ?? false,
  };
}

/**
 * Lets the parent confirm or correct a proposed segmentation: join or split
 * letters, choose each part's sound, and (for heart words) mark the irregular
 * parts. The lexicon stays the source of truth (spec §5).
 */
export function SegmentationEditor({ word, value, onChange, heartMode, table }: Props) {
  const { graphemes, irregularIdx } = value;
  const valid = spellingOf(graphemes).toLowerCase() === word.toLowerCase();

  const replace = (next: Grapheme[], irregular = irregularIdx) =>
    onChange({ graphemes: next, irregularIdx: irregular.filter((i) => i < next.length) });

  const join = (i: number) => {
    const a = graphemes[i];
    const b = graphemes[i + 1];
    if (!a || !b) return;
    const merged = defaultGrapheme(a.spelling + b.spelling, table, a.soundId);
    replace([...graphemes.slice(0, i), merged, ...graphemes.slice(i + 2)], []);
  };

  const split = (i: number) => {
    const g = graphemes[i];
    if (!g) return;
    const parts = [...g.spelling].map((letter) => defaultGrapheme(letter, table, g.soundId));
    replace([...graphemes.slice(0, i), ...parts, ...graphemes.slice(i + 1)], []);
  };

  const setSound = (i: number, encoded: string) => {
    const [soundId = '', patternId = 'irregular'] = encoded.split('|');
    replace(
      graphemes.map((g, j) =>
        j === i ? { ...g, soundId, patternId, continuous: CONTINUOUS.get(soundId) ?? false } : g,
      ),
    );
  };

  const toggleHeart = (i: number) =>
    onChange({
      graphemes,
      irregularIdx: irregularIdx.includes(i)
        ? irregularIdx.filter((x) => x !== i)
        : [...irregularIdx, i].sort(),
    });

  return (
    <div className="seg-editor" data-testid="seg-editor">
      <div className="seg-editor__row">
        {graphemes.map((g, i) => {
          const options = table.optionsFor(g.spelling);
          const known = options.some((o) => encode(o) === encode(g));
          return (
            <div key={`${i}-${g.spelling}`} className="seg-chip" data-testid="seg-chip">
              <span className="seg-chip__spelling">{g.spelling}</span>
              <select
                aria-label={`Sound for ${g.spelling}`}
                value={encode(g)}
                onChange={(event) => setSound(i, event.target.value)}
              >
                {options.map((o) => (
                  <option key={encode(o)} value={encode(o)}>
                    {SOUND_LABEL.get(o.soundId) ?? o.soundId} (
                    {PATTERN_LABEL.get(o.patternId) ?? o.patternId})
                  </option>
                ))}
                <optgroup label="Another sound (irregular)">
                  {!known && g.patternId !== 'irregular' && (
                    <option value={encode(g)}>{SOUND_LABEL.get(g.soundId) ?? g.soundId}</option>
                  )}
                  {CONTENT.sounds.map((s) => (
                    <option key={s.id} value={`${s.id}|irregular`}>
                      {SOUND_LABEL.get(s.id)}
                    </option>
                  ))}
                </optgroup>
              </select>
              <div className="seg-chip__actions">
                {heartMode && (
                  <button
                    type="button"
                    className={`mini-button${irregularIdx.includes(i) ? ' mini-button--heart' : ''}`}
                    aria-pressed={irregularIdx.includes(i)}
                    onClick={() => toggleHeart(i)}
                  >
                    ♥ irregular
                  </button>
                )}
                {g.spelling.length > 1 && !g.spelling.includes('_') && (
                  <button type="button" className="mini-button" onClick={() => split(i)}>
                    Split
                  </button>
                )}
                {i < graphemes.length - 1 && (
                  <button type="button" className="mini-button" onClick={() => join(i)}>
                    Join next
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!valid && (
        <p className="form-error">These parts do not spell “{word}”. Adjust them before saving.</p>
      )}
    </div>
  );
}
