import { useEffect, useRef, useState } from 'react';
import { audio } from '@/audio/AudioService';
import type { AnyEntry, UnlockState } from '@/engine/types';
import { Word } from './Word';

const SOUND_MIN_MS = 650;
const BLEND_STEP_MS = 420;
const WORD_MIN_MS = 900;

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export interface ModelWordProps {
  entry: AnyEntry;
  unlock: UnlockState;
  display?: string;
  onDone: () => void;
}

/**
 * The app models a word after a second miss (spec §8.3): each sound, then
 * the blend, then the whole word. She then gives the answer herself.
 */
export function ModelWord({ entry, unlock, display, onDone }: ModelWordProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [tapped, setTapped] = useState<boolean[]>(() => entry.graphemes.map(() => false));
  const [blend, setBlend] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await audio.playPrompt('pr_watch_listen');
      for (let i = 0; i < entry.graphemes.length && !cancelled; i += 1) {
        const grapheme = entry.graphemes[i];
        if (!grapheme) continue;
        setActiveIdx(i);
        setTapped((previous) => previous.map((value, j) => value || j === i));
        await Promise.all([audio.playSound(grapheme), wait(SOUND_MIN_MS)]);
      }
      if (cancelled) return;
      setActiveIdx(null);
      await wait(250);
      const blendMs = entry.graphemes.length * BLEND_STEP_MS;
      const started = performance.now();
      const animate = () => {
        if (cancelled) return;
        const fraction = Math.min(1, (performance.now() - started) / blendMs);
        setBlend(fraction);
        setActiveIdx(
          fraction < 1
            ? Math.min(entry.graphemes.length - 1, Math.floor(fraction * entry.graphemes.length))
            : null,
        );
        if (fraction < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
      await Promise.all([audio.playBlend(entry.graphemes), wait(blendMs)]);
      if (cancelled) return;
      await Promise.all([audio.playWord(entry), wait(WORD_MIN_MS)]);
      if (!cancelled) done.current();
    })();
    return () => {
      cancelled = true;
    };
  }, [entry]);

  return (
    <div
      className="help-overlay kid-screen"
      role="dialog"
      aria-modal="true"
      aria-label="Watch and listen"
      data-testid="model-word"
      data-word={entry.id}
    >
      <div className="screen__bar" />
      <div className="screen__body">
        <Word
          entry={entry}
          unlock={unlock}
          {...(display === undefined ? {} : { display })}
          size="large"
          spaced
          showDots
          tapped={tapped}
          activeIdx={activeIdx}
        />
        <div className="help-overlay__slider">
          <div className="blend-slider blend-slider--model" aria-hidden="true">
            <div className="blend-slider__fill" style={{ width: `calc(${blend * 100}% + 42px)` }} />
          </div>
        </div>
        <div className="help-overlay__actions" />
      </div>
    </div>
  );
}
