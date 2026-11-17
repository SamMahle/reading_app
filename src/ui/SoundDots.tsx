import { useCallback, useRef, useState } from 'react';
import { audio } from '@/audio/AudioService';
import type { AnyEntry, UnlockState } from '@/engine/types';
import { Word } from './Word';

const HIGHLIGHT_MS = 450;

export interface SoundDotsProps {
  entry: AnyEntry;
  unlock: UnlockState;
  display?: string;
  /** Which dots have been tapped so far (owned by the caller). */
  tapped: readonly boolean[];
  onDotTap: (graphemeIdx: number) => void;
  /** Grapheme highlighted from outside (the blend slider, or modeling). */
  activeIdx?: number | null;
  disabled?: boolean;
}

/**
 * One dot per grapheme under the word (spec §7). Tapping a dot plays that
 * grapheme's sound and briefly highlights its letters.
 */
export function SoundDots({
  entry,
  unlock,
  display,
  tapped,
  onDotTap,
  activeIdx = null,
  disabled = false,
}: SoundDotsProps) {
  const [flash, setFlash] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const handleTap = useCallback(
    (idx: number) => {
      if (disabled) return;
      const grapheme = entry.graphemes[idx];
      if (!grapheme) return;
      void audio.playSound(grapheme);
      setFlash(idx);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setFlash(null), HIGHLIGHT_MS);
      onDotTap(idx);
    },
    [disabled, entry, onDotTap],
  );

  return (
    <Word
      entry={entry}
      unlock={unlock}
      {...(display === undefined ? {} : { display })}
      size="large"
      spaced
      showDots
      tapped={tapped}
      activeIdx={activeIdx ?? flash}
      onDotTap={handleTap}
    />
  );
}
