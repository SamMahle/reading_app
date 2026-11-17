import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { audio } from '@/audio/AudioService';
import {
  allDotsTapped,
  canPlayWholeWord,
  canSlide,
  completedHelp,
  helpReducer,
  initialHelpState,
  SAY_THE_WORD_PAUSE_MS,
} from '@/engine/helpRoutine';
import type { AnyEntry, UnlockState } from '@/engine/types';
import { BlendSlider } from './BlendSlider';
import { CheckIcon, CrossIcon, SpeakerIcon } from './icons';
import { SoundDots } from './SoundDots';
import { Word } from './Word';

export interface SoundItOutProps {
  entry: AnyEntry;
  unlock: UnlockState;
  display?: string;
  /** After a miss the routine must be completed: there is no close button. */
  mandatory?: boolean;
  onClose: (result: { completedHelp: boolean }) => void;
}

const NUDGE_MS = 12_000;

/**
 * The sound-it-out routine, the only form of help in the app (spec §8.1):
 * tap each sound, slide to blend, say the word. Only then does the speaker
 * button for the whole word appear.
 */
export function SoundItOut({
  entry,
  unlock,
  display,
  mandatory = false,
  onClose,
}: SoundItOutProps) {
  const [state, dispatch] = useReducer(helpReducer, entry.graphemes.length, initialHelpState);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const dotsDone = allDotsTapped(state);
  const promptId = !dotsDone
    ? 'pr_tap_sounds'
    : !state.slideDone
      ? 'pr_slide_blend'
      : 'pr_say_word';
  const lastTouch = useRef(Date.now());

  // Speak the direction for each step, then start the "Say the word" pause.
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    void audio.playPrompt(promptId).then(() => {
      if (cancelled || promptId !== 'pr_say_word') return;
      timer = window.setTimeout(() => dispatch({ type: 'pause_elapsed' }), SAY_THE_WORD_PAUSE_MS);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [promptId]);

  // If she goes quiet, say the direction again. Nothing is timed or shown.
  useEffect(() => {
    if (state.slideDone) return undefined;
    const interval = window.setInterval(() => {
      if (Date.now() - lastTouch.current >= NUDGE_MS) {
        lastTouch.current = Date.now();
        void audio.playPrompt(promptId);
      }
    }, 2000);
    return () => window.clearInterval(interval);
  }, [promptId, state.slideDone]);

  const touch = () => {
    lastTouch.current = Date.now();
  };

  const onDotTap = useCallback((index: number) => dispatch({ type: 'dot', index }), []);
  const onSlideComplete = useCallback(() => dispatch({ type: 'slide_complete' }), []);
  const ready = canPlayWholeWord(state);

  return (
    <div
      className="help-overlay kid-screen"
      role="dialog"
      aria-modal="true"
      aria-label="Sound it out"
      data-testid="sound-it-out"
      data-word={entry.id}
      onPointerDown={touch}
    >
      <div className="screen__bar">
        {mandatory ? (
          <span />
        ) : (
          <button
            type="button"
            className="icon-button icon-button--ghost"
            aria-label="Close"
            data-testid="help-close"
            onClick={() => onClose({ completedHelp: completedHelp(state) })}
          >
            <CrossIcon />
          </button>
        )}
        <button
          type="button"
          className="icon-button"
          aria-label="Hear it again"
          onClick={() => void audio.playPrompt(promptId)}
        >
          <SpeakerIcon />
        </button>
      </div>

      <div className="screen__body">
        {state.slideDone ? (
          <Word
            entry={entry}
            unlock={unlock}
            {...(display === undefined ? {} : { display })}
            size="large"
            showDots
            tapped={state.tapped}
          />
        ) : (
          <SoundDots
            entry={entry}
            unlock={unlock}
            {...(display === undefined ? {} : { display })}
            tapped={state.tapped}
            onDotTap={onDotTap}
            activeIdx={activeIdx}
          />
        )}

        <div className="help-overlay__slider">
          {canSlide(state) && !state.slideDone && (
            <BlendSlider
              graphemes={entry.graphemes}
              onSpanChange={setActiveIdx}
              onComplete={onSlideComplete}
            />
          )}
        </div>

        <div className="help-overlay__actions">
          {ready && (
            <>
              <button
                type="button"
                className="icon-button icon-button--large slide-in"
                aria-label="Hear the word"
                data-testid="whole-word"
                onClick={() => void audio.playWord(entry)}
              >
                <SpeakerIcon />
              </button>
              <button
                type="button"
                className="icon-button icon-button--large icon-button--accent slide-in"
                aria-label="Done"
                data-testid="help-done"
                onClick={() => onClose({ completedHelp: true })}
              >
                <CheckIcon />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
