import { useCallback, useEffect, useRef, useState } from 'react';
import { audio } from '@/audio/AudioService';
import {
  createGuard,
  GUARD,
  promptFinished,
  registerTap,
  type GuardState,
  type TapVerdict,
} from '@/engine/guard';
import type { Outcome } from '@/engine/types';

/**
 * The shared answer flow for every Solo activity (spec §8.3, §8.4):
 *
 *   answer → correct                         → success
 *   answer → first miss  → help (routine)    → answer again
 *   answer → second miss → model → confirm (she taps it herself) → success
 *
 * She never ends on a miss.
 */
export type Stage = 'answer' | 'paused' | 'help' | 'model' | 'confirm' | 'success';

export interface ItemResult {
  outcome: Outcome;
  usedHelp: boolean;
  completedHelp: boolean;
}

const SUCCESS_HOLD_MS = 1100;

export interface ItemFlow {
  stage: Stage;
  /** Increments every time the question is posed again (reshuffle, replay). */
  round: number;
  /** True when the open help was chosen by her, not triggered by a miss. */
  voluntaryHelp: boolean;
  /** Tell the guard the spoken prompt has finished. */
  promptEnded(): void;
  /** A tap on a choice. Returns what the guard made of it. */
  tap(isCorrect: boolean): TapVerdict;
  /** A tap that is not an answer but still counts for the tap-rate rule. */
  touch(): void;
  /** Run a non-answer tap (a "next" arrow) through the guard. */
  gate(): TapVerdict;
  /** A new spoken prompt has started: block taps until it finishes. */
  promptStarted(): void;
  /** An answer that bypasses the guard (a completed tile board). */
  submit(isCorrect: boolean): void;
  /** Rapid tapping was detected outside the choice grid. */
  pause(): void;
  /** She asked for help herself (tapped a word). */
  openHelp(): void;
  helpClosed(result: { completedHelp: boolean }): void;
  modelDone(): void;
}

export function useItemFlow(
  onDone: (result: ItemResult) => void,
  options: { firstMiss: 'routine' | 'replay' } = { firstMiss: 'routine' },
): ItemFlow {
  const [stage, setStage] = useState<Stage>('answer');
  const [round, setRound] = useState(0);
  const [voluntaryHelp, setVoluntaryHelp] = useState(false);
  const guard = useRef<GuardState>(createGuard());
  const record = useRef({ misses: 0, usedHelp: false, completedHelp: false, finished: false });
  const done = useRef(onDone);
  done.current = onDone;
  const timers = useRef<number[]>([]);
  // Every touch anywhere on screen counts for the tap-rate rule, so mashing
  // the whole screen can never slip an accepted answer through.
  const touches = useRef({ previous: Number.NEGATIVE_INFINITY, last: Number.NEGATIVE_INFINITY });

  useEffect(() => {
    const onPointerDown = () => {
      touches.current = { previous: touches.current.last, last: Date.now() };
    };
    const pending = timers.current;
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      for (const timer of pending) window.clearTimeout(timer);
    };
  }, []);

  /** Run one tap through the guard, counting the touch that came before it. */
  const guarded = (isCorrect: boolean) => {
    const state = {
      ...guard.current,
      lastTapTs: Math.max(guard.current.lastTapTs, touches.current.previous),
    };
    const result = registerTap(state, Date.now(), isCorrect);
    guard.current = result.state;
    return result.verdict;
  };

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const ask = useCallback(() => {
    guard.current = { ...createGuard(), lastTapTs: guard.current.lastTapTs };
    setRound((value) => value + 1);
    setStage('answer');
  }, []);

  const finish = useCallback((outcome: Outcome) => {
    if (record.current.finished) return;
    record.current.finished = true;
    setStage('success');
    audio.chime();
    const { usedHelp, completedHelp } = record.current;
    later(() => done.current({ outcome, usedHelp, completedHelp }), SUCCESS_HOLD_MS);
  }, []);

  const miss = useCallback(() => {
    record.current.misses += 1;
    if (record.current.misses >= 2) {
      setStage('model');
      return;
    }
    if (options.firstMiss === 'replay') {
      ask();
      return;
    }
    record.current.usedHelp = true;
    setVoluntaryHelp(false);
    setStage('help');
  }, [ask, options.firstMiss]);

  const pause = useCallback(() => {
    setStage('paused');
    void audio.playPrompt('pr_look_closely');
    later(miss, GUARD.pauseMs);
  }, [miss]);

  const answer = useCallback(
    (isCorrect: boolean, currentStage: Stage) => {
      if (currentStage === 'confirm') {
        if (isCorrect) finish('modeled');
        return;
      }
      if (currentStage !== 'answer') return;
      if (!isCorrect) {
        miss();
        return;
      }
      const { misses, usedHelp } = record.current;
      finish(misses > 0 || usedHelp ? 'helped' : 'correct');
    },
    [finish, miss],
  );

  return {
    stage,
    round,
    voluntaryHelp,
    promptEnded: useCallback(() => {
      guard.current = promptFinished(guard.current, Date.now());
    }, []),
    tap: (isCorrect) => {
      if (stage !== 'answer' && stage !== 'confirm') return 'ignore';
      const verdict = guarded(isCorrect);
      if (verdict === 'pause') pause();
      else if (verdict === 'accept') answer(isCorrect, stage);
      return verdict;
    },
    touch: () => {
      guard.current = { ...guard.current, lastTapTs: Date.now() };
    },
    gate: () => {
      if (stage !== 'answer') return 'ignore';
      return guarded(true);
    },
    promptStarted: () => {
      guard.current = { ...guard.current, promptEndTs: Number.POSITIVE_INFINITY };
    },
    submit: (isCorrect) => answer(isCorrect, stage),
    pause,
    openHelp: () => {
      if (stage !== 'answer') return;
      record.current.usedHelp = true;
      setVoluntaryHelp(true);
      setStage('help');
    },
    helpClosed: (result) => {
      record.current.completedHelp ||= result.completedHelp;
      ask();
    },
    modelDone: () => {
      guard.current = { ...createGuard(), lastTapTs: guard.current.lastTapTs };
      setRound((value) => value + 1);
      setStage('confirm');
    },
  };
}
