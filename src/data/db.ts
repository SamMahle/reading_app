import {
  openDB,
  type DBSchema,
  type IDBPDatabase,
  type IDBPTransaction,
  type StoreNames,
} from 'idb';
import type {
  AnyEntry,
  Attempt,
  LadderState,
  LeitnerCard,
  SessionSummary,
  UnlockState,
} from '@/engine/types';
import type { AudioRecord, ErrorRecord, Settings, StoryRecord } from './types';

/** IndexedDB schema (spec §11). Every version bump adds a migration below. */

export const DB_NAME = 'readingapp';
export const DB_VERSION = 2;

export interface ReadingAppSchema extends DBSchema {
  settings: { key: string; value: Settings };
  unlock: { key: string; value: UnlockState };
  attempts: {
    key: string;
    value: Attempt;
    indexes: { ts: number; itemId: string; sessionId: string };
  };
  leitner: { key: string; value: LeitnerCard };
  ladder: { key: string; value: LadderState };
  stories: { key: string; value: StoryRecord };
  customContent: { key: string; value: AnyEntry };
  audio: { key: string; value: AudioRecord };
  sessions: { key: string; value: SessionSummary };
  errors: { key: string; value: ErrorRecord };
}

export type StoreName = StoreNames<ReadingAppSchema>;
export type AppDb = IDBPDatabase<ReadingAppSchema>;

type UpgradeTx = IDBPTransaction<ReadingAppSchema, StoreName[], 'versionchange'>;
type Migration = (db: AppDb, tx: UpgradeTx) => void;

/** Migration N upgrades a database from version N-1 to version N. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  1: (db) => {
    db.createObjectStore('settings');
    db.createObjectStore('unlock');
    const attempts = db.createObjectStore('attempts', { keyPath: 'id' });
    attempts.createIndex('ts', 'ts');
    attempts.createIndex('itemId', 'itemId');
    attempts.createIndex('sessionId', 'sessionId');
    db.createObjectStore('leitner', { keyPath: 'wordId' });
    db.createObjectStore('ladder');
    db.createObjectStore('stories', { keyPath: 'id' });
    db.createObjectStore('customContent', { keyPath: 'id' });
    db.createObjectStore('audio', { keyPath: 'clipId' });
    db.createObjectStore('sessions', { keyPath: 'id' });
  },
  // v2: local error log for the per-mode error boundaries (spec §13).
  2: (db) => {
    db.createObjectStore('errors', { keyPath: 'id' });
  },
};

export function runMigrations(
  db: AppDb,
  oldVersion: number,
  newVersion: number,
  tx: UpgradeTx,
): void {
  for (let version = oldVersion + 1; version <= newVersion; version += 1) {
    const migrate = MIGRATIONS[version];
    if (!migrate) throw new Error(`Missing migration for database version ${version}`);
    migrate(db, tx);
  }
}

export function openAppDb(name: string = DB_NAME, version: number = DB_VERSION): Promise<AppDb> {
  return openDB<ReadingAppSchema>(name, version, {
    upgrade(db, oldVersion, newVersion, tx) {
      runMigrations(db, oldVersion, newVersion ?? version, tx);
    },
  });
}

/** Stores that hold a single document under a fixed key. */
export const SINGLETON_KEYS = { settings: 'settings', unlock: 'unlock', ladder: 'ladder' } as const;

export const ALL_STORES: readonly StoreName[] = [
  'settings',
  'unlock',
  'attempts',
  'leitner',
  'ladder',
  'stories',
  'customContent',
  'audio',
  'sessions',
  'errors',
];
