import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/app/AppData';
import { audio } from '@/audio/AudioService';
import { soundClipId } from '@/content/audioManifest';
import { isRapidBurst } from '@/engine/guard';
import { findEntry } from '@/engine/lexicon';
import { classifyWord } from '@/engine/readability';
import type { BuildItem, MatchItem, PickItem, WarmupItem } from '@/engine/sessionBuilder';
import { tokenize } from '@/engine/tokenize';
import type { AnyEntry, Sentence, WordEntry } from '@/engine/types';
import { GraphemeChoice, PictureChoice, PromptPicture, WordChoice } from '@/ui/Choices';
import { ArrowIcon, CheckIcon } from '@/ui/icons';
import { ModelWord } from '@/ui/ModelWord';
import { PromptAudio } from '@/ui/PromptAudio';
import { SoundItOut } from '@/ui/SoundItOut';
import { TileBoard } from '@/ui/TileBoard';
import { Word } from '@/ui/Word';
import { useItemFlow, type ItemFlow, type ItemResult } from './useItemFlow';

interface ActivityProps<T> {
  item: T;
  onDone: (result: ItemResult) => void;
}

function shuffled<T>(items: readonly T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = result[i] as T;
    result[i] = result[j] as T;
    result[j] = a;
  }
  return result;
}

/** Help, modeling, the calm pause and the success check, shared by all activities. */
function FlowOverlays({
  flow,
  helpEntry,
  display,
}: {
  flow: ItemFlow;
  helpEntry: AnyEntry | undefined;
  display?: string;
}) {
  const { unlock } = useApp();
  if (flow.stage === 'success') {
    return (
      <div className="activity__success" data-testid="item-success">
        <span className="check-pop">
          <CheckIcon />
        </span>
      </div>
    );
  }
  if (flow.stage === 'paused')
    return <div className="activity__pause" data-testid="look-closely" />;
  if (!helpEntry) return null;
  const shared = { entry: helpEntry, unlock, ...(display === undefined ? {} : { display }) };
  if (flow.stage === 'help') {
    return <SoundItOut {...shared} mandatory={!flow.voluntaryHelp} onClose={flow.helpClosed} />;
  }
  if (flow.stage === 'model') return <ModelWord {...shared} onDone={flow.modelDone} />;
  return null;
}

function DevMissingAudio({ clipId }: { clipId: string }) {
  if (!import.meta.env.DEV || audio.has(clipId)) return null;
  return <span className="dev-badge">missing audio: {clipId}</span>;
}

// ---------------------------------------------------------------------------
// Sound warm-up
// ---------------------------------------------------------------------------

/** (a) A grapheme shows; she taps it to hear its sound. */
function WarmupHear({ item, onDone }: ActivityProps<WarmupItem>) {
  const flow = useItemFlow(onDone);
  const [heard, setHeard] = useState(false);
  const [active, setActive] = useState(false);

  const hear = () => {
    flow.touch();
    setActive(true);
    void audio.playSound(item.target).then(() => {
      setActive(false);
      setHeard(true);
      flow.promptEnded();
    });
  };

  return (
    <section className="activity" data-activity="warmup-hear" data-item={item.target.spelling}>
      <div className="activity__prompt">
        <PromptAudio promptId="pr_tap_to_hear" />
      </div>
      <button
        type="button"
        className={`grapheme-button${active ? ' grapheme-button--active' : ''}`}
        data-testid="grapheme-button"
        aria-label="Hear this sound"
        onClick={hear}
      >
        <span className="grapheme-card">{item.target.spelling}</span>
      </button>
      <button
        type="button"
        className="icon-button icon-button--large icon-button--accent"
        aria-label="Next"
        data-testid="next"
        disabled={!heard || flow.stage !== 'answer'}
        onClick={() => {
          if (flow.gate() === 'accept') flow.submit(true);
        }}
      >
        <ArrowIcon />
      </button>
      <DevMissingAudio clipId={soundClipId(item.target.soundId)} />
      <FlowOverlays flow={flow} helpEntry={undefined} />
    </section>
  );
}

/** (b) A sound plays; she picks the matching grapheme from 3. */
function WarmupFind({ item, onDone }: ActivityProps<WarmupItem>) {
  const flow = useItemFlow(onDone, { firstMiss: 'replay' });
  const options = useMemo(() => shuffled(item.options), [item.options, flow.round]); // eslint-disable-line react-hooks/exhaustive-deps -- reshuffle each round
  const targetIdx = options.findIndex((o) => o.spelling === item.target.spelling);
  const playTarget = useCallback(() => audio.playSound(item.target), [item.target]);
  const { stage, modelDone, promptEnded } = flow;

  // Second miss: say the sound again, then highlight the answer for her to tap.
  useEffect(() => {
    if (stage !== 'model') return undefined;
    let cancelled = false;
    void (async () => {
      await audio.playPromptThen('pr_watch_listen', () => audio.playSound(item.target));
      if (!cancelled) modelDone();
    })();
    return () => {
      cancelled = true;
    };
  }, [stage, item.target, modelDone]);

  useEffect(() => {
    if (stage !== 'confirm') return;
    void audio.playPrompt('pr_tap_this_one').then(promptEnded);
  }, [stage, promptEnded]);

  return (
    <section className="activity" data-activity="warmup-find" data-item={item.target.spelling}>
      <div className="activity__prompt">
        {stage === 'answer' && (
          <PromptAudio
            key={flow.round}
            promptId="pr_find_sound"
            after={playTarget}
            onFinished={promptEnded}
          />
        )}
      </div>
      <GraphemeChoice
        spellings={options.map((o) => o.spelling)}
        highlightIdx={stage === 'confirm' ? targetIdx : null}
        disabled={stage !== 'answer' && stage !== 'confirm'}
        onChoose={(index) => flow.tap(index === targetIdx)}
      />
      <FlowOverlays flow={flow} helpEntry={undefined} />
    </section>
  );
}

export function WarmupActivity(props: ActivityProps<WarmupItem>) {
  return props.item.variant === 'find' ? <WarmupFind {...props} /> : <WarmupHear {...props} />;
}

// ---------------------------------------------------------------------------
// Pick the word
// ---------------------------------------------------------------------------

export function PickActivity({ item, onDone }: ActivityProps<PickItem>) {
  const { lexicon, unlock } = useApp();
  const flow = useItemFlow(onDone);
  const target = lexicon.words.get(item.wordId);
  const options = useMemo(
    () =>
      shuffled(
        item.optionIds.map((id) => lexicon.words.get(id)).filter((w): w is WordEntry => !!w),
      ),
    [item.optionIds, lexicon, flow.round], // eslint-disable-line react-hooks/exhaustive-deps -- reshuffle each round
  );
  const targetIdx = options.findIndex((o) => o.id === item.wordId);
  const { stage, promptEnded } = flow;

  useEffect(() => {
    if (stage !== 'confirm') return;
    void audio.playPrompt('pr_tap_this_one').then(promptEnded);
  }, [stage, promptEnded]);

  if (!target) return null;
  return (
    <section className="activity" data-activity="pick" data-item={item.wordId}>
      <div className="activity__prompt">
        {stage === 'answer' && (
          <PromptAudio key={flow.round} promptId="pr_find_word" onFinished={promptEnded} />
        )}
      </div>
      {target.pictureId && <PromptPicture pictureId={target.pictureId} />}
      <WordChoice
        options={options}
        unlock={unlock}
        highlightIdx={stage === 'confirm' ? targetIdx : null}
        disabled={stage !== 'answer' && stage !== 'confirm'}
        onChoose={(index) => flow.tap(index === targetIdx)}
      />
      <FlowOverlays flow={flow} helpEntry={target} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Word building
// ---------------------------------------------------------------------------

const CHECK_DELAY_MS = 500;

export function BuildActivity({ item, onDone }: ActivityProps<BuildItem>) {
  const { lexicon } = useApp();
  const flow = useItemFlow(onDone);
  const target = lexicon.words.get(item.wordId);
  const boxCount = target?.graphemes.length ?? 0;
  const [placed, setPlaced] = useState<(string | null)[]>(() =>
    Array.from({ length: boxCount }, () => null),
  );
  const tapTimes = useRef<number[]>([]);
  const { stage, round, promptEnded } = flow;
  const sayWord = useCallback(
    () => (target ? audio.playWord(target) : Promise.resolve(false)),
    [target],
  );

  // Every time the word is posed again the boxes start empty.
  useEffect(() => {
    setPlaced(Array.from({ length: boxCount }, () => null));
    tapTimes.current = [];
  }, [round, boxCount]);

  useEffect(() => {
    if (stage !== 'confirm') return;
    void audio.playPrompt('pr_your_turn').then(promptEnded);
  }, [stage, promptEnded]);

  const spellingOfTile = (tileId: string | null) =>
    item.tiles.find((t) => t.id === tileId)?.spelling;

  // Check the word once every box is filled.
  useEffect(() => {
    if (!target || placed.includes(null) || (stage !== 'answer' && stage !== 'confirm'))
      return undefined;
    const timer = window.setTimeout(() => {
      const correct = placed.every(
        (tileId, i) => spellingOfTile(tileId) === target.graphemes[i]?.spelling,
      );
      if (stage === 'answer' && isRapidBurst(tapTimes.current)) flow.pause();
      else flow.submit(correct);
    }, CHECK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [placed, stage, target]); // eslint-disable-line react-hooks/exhaustive-deps -- checks once per completed board

  if (!target) return null;

  const firstEmpty = placed.indexOf(null);
  const guideTileId =
    stage === 'confirm' && firstEmpty !== -1
      ? (item.tiles.find(
          (t) => !placed.includes(t.id) && t.spelling === target.graphemes[firstEmpty]?.spelling,
        )?.id ?? null)
      : null;

  const onPlace = (tileId: string, boxIdx: number) => {
    tapTimes.current.push(Date.now());
    setPlaced((previous) => {
      const next = previous.map((id) => (id === tileId ? null : id));
      const targetBox = stage === 'confirm' ? firstEmpty : boxIdx;
      if (targetBox >= 0 && targetBox < next.length) next[targetBox] = tileId;
      return next;
    });
  };

  return (
    <section className="activity" data-activity="build" data-item={item.wordId}>
      <div className="activity__prompt">
        {stage === 'answer' && (
          <PromptAudio
            key={round}
            promptId="pr_build_word"
            after={sayWord}
            onFinished={promptEnded}
          />
        )}
      </div>
      {target.pictureId && <PromptPicture pictureId={target.pictureId} />}
      <TileBoard
        tiles={item.tiles}
        placed={placed}
        onPlace={onPlace}
        onRemove={(boxIdx) =>
          setPlaced((previous) => previous.map((id, i) => (i === boxIdx ? null : id)))
        }
        guideTileId={stage === 'confirm' ? guideTileId : null}
        disabled={stage !== 'answer' && stage !== 'confirm'}
      />
      <FlowOverlays flow={flow} helpEntry={target} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Read then match
// ---------------------------------------------------------------------------

const DONE_NUDGE_MS = 4000;

/** The word in the sentence that names the element a wrong scene changed. */
function focusEntry(
  sentence: Sentence,
  changed: string | undefined,
  lookup: (key: string) => AnyEntry | undefined,
) {
  const entries = tokenize(sentence.text)
    .map((token) => ({ token, entry: lookup(token.key) }))
    .filter((x): x is { token: (typeof x)['token']; entry: AnyEntry } => !!x.entry);
  const byPicture = (pictureId: string | undefined) =>
    entries.find((x) => pictureId && x.entry.pictureId === pictureId);
  const relation = entries.find((x) => ['on', 'in'].includes(x.token.key));
  const firstDecodable = entries.find((x) => x.entry.isHeartWord !== true);
  const found =
    (changed === 'subject' && byPicture(sentence.scene?.subject)) ||
    (changed === 'object' && byPicture(sentence.scene?.object)) ||
    (changed === 'relation' && relation) ||
    byPicture(sentence.scene?.subject) ||
    firstDecodable ||
    entries[0];
  return found ? { entry: found.entry, display: found.token.word } : undefined;
}

export function MatchActivity({
  item,
  sentence,
  onDone,
}: ActivityProps<MatchItem> & { sentence: Sentence }) {
  const { lexicon, unlock } = useApp();
  const flow = useItemFlow(onDone);
  const [phase, setPhase] = useState<'read' | 'choose'>('read');
  const [nudge, setNudge] = useState(false);
  const [help, setHelp] = useState<{ entry: AnyEntry; display: string } | undefined>();
  const choices = useMemo(() => shuffled(item.choices), [item.choices, flow.round]); // eslint-disable-line react-hooks/exhaustive-deps -- reshuffle each round
  const targetIdx = choices.findIndex((c) => c.correct);
  const lookup = useCallback((key: string) => findEntry(key, lexicon), [lexicon]);
  const { stage, promptEnded } = flow;

  // If she has not tapped "done" after a few seconds, draw the eye to it.
  // The pictures themselves never appear until she says she has read it.
  useEffect(() => {
    if (phase !== 'read') return undefined;
    const timer = window.setTimeout(() => setNudge(true), DONE_NUDGE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (stage !== 'confirm') return;
    void audio.playPrompt('pr_tap_this_one').then(promptEnded);
  }, [stage, promptEnded]);

  const tokens = tokenize(sentence.text);
  const readable = tokens.every((t) =>
    ['decodable', 'heart'].includes(classifyWord(t.word, unlock, lexicon).cls),
  );
  if (!readable) return null; // runtime gate (spec §6.4); the runner has already skipped it

  const choose = (index: number) => {
    const choice = choices[index];
    if (!choice) return;
    if (!choice.correct) setHelp(focusEntry(sentence, choice.changed, lookup));
    flow.tap(choice.correct);
  };

  return (
    <section
      className="activity"
      data-activity="match"
      data-item={item.sentenceId}
      data-phase={phase}
    >
      <div className="activity__prompt">
        {stage === 'answer' && (
          <PromptAudio
            key={`${phase}-${flow.round}`}
            promptId={phase === 'read' ? 'pr_read_sentence' : 'pr_find_picture'}
            onFinished={promptEnded}
          />
        )}
      </div>
      <p className="activity__sentence" data-testid="match-sentence">
        {tokens.map((token, i) => {
          const entry = lookup(token.key);
          if (!entry) return null;
          return (
            <Fragment key={i}>
              <span className="reader__token">
                {token.lead}
                <Word
                  entry={entry}
                  unlock={unlock}
                  display={token.word}
                  size="sentence"
                  onTap={() => {
                    if (stage !== 'answer') return;
                    setHelp({ entry, display: token.word });
                    flow.openHelp();
                  }}
                />
                {token.trail}
              </span>{' '}
            </Fragment>
          );
        })}
      </p>
      {phase === 'read' ? (
        <button
          type="button"
          className={`icon-button icon-button--large icon-button--accent${nudge ? ' icon-button--nudge' : ''}`}
          aria-label="I have read it"
          data-testid="read-done"
          onClick={() => {
            if (flow.gate() !== 'accept') return;
            flow.promptStarted();
            setPhase('choose');
          }}
        >
          <ArrowIcon />
        </button>
      ) : (
        <PictureChoice
          scenes={choices.map((c) => c.scene)}
          highlightIdx={stage === 'confirm' ? targetIdx : null}
          disabled={stage !== 'answer' && stage !== 'confirm'}
          onChoose={choose}
        />
      )}
      <FlowOverlays
        flow={flow}
        helpEntry={help?.entry}
        {...(help ? { display: help.display } : {})}
      />
    </section>
  );
}
