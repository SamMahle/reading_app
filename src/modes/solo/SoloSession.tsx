import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useApp } from '@/app/AppData';
import { navigate } from '@/app/router';
import { audio } from '@/audio/AudioService';
import { soundClipId } from '@/content/audioManifest';
import { CONTENT, PICTURES } from '@/content/index';
import { soloSessionsToday, summarizeSession } from '@/engine/metrics';
import { isReadable } from '@/engine/readability';
import { createRng } from '@/engine/rng';
import { applyOutcome, newCard } from '@/engine/scheduler';
import {
  buildSession,
  isItemReadable,
  requeue,
  type SessionItem,
  type SessionPlan,
} from '@/engine/sessionBuilder';
import type { Attempt, LeitnerCard } from '@/engine/types';
import { HoldButton } from '@/ui/HoldButton';
import { CheckIcon, HomeIcon, MoonIcon } from '@/ui/icons';
import { Picture } from '@/ui/Picture';
import { PromptAudio } from '@/ui/PromptAudio';
import { BuildActivity, MatchActivity, PickActivity, WarmupActivity } from './activities';
import type { ItemResult } from './useItemFlow';
import './solo.css';

const EXIT_HOLD_MS = 2000;

interface RunState {
  queue: SessionItem[];
  index: number;
  /** The mastered closing item is on screen. */
  closing: boolean;
  finished: boolean;
  attempts: Attempt[];
  cards: Map<string, LeitnerCard>;
  sentenceIds: string[];
}

type RunAction =
  | { type: 'done'; result: ItemResult; now: number; timeUp: boolean }
  | { type: 'skip'; timeUp: boolean };

function itemId(item: SessionItem): string {
  if (item.kind === 'warmup') return item.target.spelling;
  return item.kind === 'match' ? item.sentenceId : item.wordId;
}

function advance(state: RunState, queue: SessionItem[], timeUp: boolean): RunState {
  if (state.closing) return { ...state, queue, finished: true };
  const next = state.index + 1;
  // When time is up (or the queue is done) the mastered item closes the session.
  if (timeUp || next >= queue.length) return { ...state, queue, closing: true };
  return { ...state, queue, index: next };
}

function makeReducer(
  plan: SessionPlan,
  sessionId: string,
  baseCards: ReadonlyMap<string, LeitnerCard>,
) {
  return (state: RunState, action: RunAction): RunState => {
    if (state.finished) return state;
    if (action.type === 'skip') return advance(state, state.queue, action.timeUp);
    const item = state.closing ? plan.closer : state.queue[state.index];
    if (!item) return { ...state, finished: true };
    const { result, now } = action;
    const attempt: Attempt = {
      id: crypto.randomUUID(),
      ts: now,
      mode: 'solo',
      activity: item.kind,
      itemId: itemId(item),
      outcome: result.outcome,
      usedHelp: result.usedHelp,
      completedHelp: result.completedHelp,
      sessionId,
    };
    const cards = new Map(state.cards);
    if (item.kind === 'build' || item.kind === 'pick') {
      const card =
        cards.get(item.wordId) ?? baseCards.get(item.wordId) ?? newCard(item.wordId, now);
      cards.set(item.wordId, applyOutcome(card, result.outcome, now));
    }
    const sentenceIds =
      item.kind === 'match' && !state.sentenceIds.includes(item.sentenceId)
        ? [...state.sentenceIds, item.sentenceId]
        : state.sentenceIds;
    // A modeled item comes back at least 3 items later in the same session.
    const queue =
      result.outcome === 'modeled' && !state.closing
        ? requeue(state.queue, state.index, item, plan.fillers)
        : state.queue;
    return advance(
      { ...state, attempts: [...state.attempts, attempt], cards, sentenceIds },
      queue,
      action.timeUp,
    );
  };
}

function DailyLimit() {
  return (
    <main className="screen kid-screen" data-testid="daily-limit">
      <div className="screen__bar">
        <button
          type="button"
          className="icon-button"
          aria-label="Home"
          onClick={() => navigate('/')}
        >
          <HomeIcon />
        </button>
        <PromptAudio promptId="pr_done_today" />
      </div>
      <div className="screen__body">
        <span className="limit-moon">
          <MoonIcon />
        </span>
      </div>
    </main>
  );
}

function Finish({ newSentenceIds }: { newSentenceIds: readonly string[] }) {
  const promptId = newSentenceIds.length > 0 ? 'pr_new_book' : 'pr_all_done';
  return (
    <main className="screen kid-screen" data-testid="session-finish">
      <div className="screen__bar">
        <span />
        <PromptAudio promptId={promptId} />
      </div>
      <div className="screen__body">
        <span className="check-pop">
          <CheckIcon />
        </span>
        {newSentenceIds.length > 0 && (
          <div className="finish__books" data-testid="new-books">
            {newSentenceIds.map((id) => (
              <span key={id} className="finish__book">
                <Picture id="book" />
              </span>
            ))}
          </div>
        )}
        <button
          type="button"
          className="icon-button icon-button--large icon-button--accent"
          aria-label="Home"
          data-testid="finish-home"
          onClick={() => navigate('/')}
        >
          <HomeIcon />
        </button>
      </div>
    </main>
  );
}

function Runner({
  plan,
  sessionId,
  startTs,
}: {
  plan: SessionPlan;
  sessionId: string;
  startTs: number;
}) {
  const app = useApp();
  const reducer = useMemo(() => makeReducer(plan, sessionId, app.cardMap), [plan, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps -- the session works from the cards it started with
  const [state, dispatch] = useReducer(reducer, {
    queue: plan.items,
    index: 0,
    closing: plan.items.length === 0,
    finished: false,
    attempts: [],
    cards: new Map<string, LeitnerCard>(),
    sentenceIds: [],
  });
  const saved = useRef(false);
  const [newBooks, setNewBooks] = useState<string[]>([]);
  const minutes = app.settings.sessionMinutes;
  const timeUp = () => Date.now() - startTs >= minutes * 60_000;

  const item = state.closing ? plan.closer : state.queue[state.index];
  const live = { lexicon: app.lexicon, unlock: app.unlock, sentences: CONTENT.sentences };
  const readable = item ? isItemReadable(item, live) : false;

  // Runtime gate (spec §6.4): an item that is no longer readable is never shown.
  useEffect(() => {
    if (state.finished || !item || readable) return;
    if (import.meta.env.DEV) console.warn('Skipped an unreadable session item.', item);
    dispatch({ type: 'skip', timeUp: Date.now() - startTs >= minutes * 60_000 });
  }, [item, readable, state.finished, startTs, minutes]);

  const save = (complete: boolean) => {
    if (saved.current) return;
    saved.current = true;
    const end = Date.now();
    const already = new Set(app.storyRecords.map((r) => r.id));
    setNewBooks(state.sentenceIds.filter((id) => !already.has(id)));
    void app.recordSolo({
      attempts: state.attempts,
      cards: [...state.cards.values()],
      sentenceIds: state.sentenceIds,
      // An abandoned session keeps its attempts but does not count as a session.
      ...(complete
        ? { session: summarizeSession(sessionId, 'solo', startTs, end, state.attempts, plan.notes) }
        : {}),
    });
  };

  useEffect(() => {
    if (state.finished) save(true);
  }); // runs after the final item is recorded

  if (state.finished) return <Finish newSentenceIds={newBooks} />;
  if (!item || !readable) return <main className="screen kid-screen" />;

  const onDone = (result: ItemResult) =>
    dispatch({ type: 'done', result, now: Date.now(), timeUp: timeUp() });
  const key = `${state.closing ? 'closer' : state.index}-${itemId(item)}`;
  const sentence =
    item.kind === 'match' ? CONTENT.sentences.find((s) => s.id === item.sentenceId) : undefined;
  const total = state.queue.length + 1;
  const position = state.closing ? total : state.index + 1;

  return (
    <main
      className="screen kid-screen"
      data-testid="solo-session"
      data-position={position}
      data-total={total}
    >
      <div className="screen__bar">
        <HoldButton
          holdMs={EXIT_HOLD_MS}
          label="Hold to stop"
          testId="exit-session"
          onHeld={() => {
            save(false);
            navigate('/');
          }}
        >
          <HomeIcon />
        </HoldButton>
        <div className="progress-beads" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`bead${i < position - 1 ? ' bead--done' : ''}${i === position - 1 ? ' bead--now' : ''}`}
            />
          ))}
        </div>
        <span className="screen__bar-spacer" />
      </div>
      <div className="screen__body">
        {item.kind === 'warmup' && <WarmupActivity key={key} item={item} onDone={onDone} />}
        {item.kind === 'build' && <BuildActivity key={key} item={item} onDone={onDone} />}
        {item.kind === 'pick' && <PickActivity key={key} item={item} onDone={onDone} />}
        {item.kind === 'match' &&
          sentence &&
          isReadable(sentence.text, app.unlock, app.lexicon).ok && (
            <MatchActivity key={key} item={item} sentence={sentence} onDone={onDone} />
          )}
      </div>
    </main>
  );
}

/** Solo mode (spec §8): she works alone and the app verifies every answer. */
export function SoloSession() {
  const app = useApp();
  const [session] = useState(() => ({ id: crypto.randomUUID(), startTs: Date.now() }));
  const [limitReached] = useState(
    () => soloSessionsToday(app.sessions, Date.now()) >= app.settings.dailySoloLimit,
  );

  // The plan is built once, from the state at the moment the session starts.
  const [plan] = useState<SessionPlan>(() =>
    buildSession({
      lexicon: app.lexicon,
      unlock: app.unlock,
      sentences: CONTENT.sentences,
      patterns: CONTENT.patterns,
      sounds: CONTENT.sounds,
      pictures: PICTURES,
      cards: app.cardMap,
      attempts: app.attempts,
      sessions: app.sessions,
      now: session.startTs,
      minutes: app.settings.sessionMinutes,
      audioAvailable: audio.running,
      canSayWord: (word) => audio.canSayWord(word),
      canPlaySound: (soundId) => audio.has(soundClipId(soundId)),
      rng: createRng(session.startTs),
    }),
  );

  if (limitReached) return <DailyLimit />;
  return <Runner plan={plan} sessionId={session.id} startTs={session.startTs} />;
}
