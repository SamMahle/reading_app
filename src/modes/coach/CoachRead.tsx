import { useMemo, useState } from 'react';
import { useApp } from '@/app/AppData';
import { useReaderPosition } from '@/app/reading';
import { navigate } from '@/app/router';
import { applyCoachSession, LADDER } from '@/engine/ladder';
import { findEntry } from '@/engine/lexicon';
import { accuracy, summarizeSession } from '@/engine/metrics';
import { preTeachEntries, unresolvedWords, withOneTimeHeartWords } from '@/engine/passage';
import { partitionReadable } from '@/engine/readability';
import type { AnyEntry, Attempt, LadderState, Outcome } from '@/engine/types';
import { FocusReader, type WordMark } from '@/ui/FocusReader';
import { CheckIcon, HomeIcon, StarIcon } from '@/ui/icons';
import { ParentStrip } from '@/ui/ParentStrip';
import { PromptAudio } from '@/ui/PromptAudio';
import { SoundItOut } from '@/ui/SoundItOut';
import { RUNG_LABELS } from './CoachHome';
import './coach.css';

interface ScoredWord {
  wordId: string;
  text: string;
  mark: WordMark;
}

interface Summary {
  stars: number;
  accuracy: number;
  total: number;
  helpWords: string[];
  before: LadderState;
  after: LadderState;
}

function outcomeFor(mark: WordMark, usedHelp: boolean): Outcome {
  if (mark === 'self_corrected') return 'self_corrected';
  if (mark === 'needed_help') return 'helped';
  return usedHelp ? 'helped' : 'correct';
}

function ladderMessage(summary: Summary): string {
  const { before, after } = summary;
  if (after.rung > before.rung) return `Moving up: next time she reads ${RUNG_LABELS[after.rung]}.`;
  if (after.rung < before.rung)
    return `Easing off: next time she reads ${RUNG_LABELS[after.rung]}.`;
  if (summary.accuracy >= LADDER.moveUpAccuracy && after.rung < 5) {
    return 'One more session at 90% or better moves her up a step.';
  }
  return `Staying at ${RUNG_LABELS[after.rung]}.`;
}

function SummaryScreen({ summary }: { summary: Summary }) {
  return (
    <main className="screen" data-testid="coach-summary">
      <div className="screen__bar">
        <span />
        <PromptAudio promptId="pr_great_reading" />
      </div>
      <div className="screen__body">
        <div className="summary__stars" data-testid="summary-stars" data-stars={summary.stars}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={i < summary.stars ? 'summary__star summary__star--on' : 'summary__star'}
            >
              <StarIcon filled={i < summary.stars} />
            </span>
          ))}
        </div>
        <div className="summary__card">
          <p className="summary__figure" data-testid="summary-accuracy">
            {Math.round(summary.accuracy * 100)}%{' '}
            <span>of {summary.total} words read correctly</span>
          </p>
          <p data-testid="summary-ladder">{ladderMessage(summary)}</p>
          {summary.helpWords.length > 0 && (
            <p data-testid="summary-help-words">
              Needed help: <strong>{summary.helpWords.join(', ')}</strong>. These words will come
              back in her solo practice.
            </p>
          )}
        </div>
        <button
          type="button"
          className="icon-button icon-button--large icon-button--accent"
          aria-label="Home"
          data-testid="summary-home"
          onClick={() => navigate('/')}
        >
          <HomeIcon />
        </button>
      </div>
    </main>
  );
}

/** Coach reading (spec §9): she reads aloud while a parent scores. */
export function CoachRead({ id }: { id: string }) {
  const app = useApp();
  const story = app.stories.find((s) => s.id === id);
  const record = app.storyRecords.find((r) => r.id === id);
  const oneTime = record?.passage?.oneTimeHeartWords;
  const lexicon = useMemo(
    () => withOneTimeHeartWords(app.lexicon, oneTime ?? []),
    [app.lexicon, oneTime],
  );
  const isPassage = story?.source === 'class_passage';
  const [session] = useState(() => ({ id: crypto.randomUUID(), startTs: Date.now() }));

  // Words to pre-teach: only a class passage may contain not-yet words (spec §9.5).
  const toTeach = useMemo(
    () => (story && isPassage ? preTeachEntries(story, app.unlock, lexicon) : []),
    [story, isPassage, app.unlock, lexicon],
  );
  const [taughtCount, setTaughtCount] = useState(0);
  const preTaught = useMemo(
    () => new Set(toTeach.slice(0, taughtCount).map((e) => e.id)),
    [toTeach, taughtCount],
  );
  const teaching = taughtCount < toTeach.length;

  const pages = story?.pages ?? [];
  const reader = useReaderPosition(
    pages,
    app.ladder.rung,
    app.unlock,
    lexicon,
    isPassage ? preTaught : undefined,
  );
  const [marks, setMarks] = useState<Map<string, ScoredWord>>(() => new Map());
  const [helped, setHelped] = useState<Map<string, boolean>>(() => new Map());
  const [selected, setSelected] = useState<number | null>(null);
  const [help, setHelp] = useState<{ entry: AnyEntry; display: string; key: string } | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  if (!story) {
    return (
      <main className="screen" data-testid="coach-missing">
        <div className="screen__body">
          <p>This story is no longer available.</p>
          <button
            type="button"
            className="icon-button"
            aria-label="Back"
            onClick={() => navigate('/coach')}
          >
            <HomeIcon />
          </button>
        </div>
      </main>
    );
  }

  // Gate: an app story is only read when every sentence passes the checker;
  // a class passage must have no unknown words left.
  const blocked = isPassage
    ? unresolvedWords(story, app.unlock, lexicon)
    : partitionReadable(story.pages.flat(), app.unlock, lexicon).refused.map(
        (r) => r.sentence.text,
      );
  if (blocked.length > 0) {
    return (
      <main className="screen" data-testid="coach-blocked">
        <div className="screen__body">
          <p className="coach-blocked">
            {isPassage
              ? `This passage has words the app does not know yet: ${blocked.join(', ')}. Add them in the parent area, under Class passage.`
              : 'This story uses patterns that are locked right now. Unlock its level in the parent area to read it.'}
          </p>
          <button
            type="button"
            className="icon-button"
            aria-label="Back"
            onClick={() => navigate('/coach')}
          >
            <HomeIcon />
          </button>
        </div>
      </main>
    );
  }

  if (summary) return <SummaryScreen summary={summary} />;

  if (teaching) {
    const entry = toTeach[taughtCount];
    return (
      <main
        className="screen kid-screen"
        data-testid="pre-teach"
        data-remaining={toTeach.length - taughtCount}
      >
        <div className="screen__bar">
          <span />
          <PromptAudio promptId="pr_new_words" />
        </div>
        {entry && (
          <SoundItOut
            key={entry.id}
            entry={entry}
            unlock={app.unlock}
            mandatory
            onClose={() => setTaughtCount((n) => n + 1)}
          />
        )}
      </main>
    );
  }

  const { layout, pageIdx, chunkIdx } = reader;
  const chunk = layout.chunks[chunkIdx];
  const keyOf = (wordIdx: number) => `${pageIdx}:${wordIdx}`;
  const pageMarks = new Map<number, WordMark>();
  layout.words.forEach((_, i) => {
    const scored = marks.get(keyOf(i));
    if (scored) pageMarks.set(i, scored.mark);
  });

  const withMark = (
    base: Map<string, ScoredWord>,
    wordIdx: number,
    mark: WordMark,
    overwrite: boolean,
  ) => {
    const word = layout.words[wordIdx];
    const entry = word ? findEntry(word.token.key, lexicon) : undefined;
    const key = keyOf(wordIdx);
    if (!word || !entry || (!overwrite && base.has(key))) return;
    base.set(key, { wordId: entry.id, text: word.token.word, mark });
  };

  const finish = (finalMarks: Map<string, ScoredWord>) => {
    const end = Date.now();
    const attempts: Attempt[] = [...finalMarks.entries()].map(([key, scored]) => ({
      id: crypto.randomUUID(),
      ts: end,
      mode: 'coach',
      activity: 'read',
      itemId: scored.wordId,
      outcome: outcomeFor(scored.mark, helped.has(key)),
      usedHelp: helped.has(key),
      completedHelp: helped.get(key) ?? false,
      sessionId: session.id,
    }));
    const value = accuracy(attempts);
    const after = applyCoachSession(app.ladder, value, end);
    const stallWords = [...finalMarks.values()].filter((s) => s.mark === 'needed_help');
    const stars = Math.min((record?.reads.length ?? 0) + 1, 3);
    setSummary({
      stars,
      accuracy: value,
      total: attempts.length,
      helpWords: [...new Set(stallWords.map((s) => s.text.toLowerCase()))],
      before: app.ladder,
      after,
    });
    void app.recordCoach({
      attempts,
      session: summarizeSession(session.id, 'coach', session.startTs, end, attempts, [], story.id),
      ladder: after,
      stallWordIds: [...new Set(stallWords.map((s) => s.wordId))],
      storyId: story.id,
      storyType: isPassage ? 'class_passage' : 'story',
    });
  };

  /** Score whatever is unscored in this chunk as correct, then move on. */
  const completeChunk = (base: Map<string, ScoredWord>) => {
    const next = new Map(base);
    if (chunk) for (let i = chunk.start; i < chunk.end; i += 1) withMark(next, i, 'correct', false);
    setMarks(next);
    setSelected(null);
    if (!reader.advance()) finish(next);
  };

  const singleWord = chunk ? chunk.end - chunk.start === 1 : false;
  const onMark = (mark: WordMark) => {
    const next = new Map(marks);
    if (selected !== null) {
      withMark(next, selected, mark, true);
      setMarks(next);
      setSelected(null);
      return;
    }
    if (mark !== 'correct' && singleWord && chunk) withMark(next, chunk.start, mark, true);
    completeChunk(next);
  };

  const selectedWord = selected === null ? null : (layout.words[selected]?.token.word ?? null);
  const strip = (
    <ParentStrip
      side={app.settings.stripSide}
      selectedWord={selectedWord}
      singleWord={singleWord}
      onMark={onMark}
    />
  );

  return (
    <main
      className="screen coach-read"
      data-testid="coach-read"
      data-page={pageIdx + 1}
      data-pages={pages.length}
      data-chunk={chunkIdx}
    >
      <div className="screen__bar">
        <button
          type="button"
          className="icon-button icon-button--ghost"
          aria-label="Stop reading"
          onClick={() => navigate('/coach')}
        >
          <HomeIcon />
        </button>
        <div className="coach-pages" aria-label={`Page ${pageIdx + 1} of ${pages.length}`}>
          {pages.map((_, i) => (
            <span
              key={i}
              className={`bead${i < pageIdx ? ' bead--done' : ''}${i === pageIdx ? ' bead--now' : ''}`}
            >
              {i < pageIdx && <CheckIcon />}
            </span>
          ))}
        </div>
        <PromptAudio promptId="pr_read_aloud" />
      </div>
      <div className={`coach-read__body coach-read__body--${app.settings.stripSide}`}>
        {app.settings.stripSide === 'left' && strip}
        <div className="coach-read__text kid-screen">
          <FocusReader
            key={pageIdx}
            sentences={reader.sentences}
            rung={app.ladder.rung}
            chunkIdx={chunkIdx}
            unlock={app.unlock}
            lexicon={lexicon}
            {...(isPassage ? { preTaught } : {})}
            marks={pageMarks}
            selectedIdx={selected}
            onWordTap={(entry, display, wordIdx) =>
              setHelp({ entry, display, key: keyOf(wordIdx) })
            }
            onWordLongPress={(wordIdx) => setSelected(wordIdx)}
            onAdvance={() => completeChunk(marks)}
          />
        </div>
        {app.settings.stripSide === 'right' && strip}
      </div>
      {help && (
        <SoundItOut
          entry={help.entry}
          display={help.display}
          unlock={app.unlock}
          onClose={(result) => {
            setHelped((previous) =>
              new Map(previous).set(
                help.key,
                (previous.get(help.key) ?? false) || result.completedHelp,
              ),
            );
            setHelp(null);
          }}
        />
      )}
    </main>
  );
}
