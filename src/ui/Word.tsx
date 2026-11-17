import { CONTENT } from '@/content/index';
import { heartIdx } from '@/engine/heart';
import { layoutWord, type LetterCell } from '@/engine/layout';
import { displayForm } from '@/engine/lexicon';
import type { AnyEntry, UnlockState } from '@/engine/types';
import { HeartIcon } from './icons';

export interface WordProps {
  entry: AnyEntry;
  unlock: UnlockState;
  /** Display capitalisation ("The"). Defaults to the entry's own form. */
  display?: string;
  /** Show a sound dot under every grapheme. */
  showDots?: boolean;
  /** Which dots have been tapped (they turn the accent colour). */
  tapped?: readonly boolean[];
  /** Grapheme whose letters are highlighted right now. */
  activeIdx?: number | null;
  /** Makes each grapheme a button (used by SoundDots). */
  onDotTap?: (graphemeIdx: number) => void;
  /** Makes the whole word a button. */
  onTap?: () => void;
  size?: 'sentence' | 'word' | 'large';
  /** Spread the letters into sound boxes (used while sounding out). */
  spaced?: boolean;
}

/** Groups cells so a split digraph (i_e) can draw one arc over its span. */
function groupCells(cells: readonly LetterCell[]): LetterCell[][] {
  const groups: LetterCell[][] = [];
  let open: LetterCell[] | undefined;
  for (const cell of cells) {
    if (open) {
      open.push(cell);
      if (cell.silent) open = undefined;
    } else if (cell.split) {
      open = [cell];
      groups.push(open);
    } else {
      groups.push([cell]);
    }
  }
  return groups;
}

/**
 * Renders one word with optional sound dots and heart marks (spec §7).
 * Hearts sit above the irregular graphemes; a split digraph shows one dot
 * under its vowel, linked to the silent e by a small arc.
 */
export function Word({
  entry,
  unlock,
  display,
  showDots = false,
  tapped,
  activeIdx = null,
  onDotTap,
  onTap,
  size = 'word',
  spaced = false,
}: WordProps) {
  const text = display ?? displayForm(entry);
  const cells = layoutWord(text, entry.graphemes);
  const hearts = new Set(heartIdx(entry, unlock, CONTENT.levels));
  const className = `word word--${size}${spaced ? ' word--spaced' : ''}${hearts.size > 0 ? ' word--heart' : ''}`;

  if (!cells) {
    // The segmentation does not spell the word: show plain text, never a wrong dot.
    return <span className={className}>{text}</span>;
  }

  const renderCell = (cell: LetterCell, key: number) => {
    const idx = cell.graphemeIdx;
    const isActive = activeIdx === idx;
    const body = (
      <>
        {hearts.has(idx) && (
          <span className="word__heart" aria-hidden="true">
            <HeartIcon />
          </span>
        )}
        <span className={`word__letters${isActive ? ' word__letters--active' : ''}`}>
          {cell.text}
        </span>
        {showDots && (
          <span
            className={`word__dot${cell.silent ? ' word__dot--none' : ''}${tapped?.[idx] ? ' word__dot--tapped' : ''}`}
            aria-hidden="true"
          />
        )}
      </>
    );
    if (onDotTap) {
      return (
        <button
          key={key}
          type="button"
          className="word__cell word__cell--button"
          data-grapheme={idx}
          data-tapped={tapped?.[idx] ? 'true' : 'false'}
          aria-label={`Sound ${idx + 1}`}
          onClick={() => onDotTap(idx)}
        >
          {body}
        </button>
      );
    }
    return (
      <span key={key} className="word__cell" data-grapheme={idx}>
        {body}
      </span>
    );
  };

  let key = 0;
  const content = groupCells(cells).map((group) => {
    if (group.length === 1 && group[0]) return renderCell(group[0], (key += 1));
    const groupKey = (key += 1);
    return (
      <span key={groupKey} className="word__split">
        {group.map((cell) => renderCell(cell, (key += 1)))}
        {showDots && <span className="word__arc" aria-hidden="true" />}
      </span>
    );
  });

  if (onTap) {
    return (
      <button
        type="button"
        className={`${className} word--button`}
        onClick={onTap}
        data-word={entry.id}
      >
        {content}
      </button>
    );
  }
  return (
    <span className={className} data-word={entry.id}>
      {content}
    </span>
  );
}
