import { useEffect, useRef } from 'react';
import { audio } from '@/audio/AudioService';
import { SpeakerIcon } from './icons';

export interface PromptAudioProps {
  promptId: string;
  /** Called when the automatic first play has finished (or could not play). */
  onFinished?: () => void;
  /** Extra audio that follows the prompt on every play (the target word or sound). */
  after?: () => Promise<unknown>;
}

/**
 * Spoken directions (spec §7): each screen auto-plays its direction once,
 * and a speaker icon replays it. There is no instructional text to read.
 */
export function PromptAudio({ promptId, onFinished, after }: PromptAudioProps) {
  const finished = useRef(onFinished);
  const followUp = useRef(after);
  finished.current = onFinished;
  followUp.current = after;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await audio.playPrompt(promptId);
      if (cancelled) return;
      await followUp.current?.();
      if (!cancelled) finished.current?.();
    })();
    return () => {
      cancelled = true;
    };
  }, [promptId]);

  const replay = () => {
    void (async () => {
      await audio.playPrompt(promptId);
      await followUp.current?.();
    })();
  };

  return (
    <button
      type="button"
      className="icon-button"
      aria-label="Hear it again"
      data-testid="prompt-replay"
      onClick={replay}
    >
      <SpeakerIcon />
    </button>
  );
}
