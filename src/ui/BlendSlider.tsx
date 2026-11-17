import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { audio, type SustainHandle } from '@/audio/AudioService';
import type { Grapheme } from '@/engine/types';
import { ArrowIcon } from './icons';

const COMPLETE_AT = 0.97;

export interface BlendSliderProps {
  graphemes: readonly Grapheme[];
  disabled?: boolean;
  /** Called as the thumb enters each grapheme's span (null when it leaves the track). */
  onSpanChange?: (graphemeIdx: number | null) => void;
  onComplete: () => void;
}

/**
 * A track under the word with a draggable thumb (spec §7). As the thumb
 * enters each grapheme's span that sound plays: continuous sounds are held
 * while inside the span, stop sounds play once. Left to right only; letting
 * go before the end sends the thumb back to the start.
 */
export function BlendSlider({
  graphemes,
  disabled = false,
  onSpanChange,
  onComplete,
}: BlendSliderProps) {
  const track = useRef<HTMLDivElement>(null);
  const sustain = useRef<SustainHandle | null>(null);
  const span = useRef<number | null>(null);
  const dragging = useRef(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const enterSpan = useCallback(
    (idx: number | null) => {
      if (span.current === idx) return;
      span.current = idx;
      sustain.current?.stop();
      sustain.current = null;
      const grapheme = idx === null ? undefined : graphemes[idx];
      if (grapheme) sustain.current = audio.startSustain(grapheme);
      onSpanChange?.(idx);
    },
    [graphemes, onSpanChange],
  );

  useEffect(
    () => () => {
      sustain.current?.stop();
    },
    [],
  );

  const moveTo = useCallback(
    (fraction: number) => {
      setProgress((previous) => {
        const next = Math.max(previous, Math.min(1, fraction)); // never backwards
        const idx = Math.min(graphemes.length - 1, Math.floor(next * graphemes.length));
        enterSpan(idx);
        return next;
      });
    },
    [enterSpan, graphemes.length],
  );

  const finish = useCallback(() => {
    dragging.current = false;
    enterSpan(null);
    setProgress(1);
    setDone(true);
    onComplete();
  }, [enterSpan, onComplete]);

  const fractionAt = (clientX: number) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return (clientX - rect.left) / rect.width;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || done) return;
    // The drag must start at the thumb, on the left: a tap in the middle does nothing.
    if (fractionAt(event.clientX) > Math.max(progress, 1 / (graphemes.length * 2)) + 0.12) return;
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    moveTo(fractionAt(event.clientX));
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || done) return;
    const fraction = fractionAt(event.clientX);
    if (fraction >= COMPLETE_AT) finish();
    else moveTo(fraction);
  };

  const onPointerEnd = () => {
    if (!dragging.current || done) return;
    dragging.current = false;
    enterSpan(null);
    setProgress(0);
  };

  // Keyboard path: each Right Arrow moves one sound along.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || done || event.key !== 'ArrowRight') return;
    event.preventDefault();
    const current = span.current ?? -1;
    if (current + 1 >= graphemes.length) finish();
    else moveTo((current + 1.5) / graphemes.length);
  };

  return (
    <div
      ref={track}
      className={`blend-slider${disabled ? ' blend-slider--disabled' : ''}${done ? ' blend-slider--done' : ''}`}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Slide to blend the sounds"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      aria-disabled={disabled}
      data-testid="blend-slider"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
    >
      <div className="blend-slider__fill" style={{ width: `calc(${progress * 100}% + 42px)` }} />
      {graphemes.map((_, i) => (
        <span
          key={i}
          className="blend-slider__tick"
          style={{ left: `${((i + 0.5) / graphemes.length) * 100}%` }}
        />
      ))}
      <div className="blend-slider__thumb" style={{ left: `${progress * 100}%` }}>
        <ArrowIcon />
      </div>
    </div>
  );
}
