import { useEffect, useRef, useState } from 'react';
import { APP_CONFIG } from '../../../app.config';
import { useApp } from '@/app/AppData';
import { applyAppUpdate, useOfflineReady, useUpdateReady } from '@/app/update';
import {
  backupFileName,
  exportBackup,
  previewRecordings,
  validateBackup,
  validateRecordingsSource,
  type RecordingsSummary,
} from '@/data/backup';
import { createPin, isValidPin, verifyPin } from '@/data/pin';
import type { ErrorRecord } from '@/data/types';
import { DAY_MS } from '@/engine/dates';
import { overrideRung } from '@/engine/ladder';
import type { Rung } from '@/engine/types';
import { RUNG_LABELS } from '@/modes/coach/CoachHome';

const BACKUP_REMINDER_DAYS = 30;

function Switch({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`switch${on ? ' switch--on' : ''}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
    >
      <span />
    </button>
  );
}

/** Session settings, the ladder override and the PIN (spec §10.2). */
export function SettingsPanel() {
  const app = useApp();
  const { settings } = app;
  const [rung, setRung] = useState<Rung>(app.ladder.rung);
  const [pin, setPin] = useState({ current: '', next: '' });
  const [pinMessage, setPinMessage] = useState<string | null>(null);

  const changePin = async () => {
    if (!(await verifyPin(pin.current, settings))) {
      setPinMessage('The current PIN is not right.');
      return;
    }
    if (!isValidPin(pin.next)) {
      setPinMessage('The new PIN must be 4 digits.');
      return;
    }
    await app.saveSettings(await createPin(pin.next));
    setPin({ current: '', next: '' });
    setPinMessage('PIN changed.');
  };

  return (
    <div className="panel" data-testid="settings-panel">
      <h1>Settings</h1>

      <section className="panel__section">
        <h2>Solo sessions</h2>
        <div className="setting">
          <div>
            <strong>Session length</strong>
            <p>
              When time is up she finishes the item she is on, then ends on one she has mastered.
            </p>
          </div>
          <div className="segmented" role="group" aria-label="Session length">
            {([4, 6, 8] as const).map((minutes) => (
              <button
                key={minutes}
                type="button"
                className={settings.sessionMinutes === minutes ? 'segmented--on' : ''}
                aria-pressed={settings.sessionMinutes === minutes}
                data-minutes={minutes}
                onClick={() => void app.saveSettings({ sessionMinutes: minutes })}
              >
                {minutes} min
              </button>
            ))}
          </div>
        </div>
        <div className="setting">
          <div>
            <strong>Solo sessions per day</strong>
            <p>
              After this many she sees a calm “see you tomorrow” screen. Her bookshelf stays open.
            </p>
          </div>
          <div className="segmented" role="group" aria-label="Daily limit">
            {[1, 2, 3, 4].map((limit) => (
              <button
                key={limit}
                type="button"
                className={settings.dailySoloLimit === limit ? 'segmented--on' : ''}
                aria-pressed={settings.dailySoloLimit === limit}
                onClick={() => void app.saveSettings({ dailySoloLimit: limit })}
              >
                {limit}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel__section">
        <h2>Coach mode</h2>
        <div className="setting">
          <div>
            <strong>Scoring strip side</strong>
            <p>Put it on the side where you sit.</p>
          </div>
          <div className="segmented" role="group" aria-label="Strip side">
            {(['left', 'right'] as const).map((side) => (
              <button
                key={side}
                type="button"
                className={settings.stripSide === side ? 'segmented--on' : ''}
                aria-pressed={settings.stripSide === side}
                onClick={() => void app.saveSettings({ stripSide: side })}
              >
                {side === 'left' ? 'Left' : 'Right'}
              </button>
            ))}
          </div>
        </div>
        <div className="setting">
          <div>
            <strong>Text-load step</strong>
            <p>
              The app moves this for you from her Coach results. A manual change is logged in the
              ladder report.
            </p>
          </div>
          <div className="form-row">
            <select
              value={rung}
              aria-label="Text-load step"
              onChange={(event) => setRung(Number(event.target.value) as Rung)}
            >
              {([1, 2, 3, 4, 5] as const).map((value) => (
                <option key={value} value={value}>
                  Step {value}: {RUNG_LABELS[value]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="button"
              disabled={rung === app.ladder.rung}
              data-testid="apply-rung"
              onClick={() => void app.saveLadder(overrideRung(app.ladder, rung, Date.now()))}
            >
              Set step
            </button>
          </div>
        </div>
      </section>

      <section className="panel__section">
        <h2>Sound</h2>
        <div className="setting">
          <div>
            <strong>Use the iPad’s voice until you have recorded</strong>
            <p>
              Speaks whole words and directions that have no recording yet. It is never used for
              single letter sounds, which must be your own recordings.
            </p>
          </div>
          <Switch
            on={settings.deviceVoice}
            label="Device voice"
            onToggle={() => void app.saveSettings({ deviceVoice: !settings.deviceVoice })}
          />
        </div>
        <div className="setting">
          <div>
            <strong>Quiet mode</strong>
            <p>
              No sound at all. Listening items (sound matching, word building) are skipped and noted
              in the session log.
            </p>
          </div>
          <Switch
            on={settings.quietMode}
            label="Quiet mode"
            onToggle={() => void app.saveSettings({ quietMode: !settings.quietMode })}
          />
        </div>
      </section>

      <section className="panel__section">
        <h2>Change PIN</h2>
        <div className="form-row">
          <label className="field">
            <span>Current PIN</span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin.current}
              onChange={(event) => setPin({ ...pin, current: event.target.value })}
            />
          </label>
          <label className="field">
            <span>New PIN</span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin.next}
              onChange={(event) => setPin({ ...pin, next: event.target.value })}
            />
          </label>
          <button type="button" className="button" onClick={() => void changePin()}>
            Change PIN
          </button>
        </div>
        {pinMessage && <p className="panel__note">{pinMessage}</p>}
      </section>
    </div>
  );
}

/** Backup, restore and storage status (spec §10.2, §11). */
export function BackupPanel() {
  const app = useApp();
  const [pending, setPending] = useState<unknown>(null);
  const [pendingRecordings, setPendingRecordings] = useState<{
    data: unknown;
    summary: RecordingsSummary;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const recordingsInput = useRef<HTMLInputElement>(null);
  const last = app.settings.lastBackupTs;
  const overdue = last === undefined || Date.now() - last > BACKUP_REMINDER_DAYS * DAY_MS;

  const exportNow = async () => {
    if (!app.store) return;
    const now = new Date();
    await app.saveSettings({ lastBackupTs: now.getTime() });
    const backup = await exportBackup(app.store, now);
    const file = new File([JSON.stringify(backup)], backupFileName(now), {
      type: 'application/json',
    });
    // The share sheet is the reliable way to save a file from a home-screen app on iPadOS.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        setMessage('Backup created.');
        return;
      } catch {
        // Sharing was cancelled: fall back to a download.
      }
    }
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);
    setMessage(`Backup saved as ${file.name}.`);
  };

  const chooseFile = async (file: File | undefined) => {
    setMessage(null);
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const problems = validateBackup(parsed);
      if (problems.length > 0) {
        setMessage(problems.join(' '));
        return;
      }
      setPending(parsed);
    } catch {
      setMessage('That file could not be read. Choose a readingapp-backup file.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const chooseRecordingsFile = async (file: File | undefined) => {
    setMessage(null);
    if (!file || !app.store) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const problems = validateRecordingsSource(parsed);
      if (problems.length > 0) {
        setMessage(problems.join(' '));
        return;
      }
      setPendingRecordings({ data: parsed, summary: await previewRecordings(app.store, parsed) });
    } catch {
      setMessage('That file could not be read. Choose a readingapp-backup file.');
    } finally {
      if (recordingsInput.current) recordingsInput.current.value = '';
    }
  };

  return (
    <div className="panel" data-testid="backup-panel">
      <h1>Backup</h1>
      <p className="panel__lead">
        Everything lives on this iPad only. A backup file is the one way to move it or to recover
        it.
      </p>

      <section className="panel__section">
        <p data-testid="last-backup" className={overdue ? 'form-error' : 'panel__note'}>
          {last === undefined
            ? 'No backup has been made yet.'
            : `Last backup: ${new Date(last).toLocaleDateString()}.`}
          {overdue && ' It is a good time to make one.'}
        </p>
        <p className="panel__note" data-testid="persist-status">
          Storage protection:{' '}
          {app.settings.persistGranted
            ? 'on. iPadOS will not clear this app’s data to free up space.'
            : 'not granted. Keep the app on the home screen and back up regularly.'}
        </p>
        <div className="form-row">
          <button
            type="button"
            className="button button--primary"
            onClick={() => void exportNow()}
            data-testid="export-backup"
          >
            Export backup
          </button>
          <label className="button">
            Import backup
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="visually-hidden"
              data-testid="import-file"
              onChange={(event) => void chooseFile(event.target.files?.[0])}
            />
          </label>
        </div>
      </section>

      <section className="panel__section">
        <h2>Copy recordings from another device</h2>
        <p className="panel__note">
          Record on one device, export a backup there, then import just its recordings here. Her
          progress, settings and words on this device are not changed. A recording with the same
          name is replaced by the one in the file.
        </p>
        <div className="form-row">
          <label className="button">
            Import recordings only
            <input
              ref={recordingsInput}
              type="file"
              accept="application/json,.json"
              className="visually-hidden"
              data-testid="import-recordings-file"
              onChange={(event) => void chooseRecordingsFile(event.target.files?.[0])}
            />
          </label>
        </div>
      </section>

      {message && (
        <p className="panel__note panel__status" role="status" data-testid="backup-message">
          {message}
        </p>
      )}

      {pendingRecordings !== null && (
        <div
          className="dialog-backdrop"
          role="dialog"
          aria-modal="true"
          data-testid="import-recordings-confirm"
        >
          <div className="dialog">
            <h2>Copy {pendingRecordings.summary.total} recordings?</h2>
            <ul className="dialog__list">
              <li>{pendingRecordings.summary.added} new on this device</li>
              <li>{pendingRecordings.summary.replaced} replacing a recording already here</li>
            </ul>
            <p>Nothing else changes: her progress, settings and words stay as they are.</p>
            <div className="dialog__actions">
              <button type="button" className="button" onClick={() => setPendingRecordings(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="button button--primary"
                data-testid="import-recordings-apply"
                onClick={() => {
                  const { data } = pendingRecordings;
                  setPendingRecordings(null);
                  void app
                    .importRecordings(data)
                    .then((summary) =>
                      setMessage(
                        `Copied ${summary.total} recordings (${summary.added} new, ${summary.replaced} replaced).`,
                      ),
                    )
                    .catch(() =>
                      setMessage('The recordings could not be copied. Nothing was changed.'),
                    );
                }}
              >
                Copy recordings
              </button>
            </div>
          </div>
        </div>
      )}

      {pending !== null && (
        <div
          className="dialog-backdrop"
          role="dialog"
          aria-modal="true"
          data-testid="import-confirm"
        >
          <div className="dialog">
            <h2>Replace everything on this iPad?</h2>
            <p>
              Importing replaces all progress, settings, added words and recordings with the
              contents of the backup. Nothing is merged.
            </p>
            <div className="dialog__actions">
              <button type="button" className="button" onClick={() => setPending(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="button button--danger"
                data-testid="import-apply"
                onClick={() => {
                  void app
                    .restoreBackup(pending)
                    .then(() => setMessage('Backup imported.'))
                    .catch(() => setMessage('The import failed. Nothing was changed.'));
                  setPending(null);
                }}
              >
                Replace and import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** About (spec §10.2): version, licenses, privacy, and the local error log. */
export function AboutPanel() {
  const app = useApp();
  const updateReady = useUpdateReady();
  const offlineReady = useOfflineReady();
  const [errors, setErrors] = useState<ErrorRecord[]>([]);

  useEffect(() => {
    void app.store?.listErrors().then((rows) => setErrors(rows.sort((a, b) => b.ts - a.ts)));
  }, [app.store]);

  return (
    <div className="panel" data-testid="about-panel">
      <h1>About</h1>
      <section className="panel__section">
        <p>
          <strong>{APP_CONFIG.name}</strong> version {APP_CONFIG.version}
        </p>
        {updateReady ? (
          <p>
            A new version is ready.{' '}
            <button type="button" className="button button--primary" onClick={applyAppUpdate}>
              Update now
            </button>
          </p>
        ) : (
          <p className="panel__note">
            {offlineReady ? 'Ready to work offline.' : 'This is the latest version on this iPad.'}
          </p>
        )}
      </section>

      <section className="panel__section">
        <h2>Privacy</h2>
        <p>
          All data stays on this device. The app makes no network calls while it runs and has no
          accounts, analytics or third-party scripts. A backup file leaves the device only when you
          export it.
        </p>
      </section>

      <section className="panel__section">
        <h2>Licenses</h2>
        <ul className="plain-list">
          <li>
            <strong>Andika</strong> typeface © SIL International, SIL Open Font License 1.1. The
            license text ships with the app at <code>fonts/andika/OFL.txt</code>.
          </li>
          <li>
            <strong>OpenMoji</strong> pictures, designed by OpenMoji, the open-source emoji and icon
            project. License: CC BY-SA 4.0 (
            <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="noreferrer">
              creativecommons.org/licenses/by-sa/4.0
            </a>
            ). Source: openmoji.org.
          </li>
          <li>The pictures for mat, pod, dot, lid and mop were drawn for this app.</li>
        </ul>
      </section>

      <section className="panel__section">
        <h2>Error log</h2>
        {errors.length === 0 ? (
          <p className="panel__note">No errors recorded.</p>
        ) : (
          <>
            <ul className="plain-list" data-testid="error-log">
              {errors.slice(0, 20).map((error) => (
                <li key={error.id}>
                  <strong>{new Date(error.ts).toLocaleString()}</strong> ({error.mode}):{' '}
                  {error.message}
                  {error.stack && (
                    <details>
                      <summary>Details</summary>
                      <pre>{error.stack}</pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="button"
              onClick={() => {
                void app.store?.clearErrors();
                setErrors([]);
              }}
            >
              Clear the log
            </button>
          </>
        )}
      </section>
    </div>
  );
}
