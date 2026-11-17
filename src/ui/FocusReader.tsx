import { Fragment, useMemo, useRef, type PointerEvent } from 'react';
import { chunkPage, type ReaderWord } from '@/engine/ladder';
import { findEntry } from '@/engine/lexicon';
import { partitionReadable } from '@/engine/readability';
import type { AnyEntry, Lexicon, Rung, Sentence, UnlockState } from '@/engine/types';
import { ArrowIcon } from './icons';
import { Word } from './Word';

export type WordMark = 'correct' | 'self_corrected' | 'needed_help';

export interface FocusReaderProps {
  /** The sentences of the current page. */
  sentences: readonly Sentence[];
  rung: Rung;
  /** The chunk being read (owned by the caller). */
  chunkIdx: number;
  unlock: UnlockState;
  lexicon: Lexicon;
  /** Class Passage only: words pre-taught in this session (spec §9.5). */
  preTaught?: ReadonlySet<string>;
  marks?: ReadonlyMap<number, WordMark>;
  selectedIdx?: number | null;
  onWordTap?: (entry: AnyEntry, display: string, wordIdx: number) => void;
  onWordLongPress?: (wordIdx: number) => void;
  /** Tap on the arrow, or a swipe. There is no auto-advance. */
  onAdvance: () => void;
}

const LONG_PRESS_MS = 550;
const SWIPE_PX = 60;

/** The page as the reader sees it: only sentences that pass the checker. */
export function usePageLayout(
  sentences: readonly Sentence[],
  rung: Rung,
  unlock: UnlockState,
  lexicon: Lexicon,
  preTaught?: ReadonlySet<string>,
) {
  return useMemo(() => {
    const { shown, refused } = partitionReadable(sentences, unlock, lexicon, preTaught);
    if (import.meta.env.DEV) {
      for (const { sentence, offenders } of refused) {
        console.warn(`Refused to show unreadable text: "${sentence.text}"`, offenders);
      }
    }
    return chunkPage(shown, rung);
  }, [sentences, rung, unlock, lexicon, preTaught]);
}

/**
 * Shows text one chunk at a time (spec §9.1). The current chunk is at full
 * contrast, past chunks dim to 35% and future chunks are hidden. Any word
 * can be tapped to sound it out.
 */
export function FocusReader({
  sentences,
  rung,
  chunkIdx,
  unlock,
  lexicon,
  preTaught,
  marks,
  selectedIdx = null,
  onWordTap,
  onWordLongPress,
  onAdvance,
}: FocusReaderProps) {
  const layout = usePageLayout(sentences, rung, unlock, lexicon, preTaught);
  const chunk = layout.chunks[Math.min(chunkIdx, layout.chunks.length - 1)];
  const press = useRef<{ timer: number; fired: boolean } | null>(null);
  const swipeStart = useRef<number | null>(null);

  const stateOf = (wordIdx: number) => {
    if (!chunk || wordIdx >= chunk.end) return 'future';
    return wordIdx < chunk.start ? 'past' : 'current';
  };

  const startPress = (wordIdx: number) => {
    if (!onWordLongPress) return;
    const timer = window.setTimeout(() => {
      if (press.current) press.current.fired = true;
      onWordLongPress(wordIdx);
    }, LONG_PRESS_MS);
    press.current = { timer, fired: false };
  };
  const endPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
  };

  const onPointerDown = (event: PointerEvent) => {
    swipeStart.current = event.clientX;
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (start !== null && start - event.clientX > SWIPE_PX) onAdvance();
  };

  const renderWord = (word: ReaderWord, wordIdx: number) => {
    const entry = findEntry(word.token.key, lexicon);
    const state = stateOf(wordIdx);
    const mark = marks?.get(wordIdx);
    const className = `reader__word reader__word--${state}${mark ? ` reader__word--${mark}` : ''}${selectedIdx === wordIdx ? ' reader__word--selected' : ''}`;
    if (!entry) return null;
    return (
      <Fragment key={wordIdx}>
        <button
          type="button"
          className={className}
          disabled={state !== 'current'}
          data-testid="reader-word"
          data-key={word.token.key}
          data-state={state}
          onPointerDown={() => startPress(wordIdx)}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onPointerCancel={endPress}
          onContextMenu={(event) => event.preventDefault()}
          onClick={() => {
            const longPressed = press.current?.fired ?? false;
            press.current = null;
            if (!longPressed) onWordTap?.(entry, word.token.word, wordIdx);
          }}
        >
          {word.token.lead}
          <Word entry={entry} unlock={unlock} display={word.token.word} size="sentence" />
          {word.token.trail}
        </button>{' '}
      </Fragment>
    );
  };

  return (
    <div className="reader" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      <p className="reader__text" data-testid="reader-text" data-rung={rung}>
        {layout.words.map(renderWord)}
      </p>
      <button
        type="button"
        className="icon-button icon-button--large icon-button--accent reader__next"
        aria-label="Next"
        data-testid="reader-next"
        onClick={onAdvance}
      >
        <ArrowIcon />
      </button>
    </div>
  );
}
