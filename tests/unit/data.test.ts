import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  backupFileName,
  exportBackup,
  importBackup,
  importRecordings,
  previewRecordings,
  validateBackup,
  validateRecordingsSource,
} from '@/data/backup';
import {
  ALL_STORES,
  DB_VERSION,
  MIGRATIONS,
  openAppDb,
  runMigrations,
  type AppDb,
} from '@/data/db';
import { createPin, hashPin, isValidPin, verifyPin } from '@/data/pin';
import { AppStore, openStore } from '@/data/store';
import { DEFAULT_SETTINGS } from '@/data/types';
import { initialLadder } from '@/engine/ladder';
import { newCard } from '@/engine/scheduler';
import { attempt, defaultUnlock, LEX, T0 } from './helpers';

let dbCount = 0;
const freshName = () => `test-db-${(dbCount += 1)}`;

async function seed(store: AppStore): Promise<void> {
  const pin = await createPin('4821');
  await store.saveSettings({ ...DEFAULT_SETTINGS, ...pin, sessionMinutes: 8, lastBackupTs: T0 });
  await store.saveUnlock({ ...defaultUnlock(), levels: [1, 2, 3, 4] });
  await store.addAttempts([
    attempt({ itemId: 'cat', outcome: 'correct', ts: T0 + 2 }),
    attempt({ itemId: 'dog', outcome: 'modeled', ts: T0 + 1 }),
  ]);
  await store.putCards([newCard('cat', T0), { ...newCard('dog', T0), box: 3 }]);
  await store.saveLadder(initialLadder(T0));
  await store.putStoryRecord({ id: 'big_pig', type: 'story', reads: [T0], shelvedTs: T0 });
  const and = LEX.words.get('and');
  if (and)
    await store.putCustom({
      id: 'and',
      text: 'and',
      graphemes: and.graphemes,
      irregularIdx: [],
      unlockLevel: 1,
      audioWord: 'wd_and',
      isHeartWord: true,
    });
  await store.putAudio({
    clipId: 'snd_m',
    mime: 'audio/wav',
    data: new Uint8Array([1, 2, 3, 250, 255]).buffer,
    ts: T0,
  });
  await store.addSession({
    id: 's1',
    ts: T0,
    mode: 'solo',
    durationMs: 1000,
    items: 2,
    accuracy: 0.5,
    helpOpened: 1,
    helpCompleted: 1,
    notes: [],
  });
  await store.addError({ id: 'e1', ts: T0, mode: 'solo', message: 'boom' });
}

describe('IndexedDB layer (spec §11)', () => {
  let store: AppStore;
  beforeEach(async () => {
    store = await openStore(freshName());
  });

  it('creates every store at the current version', () => {
    expect(store.db.version).toBe(DB_VERSION);
    expect([...store.db.objectStoreNames].sort()).toEqual([...ALL_STORES].sort());
    expect(Object.keys(MIGRATIONS).map(Number)).toEqual(
      Array.from({ length: DB_VERSION }, (_, i) => i + 1),
    );
  });

  it('returns defaults before anything is saved', async () => {
    expect(await store.getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(await store.getUnlock()).toBeUndefined();
    expect(await store.getLadder()).toBeUndefined();
    expect(await store.listAttempts()).toEqual([]);
  });

  it('round-trips every record type', async () => {
    await seed(store);
    expect((await store.getSettings()).sessionMinutes).toBe(8);
    expect((await store.getUnlock())?.levels).toEqual([1, 2, 3, 4]);
    expect((await store.listAttempts()).map((a) => a.itemId)).toEqual(['dog', 'cat']); // ordered by time
    expect((await store.listCards()).map((c) => c.wordId).sort()).toEqual(['cat', 'dog']);
    expect((await store.getLadder())?.rung).toBe(2);
    expect(await store.listStoryRecords()).toHaveLength(1);
    expect((await store.listCustom())[0]?.id).toBe('and');
    expect(await store.listAudioIds()).toEqual(['snd_m']);
    expect([...new Uint8Array((await store.listAudio())[0]?.data ?? new ArrayBuffer(0))]).toEqual([
      1, 2, 3, 250, 255,
    ]);
    expect(await store.listSessions()).toHaveLength(1);
    expect(await store.listErrors()).toHaveLength(1);

    await store.deleteStoryRecord('big_pig');
    await store.deleteCustom('and');
    await store.deleteAudio('snd_m');
    await store.clearErrors();
    expect(await store.listStoryRecords()).toEqual([]);
    expect(await store.listCustom()).toEqual([]);
    expect(await store.listAudio()).toEqual([]);
    expect(await store.listErrors()).toEqual([]);
  });

  it('keeps data across a close and reopen', async () => {
    const name = freshName();
    const first = await openStore(name);
    await seed(first);
    first.close();
    const second = await openStore(name);
    expect(await second.listAttempts()).toHaveLength(2);
    expect((await second.getSettings()).sessionMinutes).toBe(8);
  });

  it('migrates a version 1 database to the current version without losing data', async () => {
    const name = freshName();
    const v1 = await openDB(name, 1, {
      upgrade(db, oldVersion, newVersion, tx) {
        runMigrations(db as unknown as AppDb, oldVersion, newVersion ?? 1, tx as never);
      },
    });
    expect([...v1.objectStoreNames]).not.toContain('errors');
    await v1.put('leitner', newCard('cat', T0));
    v1.close();

    const upgraded = new AppStore(await openAppDb(name));
    expect([...upgraded.db.objectStoreNames]).toContain('errors');
    expect(await upgraded.listCards()).toEqual([newCard('cat', T0)]);
    await upgraded.addError({ id: 'e', ts: T0, mode: 'coach', message: 'x' });
  });

  it('refuses to upgrade to a version with no migration', () => {
    expect(() => runMigrations({} as AppDb, DB_VERSION, DB_VERSION + 1, {} as never)).toThrow(
      `Missing migration for database version ${DB_VERSION + 1}`,
    );
  });
});

describe('backup (spec §10.2)', () => {
  it('names the file readingapp-backup-YYYYMMDD.json', () => {
    expect(backupFileName(new Date(2026, 0, 5))).toBe('readingapp-backup-20260105.json');
  });

  it('restores all stores exactly on a clean install', async () => {
    const source = await openStore(freshName());
    await seed(source);
    const backup = await exportBackup(source, new Date(T0));
    const json: unknown = JSON.parse(JSON.stringify(backup));
    expect(validateBackup(json)).toEqual([]);

    const target = await openStore(freshName());
    await importBackup(target, json);
    const restored = await exportBackup(target, new Date(T0));
    expect(restored).toEqual(backup);
    expect(await target.getSettings()).toEqual(await source.getSettings());
    expect([...new Uint8Array((await target.listAudio())[0]?.data ?? new ArrayBuffer(0))]).toEqual([
      1, 2, 3, 250, 255,
    ]);
  });

  it('replaces existing data instead of merging', async () => {
    const source = await openStore(freshName());
    await seed(source);
    const backup = JSON.parse(JSON.stringify(await exportBackup(source))) as unknown;

    const target = await openStore(freshName());
    await target.putCards([newCard('zip', T0)]);
    await target.addAttempts([attempt({ itemId: 'zip', outcome: 'correct' })]);
    await importBackup(target, backup);
    expect((await target.listCards()).map((c) => c.wordId).sort()).toEqual(['cat', 'dog']);
    expect((await target.listAttempts()).map((a) => a.itemId)).not.toContain('zip');
  });

  it('rejects files that are not valid backups and leaves data untouched', async () => {
    const store = await openStore(freshName());
    await seed(store);
    const good = JSON.parse(JSON.stringify(await exportBackup(store))) as Record<
      string,
      unknown
    > & { stores: Record<string, unknown[]> };

    expect(validateBackup(null)).toHaveLength(1);
    expect(validateBackup({ app: 'other', formatVersion: 1, schemaVersion: 1 })).toContain(
      'The backup has no data stores.',
    );
    expect(validateBackup({ ...good, formatVersion: 9 })[0]).toContain('Unsupported backup format');
    expect(validateBackup({ ...good, schemaVersion: DB_VERSION + 1 })[0]).toContain(
      'newer version',
    );
    expect(validateBackup({ ...good, stores: { ...good.stores, attempts: undefined } })).toContain(
      'Store "attempts" is missing.',
    );
    expect(
      validateBackup({ ...good, stores: { ...good.stores, settings: [{}, {}] } })[0],
    ).toContain('more than one record');
    expect(
      validateBackup({ ...good, stores: { ...good.stores, leitner: [{ wordId: 'cat' }] } }),
    ).toContain('Store "leitner" has an invalid record at position 1.');
    // A v1 backup has no errors store and is still accepted.
    const v1Stores = Object.fromEntries(
      Object.entries(good.stores).filter(([name]) => name !== 'errors'),
    );
    expect(validateBackup({ ...good, schemaVersion: 1, stores: v1Stores })).toEqual([]);

    await expect(importBackup(store, { ...good, formatVersion: 9 })).rejects.toThrow('Unsupported');
    expect(await store.listAttempts()).toHaveLength(2);
  });
});

describe('import recordings only', () => {
  const bytes = async (store: AppStore, clipId: string) => {
    const record = (await store.listAudio()).find((r) => r.clipId === clipId);
    return record ? [...new Uint8Array(record.data)] : undefined;
  };

  it('copies recordings and leaves progress, settings and words untouched', async () => {
    // The phone: two good recordings.
    const phone = await openStore(freshName());
    await phone.putAudio({
      clipId: 'snd_m',
      mime: 'audio/wav',
      data: Uint8Array.of(9, 9).buffer,
      ts: T0,
    });
    await phone.putAudio({
      clipId: 'snd_s',
      mime: 'audio/wav',
      data: Uint8Array.of(7).buffer,
      ts: T0,
    });
    await phone.saveSettings({ ...DEFAULT_SETTINGS, sessionMinutes: 4 });
    const backup = JSON.parse(JSON.stringify(await exportBackup(phone))) as unknown;

    // Her iPad: real progress and an older recording of /m/.
    const ipad = await openStore(freshName());
    await seed(ipad);
    const before = await exportBackup(ipad, new Date(T0));
    expect(validateRecordingsSource(backup)).toEqual([]);
    expect(await previewRecordings(ipad, backup)).toEqual({ total: 2, added: 1, replaced: 1 });

    expect(await importRecordings(ipad, backup)).toEqual({ total: 2, added: 1, replaced: 1 });
    expect(await bytes(ipad, 'snd_m')).toEqual([9, 9]); // replaced by the phone's take
    expect(await bytes(ipad, 'snd_s')).toEqual([7]); // added

    // Everything except the audio store is exactly as it was.
    const after = await exportBackup(ipad, new Date(T0));
    const { audio: _beforeAudio, ...beforeRest } = before.stores;
    const { audio: _afterAudio, ...afterRest } = after.stores;
    void _beforeAudio;
    void _afterAudio;
    expect(afterRest).toEqual(beforeRest);
    expect((await ipad.getSettings()).sessionMinutes).toBe(8); // not the phone's 4
  });

  it('refuses files that are not usable and changes nothing', async () => {
    const ipad = await openStore(freshName());
    await seed(ipad);
    const empty = JSON.parse(JSON.stringify(await exportBackup(await openStore(freshName())))) as {
      stores: Record<string, unknown>;
    };
    expect(validateRecordingsSource(null)).toEqual(['The file is not a Reading App backup.']);
    expect(validateRecordingsSource(empty)).toContain('The backup has no recordings in it.');
    expect(validateRecordingsSource({ ...empty, stores: {} })).toContain(
      'The backup has no recordings.',
    );
    expect(validateRecordingsSource({ ...empty, stores: { audio: [{ clipId: 'x' }] } })).toContain(
      'Recording 1 in the file is damaged.',
    );
    expect(validateRecordingsSource({ ...empty, app: 'other' })[0]).toContain(
      'not a Reading App backup',
    );
    await expect(importRecordings(ipad, empty)).rejects.toThrow('no recordings');
    expect(await ipad.listAudioIds()).toEqual(['snd_m']);
  });
});

describe('parent PIN (spec §10.1)', () => {
  it('accepts exactly 4 digits', () => {
    expect(isValidPin('0420')).toBe(true);
    for (const bad of ['', '123', '12345', '12a4', ' 1234']) expect(isValidPin(bad)).toBe(false);
  });

  it('stores a salted SHA-256 hash, never the PIN', async () => {
    const stored = await createPin('4821');
    expect(stored.pinHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(stored.pinSalt).toMatch(/^[0-9a-f]{32}$/u);
    expect(JSON.stringify(stored)).not.toContain('4821');
    expect((await createPin('4821')).pinHash).not.toBe(stored.pinHash); // new salt each time
    expect(await hashPin('4821', stored.pinSalt)).toBe(stored.pinHash);
  });

  it('verifies only the right PIN', async () => {
    const stored = await createPin('4821');
    expect(await verifyPin('4821', stored)).toBe(true);
    expect(await verifyPin('4822', stored)).toBe(false);
    expect(await verifyPin('4821', {})).toBe(false);
    expect(await verifyPin('abcd', stored)).toBe(false);
    await expect(createPin('12')).rejects.toThrow('4 digits');
  });
});
