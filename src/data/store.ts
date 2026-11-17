import type {
  AnyEntry,
  Attempt,
  LadderState,
  LeitnerCard,
  SessionSummary,
  UnlockState,
} from '@/engine/types';
import { openAppDb, SINGLETON_KEYS, type AppDb } from './db';
import {
  DEFAULT_SETTINGS,
  type AudioRecord,
  type ErrorRecord,
  type Settings,
  type StoryRecord,
} from './types';

/** Typed access to every IndexedDB store. All app persistence goes through here. */
export class AppStore {
  constructor(readonly db: AppDb) {}

  async getSettings(): Promise<Settings> {
    const stored = await this.db.get('settings', SINGLETON_KEYS.settings);
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  async saveSettings(settings: Settings): Promise<void> {
    await this.db.put('settings', settings, SINGLETON_KEYS.settings);
  }

  getUnlock(): Promise<UnlockState | undefined> {
    return this.db.get('unlock', SINGLETON_KEYS.unlock);
  }

  async saveUnlock(unlock: UnlockState): Promise<void> {
    await this.db.put('unlock', unlock, SINGLETON_KEYS.unlock);
  }

  async addAttempts(attempts: readonly Attempt[]): Promise<void> {
    const tx = this.db.transaction('attempts', 'readwrite');
    await Promise.all([...attempts.map((a) => tx.store.put(a)), tx.done]);
  }

  listAttempts(): Promise<Attempt[]> {
    return this.db.getAllFromIndex('attempts', 'ts');
  }

  listCards(): Promise<LeitnerCard[]> {
    return this.db.getAll('leitner');
  }

  async putCards(cards: readonly LeitnerCard[]): Promise<void> {
    const tx = this.db.transaction('leitner', 'readwrite');
    await Promise.all([...cards.map((c) => tx.store.put(c)), tx.done]);
  }

  getLadder(): Promise<LadderState | undefined> {
    return this.db.get('ladder', SINGLETON_KEYS.ladder);
  }

  async saveLadder(ladder: LadderState): Promise<void> {
    await this.db.put('ladder', ladder, SINGLETON_KEYS.ladder);
  }

  listStoryRecords(): Promise<StoryRecord[]> {
    return this.db.getAll('stories');
  }

  async putStoryRecord(record: StoryRecord): Promise<void> {
    await this.db.put('stories', record);
  }

  async deleteStoryRecord(id: string): Promise<void> {
    await this.db.delete('stories', id);
  }

  listCustom(): Promise<AnyEntry[]> {
    return this.db.getAll('customContent');
  }

  async putCustom(entry: AnyEntry): Promise<void> {
    await this.db.put('customContent', entry);
  }

  async deleteCustom(id: string): Promise<void> {
    await this.db.delete('customContent', id);
  }

  listAudio(): Promise<AudioRecord[]> {
    return this.db.getAll('audio');
  }

  listAudioIds(): Promise<string[]> {
    return this.db.getAllKeys('audio');
  }

  async putAudio(record: AudioRecord): Promise<void> {
    await this.db.put('audio', record);
  }

  async deleteAudio(clipId: string): Promise<void> {
    await this.db.delete('audio', clipId);
  }

  listSessions(): Promise<SessionSummary[]> {
    return this.db.getAll('sessions');
  }

  async addSession(session: SessionSummary): Promise<void> {
    await this.db.put('sessions', session);
  }

  listErrors(): Promise<ErrorRecord[]> {
    return this.db.getAll('errors');
  }

  async addError(record: ErrorRecord): Promise<void> {
    await this.db.put('errors', record);
  }

  async clearErrors(): Promise<void> {
    await this.db.clear('errors');
  }

  close(): void {
    this.db.close();
  }
}

export async function openStore(name?: string): Promise<AppStore> {
  return new AppStore(await openAppDb(name));
}
