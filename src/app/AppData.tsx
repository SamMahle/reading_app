import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import { audio } from '@/audio/AudioService';
import { soundClipsForUnlock, wordClipId } from '@/content/audioManifest';
import { CONTENT, defaultUnlock } from '@/content/index';
import { importBackup } from '@/data/backup';
import { openStore, type AppStore } from '@/data/store';
import { DEFAULT_SETTINGS, type AudioRecord, type Settings, type StoryRecord } from '@/data/types';
import { initialLadder } from '@/engine/ladder';
import { buildLexicon } from '@/engine/lexicon';
import { classifyWord } from '@/engine/readability';
import { enqueueStallWord } from '@/engine/scheduler';
import type {
  AnyEntry,
  Attempt,
  LadderState,
  LeitnerCard,
  Lexicon,
  SessionSummary,
  Story,
  UnlockState,
} from '@/engine/types';

/** Everything persisted, loaded once and kept in step with IndexedDB. */
export interface AppState {
  ready: boolean;
  failed: boolean;
  settings: Settings;
  unlock: UnlockState;
  custom: AnyEntry[];
  ladder: LadderState;
  cards: LeitnerCard[];
  attempts: Attempt[];
  sessions: SessionSummary[];
  storyRecords: StoryRecord[];
  /** Ids of clips recorded in Sound Studio. */
  recordedClips: string[];
}

type Action =
  | { type: 'loaded'; state: AppState }
  | { type: 'patch'; patch: Partial<AppState> }
  | { type: 'failed' };

const INITIAL: AppState = {
  ready: false,
  failed: false,
  settings: DEFAULT_SETTINGS,
  unlock: defaultUnlock(),
  custom: [],
  ladder: initialLadder(0),
  cards: [],
  attempts: [],
  sessions: [],
  storyRecords: [],
  recordedClips: [],
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'loaded':
      return action.state;
    case 'patch':
      return { ...state, ...action.patch };
    case 'failed':
      return { ...state, failed: true };
  }
}

export interface SoloResult {
  attempts: Attempt[];
  cards: LeitnerCard[];
  /** Omitted when the session was abandoned part-way. */
  session?: SessionSummary;
  /** Sentence ids completed this session; new ones join the Bookshelf. */
  sentenceIds: string[];
}

export interface CoachResult {
  attempts: Attempt[];
  session: SessionSummary;
  ladder: LadderState;
  /** ✕ words: they enter box 1 of the Solo queue. */
  stallWordIds: string[];
  storyId: string;
  storyType: StoryRecord['type'];
}

export interface AppContextValue extends AppState {
  store: AppStore | null;
  lexicon: Lexicon;
  /** Bundled stories plus saved class passages. */
  stories: Story[];
  cardMap: ReadonlyMap<string, LeitnerCard>;
  saveSettings(patch: Partial<Settings>): Promise<void>;
  saveUnlock(unlock: UnlockState): Promise<void>;
  saveCustom(entry: AnyEntry): Promise<void>;
  deleteCustom(id: string): Promise<void>;
  saveLadder(ladder: LadderState): Promise<void>;
  putStoryRecord(record: StoryRecord): Promise<void>;
  deleteStoryRecord(id: string): Promise<void>;
  recordSolo(result: SoloResult): Promise<void>;
  recordCoach(result: CoachResult): Promise<void>;
  saveRecording(record: AudioRecord): Promise<void>;
  deleteRecording(clipId: string): Promise<void>;
  restoreBackup(backup: unknown): Promise<void>;
  logError(mode: string, error: Error): void;
}

const AppContext = createContext<AppContextValue | null>(null);

async function loadState(store: AppStore): Promise<AppState> {
  const now = Date.now();
  let [settings, unlock, ladder] = await Promise.all([
    store.getSettings(),
    store.getUnlock(),
    store.getLadder(),
  ]);
  if (!unlock) {
    unlock = defaultUnlock();
    await store.saveUnlock(unlock);
  }
  if (!ladder) {
    ladder = initialLadder(now);
    await store.saveLadder(ladder);
  }
  // Ask once for persistent storage so iPadOS does not evict progress (spec §11).
  if (settings.persistGranted === undefined && navigator.storage?.persist) {
    const persistGranted = await navigator.storage.persist().catch(() => false);
    settings = { ...settings, persistGranted };
    await store.saveSettings(settings);
  }
  const [custom, cards, attempts, sessions, storyRecords, recordings] = await Promise.all([
    store.listCustom(),
    store.listCards(),
    store.listAttempts(),
    store.listSessions(),
    store.listStoryRecords(),
    store.listAudio(),
  ]);
  audio.deviceVoice = settings.deviceVoice;
  audio.quiet = settings.quietMode;
  audio.setRecordings(recordings);
  return {
    ready: true,
    failed: false,
    settings,
    unlock,
    custom,
    ladder,
    cards,
    attempts,
    sessions,
    storyRecords,
    recordedClips: recordings.map((r) => r.clipId),
  };
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const storeRef = useRef<AppStore | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const reload = useCallback(async () => {
    const store = storeRef.current ?? (await openStore());
    storeRef.current = store;
    dispatch({ type: 'loaded', state: await loadState(store) });
  }, []);

  useEffect(() => {
    reload().catch((error: unknown) => {
      console.error('Could not open local storage.', error);
      dispatch({ type: 'failed' });
    });
  }, [reload]);

  const lexicon = useMemo(
    () => buildLexicon(CONTENT.levels, CONTENT.words, CONTENT.heartWords, state.custom),
    [state.custom],
  );

  const stories = useMemo(() => {
    const passages = state.storyRecords.flatMap((record) =>
      record.passage ? [record.passage.story] : [],
    );
    return [...CONTENT.stories, ...passages];
  }, [state.storyRecords]);

  const cardMap = useMemo(
    () => new Map(state.cards.map((card) => [card.wordId, card])),
    [state.cards],
  );

  // Decode the sound clips for everything unlocked, ahead of first use (spec §12).
  useEffect(() => {
    if (!state.ready) return;
    const words = [...lexicon.words.values(), ...lexicon.heartWords.values()]
      .filter((entry) =>
        ['decodable', 'heart'].includes(classifyWord(entry.text, state.unlock, lexicon).cls),
      )
      .map((entry) => entry.audioWord ?? wordClipId(entry.id));
    void audio.preload([
      ...soundClipsForUnlock(state.unlock, CONTENT, state.custom),
      ...CONTENT.prompts.map((p) => p.id),
      ...words,
    ]);
  }, [state.ready, state.unlock, state.custom, state.recordedClips, lexicon]);

  const actions = useMemo(() => {
    const store = () => {
      if (!storeRef.current) throw new Error('Storage is not ready.');
      return storeRef.current;
    };
    const patch = (value: Partial<AppState>) => dispatch({ type: 'patch', patch: value });
    const upsertRecord = (records: StoryRecord[], record: StoryRecord) => [
      ...records.filter((r) => r.id !== record.id),
      record,
    ];

    return {
      async saveSettings(change: Partial<Settings>) {
        const settings = { ...stateRef.current.settings, ...change };
        audio.deviceVoice = settings.deviceVoice;
        audio.quiet = settings.quietMode;
        await store().saveSettings(settings);
        patch({ settings });
      },
      async saveUnlock(unlock: UnlockState) {
        await store().saveUnlock(unlock);
        patch({ unlock });
      },
      async saveCustom(entry: AnyEntry) {
        await store().putCustom(entry);
        patch({ custom: [...stateRef.current.custom.filter((e) => e.id !== entry.id), entry] });
      },
      async deleteCustom(id: string) {
        await store().deleteCustom(id);
        patch({ custom: stateRef.current.custom.filter((e) => e.id !== id) });
      },
      async saveLadder(ladder: LadderState) {
        await store().saveLadder(ladder);
        patch({ ladder });
      },
      async putStoryRecord(record: StoryRecord) {
        await store().putStoryRecord(record);
        patch({ storyRecords: upsertRecord(stateRef.current.storyRecords, record) });
      },
      async deleteStoryRecord(id: string) {
        await store().deleteStoryRecord(id);
        patch({ storyRecords: stateRef.current.storyRecords.filter((r) => r.id !== id) });
      },
      async recordSolo(result: SoloResult) {
        const current = stateRef.current;
        const now = Date.now();
        let storyRecords = current.storyRecords;
        const newRecords: StoryRecord[] = [];
        for (const id of result.sentenceIds) {
          const existing = storyRecords.find((r) => r.id === id);
          const record: StoryRecord = existing
            ? { ...existing, reads: [...existing.reads, now] }
            : { id, type: 'sentence', reads: [now], shelvedTs: now };
          newRecords.push(record);
          storyRecords = upsertRecord(storyRecords, record);
        }
        const { session } = result;
        await Promise.all([
          store().addAttempts(result.attempts),
          store().putCards(result.cards),
          ...(session ? [store().addSession(session)] : []),
          ...newRecords.map((r) => store().putStoryRecord(r)),
        ]);
        const changed = new Set(result.cards.map((c) => c.wordId));
        patch({
          attempts: [...current.attempts, ...result.attempts],
          cards: [...current.cards.filter((c) => !changed.has(c.wordId)), ...result.cards],
          sessions: session ? [...current.sessions, session] : current.sessions,
          storyRecords,
        });
      },
      async recordCoach(result: CoachResult) {
        const current = stateRef.current;
        const now = result.session.ts + result.session.durationMs;
        const byId = new Map(current.cards.map((c) => [c.wordId, c]));
        const stallCards = result.stallWordIds.map((id) => enqueueStallWord(byId.get(id), id, now));
        const existing = current.storyRecords.find((r) => r.id === result.storyId);
        const record: StoryRecord = existing
          ? { ...existing, reads: [...existing.reads, now], shelvedTs: existing.shelvedTs ?? now }
          : { id: result.storyId, type: result.storyType, reads: [now], shelvedTs: now };
        await Promise.all([
          store().addAttempts(result.attempts),
          store().putCards(stallCards),
          store().addSession(result.session),
          store().saveLadder(result.ladder),
          store().putStoryRecord(record),
        ]);
        const changed = new Set(stallCards.map((c) => c.wordId));
        patch({
          attempts: [...current.attempts, ...result.attempts],
          cards: [...current.cards.filter((c) => !changed.has(c.wordId)), ...stallCards],
          sessions: [...current.sessions, result.session],
          ladder: result.ladder,
          storyRecords: upsertRecord(current.storyRecords, record),
        });
      },
      async saveRecording(record: AudioRecord) {
        await store().putAudio(record);
        await audio.setRecording(record);
        patch({ recordedClips: [...new Set([...stateRef.current.recordedClips, record.clipId])] });
      },
      async deleteRecording(clipId: string) {
        await store().deleteAudio(clipId);
        audio.removeRecording(clipId);
        patch({ recordedClips: stateRef.current.recordedClips.filter((id) => id !== clipId) });
      },
      async restoreBackup(backup: unknown) {
        await importBackup(store(), backup);
        await reload();
      },
      logError(mode: string, error: Error) {
        const record = {
          id: crypto.randomUUID(),
          ts: Date.now(),
          mode,
          message: error.message,
          ...(error.stack ? { stack: error.stack } : {}),
        };
        void storeRef.current?.addError(record).catch(() => undefined);
      },
    };
  }, [reload]);

  const value = useMemo<AppContextValue>(
    () => ({ ...state, store: storeRef.current, lexicon, stories, cardMap, ...actions }),
    [state, lexicon, stories, cardMap, actions],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppDataProvider.');
  return value;
}
