import type { WordMark } from './FocusReader';
import { CheckIcon, CrossIcon, RedoIcon } from './icons';

export interface ParentStripProps {
  side: 'left' | 'right';
  /** The word picked by long-press, if any. */
  selectedWord: string | null;
  /** True when ↻ and ✕ can apply without picking a word (one-word chunks). */
  singleWord: boolean;
  onMark: (mark: WordMark) => void;
}

/**
 * Coach-mode scoring bar (spec §9.3), at the screen edge nearest the parent.
 * It carries the correction script so every adult uses the same words.
 */
export function ParentStrip({ side, selectedWord, singleWord, onMark }: ParentStripProps) {
  const needsWord = !singleWord && selectedWord === null;
  return (
    <aside
      className={`parent-strip parent-strip--${side}`}
      aria-label="Parent scoring"
      data-testid="parent-strip"
    >
      <p className="parent-strip__target">
        {selectedWord
          ? `Scoring “${selectedWord}”`
          : singleWord
            ? 'Score this word'
            : 'Score this chunk'}
      </p>
      <div className="parent-strip__buttons">
        <button
          type="button"
          className="strip-button strip-button--ok"
          data-testid="mark-correct"
          onClick={() => onMark('correct')}
        >
          <CheckIcon />
          <span>Correct</span>
        </button>
        <button
          type="button"
          className="strip-button"
          data-testid="mark-self"
          disabled={needsWord}
          onClick={() => onMark('self_corrected')}
        >
          <RedoIcon />
          <span>Fixed it herself</span>
        </button>
        <button
          type="button"
          className="strip-button"
          data-testid="mark-help"
          disabled={needsWord}
          onClick={() => onMark('needed_help')}
        >
          <CrossIcon />
          <span>Needed help</span>
        </button>
      </div>
      {needsWord && <p className="parent-strip__hint">Hold a word to score it on its own.</p>}
      <div className="parent-strip__script">
        <p className="parent-strip__heading">If she is stuck, say:</p>
        <ol>
          <li>“Look at all the letters.”</li>
          <li>“Tap the sounds.”</li>
          <li>“Slide and blend.”</li>
          <li>Still stuck? Model it, then: “Your turn. Read it again.”</li>
        </ol>
        <p className="parent-strip__dont">
          <strong>Don’t say</strong> “What would make sense?” or “Look at the picture.”
        </p>
      </div>
    </aside>
  );
}
