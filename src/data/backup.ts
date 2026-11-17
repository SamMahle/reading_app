import { ALL_STORES, DB_VERSION, SINGLETON_KEYS, type StoreName } from './db';
import type { AppStore } from './store';
import type { AudioRecord } from './types';

/**
 * Backup and restore (spec §10.2). Export writes every store to one versioned
 * JSON file. Import validates the file, then REPLACES existing data. It never
 * merges.
 */

export const BACKUP_APP_ID = 'readingapp';
export const BACKUP_FORMAT_VERSION = 1;

type SerializedAudio = Omit<AudioRecord, 'data'> & { dataBase64: string };

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  formatVersion: number;
  schemaVersion: number;
  exportedAt: string;
  stores: Record<StoreName, unknown[]>;
}

const SINGLETONS = new Set<StoreName>(Object.keys(SINGLETON_KEYS) as StoreName[]);

export function backupFileName(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `readingapp-backup-${y}${m}${d}.json`;
}

function bytesToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function exportBackup(store: AppStore, now: Date = new Date()): Promise<BackupFile> {
  const stores = {} as Record<StoreName, unknown[]>;
  for (const name of ALL_STORES) {
    const rows: unknown[] = await store.db.getAll(name);
    stores[name] =
      name === 'audio'
        ? (rows as AudioRecord[]).map(({ data, ...rest }) => ({
            ...rest,
            dataBase64: bytesToBase64(data),
          }))
        : rows;
  }
  return {
    app: BACKUP_APP_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: DB_VERSION,
    exportedAt: now.toISOString(),
    stores,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString);

/** Per-store row checks: the fields the app relies on must be present and typed. */
const ROW_CHECKS: Record<StoreName, (row: Record<string, unknown>) => boolean> = {
  settings: (r) =>
    isNumber(r.sessionMinutes) && isNumber(r.dailySoloLimit) && isString(r.stripSide),
  unlock: (r) =>
    Array.isArray(r.levels) &&
    r.levels.every(isNumber) &&
    isStringArray(r.extraPatterns) &&
    isStringArray(r.lockedPatterns) &&
    isStringArray(r.heartWords),
  attempts: (r) =>
    isString(r.id) &&
    isNumber(r.ts) &&
    isString(r.itemId) &&
    isString(r.outcome) &&
    isString(r.sessionId),
  leitner: (r) =>
    isString(r.wordId) && isNumber(r.box) && isNumber(r.dueTs) && isStringArray(r.correctDays),
  ladder: (r) => isNumber(r.rung) && Array.isArray(r.history),
  stories: (r) =>
    isString(r.id) && isString(r.type) && Array.isArray(r.reads) && r.reads.every(isNumber),
  customContent: (r) => isString(r.id) && isString(r.text) && Array.isArray(r.graphemes),
  audio: (r) => isString(r.clipId) && isString(r.mime) && isString(r.dataBase64) && isNumber(r.ts),
  sessions: (r) => isString(r.id) && isNumber(r.ts) && isString(r.mode) && isNumber(r.accuracy),
  errors: (r) => isString(r.id) && isNumber(r.ts) && isString(r.message),
};

/** Returns a list of problems. An empty list means the file is safe to import. */
export function validateBackup(value: unknown): string[] {
  if (!isRecord(value)) return ['The file is not a Reading App backup.'];
  const problems: string[] = [];
  if (value.app !== BACKUP_APP_ID) problems.push('The file is not a Reading App backup.');
  if (value.formatVersion !== BACKUP_FORMAT_VERSION)
    problems.push(`Unsupported backup format version: ${String(value.formatVersion)}.`);
  if (!isNumber(value.schemaVersion) || value.schemaVersion > DB_VERSION) {
    problems.push(
      'The backup comes from a newer version of the app. Update the app, then import again.',
    );
  }
  if (!isRecord(value.stores)) return [...problems, 'The backup has no data stores.'];
  for (const name of ALL_STORES) {
    const rows = value.stores[name];
    // The errors store was added in schema v2; older backups do not have it.
    if (rows === undefined && name === 'errors') continue;
    if (!Array.isArray(rows)) {
      problems.push(`Store "${name}" is missing.`);
      continue;
    }
    if (SINGLETONS.has(name) && rows.length > 1)
      problems.push(`Store "${name}" has more than one record.`);
    const bad = rows.findIndex((row) => !isRecord(row) || !ROW_CHECKS[name](row));
    if (bad !== -1) problems.push(`Store "${name}" has an invalid record at position ${bad + 1}.`);
  }
  return problems;
}

/** Replace all data with the backup's contents, in one transaction. */
export async function importBackup(store: AppStore, value: unknown): Promise<void> {
  const problems = validateBackup(value);
  if (problems.length > 0) throw new Error(problems.join(' '));
  const backup = value as BackupFile;
  const tx = store.db.transaction([...ALL_STORES], 'readwrite');
  const work: Promise<unknown>[] = [];
  for (const name of ALL_STORES) {
    const target = tx.objectStore(name);
    work.push(target.clear());
    for (const row of backup.stores[name] ?? []) {
      if (name === 'audio') {
        const { dataBase64, ...rest } = row as SerializedAudio;
        work.push(tx.objectStore('audio').put({ ...rest, data: base64ToBytes(dataBase64) }));
      } else if (name === 'settings' || name === 'unlock' || name === 'ladder') {
        // Singleton stores use a fixed out-of-line key.
        work.push(
          (target as unknown as { put(value: unknown, key: string): Promise<unknown> }).put(
            row,
            SINGLETON_KEYS[name],
          ),
        );
      } else {
        work.push((target as unknown as { put(value: unknown): Promise<unknown> }).put(row));
      }
    }
  }
  await Promise.all([...work, tx.done]);
}
