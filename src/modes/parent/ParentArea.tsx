import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '@/app/AppData';
import { matchRoute, navigate } from '@/app/router';
import { useUpdateReady } from '@/app/update';
import { createPin, isValidPin, verifyPin } from '@/data/pin';
import { LevelsPanel } from './LevelsPanel';
import { PassagePanel } from './PassagePanel';
import { ReportsPanel } from './ReportsPanel';
import { AboutPanel, BackupPanel, SettingsPanel } from './SettingsPanels';
import { SoundStudio } from './SoundStudio';
import { HeartWordsPanel, LexiconPanel } from './WordPanels';
import './parent.css';

const AUTO_LOCK_MS = 5 * 60 * 1000;

const SECTIONS: { id: string; label: string; render: () => ReactNode }[] = [
  { id: 'reports', label: 'Reports', render: () => <ReportsPanel /> },
  { id: 'levels', label: 'Levels', render: () => <LevelsPanel /> },
  { id: 'heart', label: 'Heart words', render: () => <HeartWordsPanel /> },
  { id: 'words', label: 'Word list', render: () => <LexiconPanel /> },
  { id: 'passage', label: 'Class passage', render: () => <PassagePanel /> },
  { id: 'studio', label: 'Sound Studio', render: () => <SoundStudio /> },
  { id: 'settings', label: 'Settings', render: () => <SettingsPanel /> },
  { id: 'backup', label: 'Backup', render: () => <BackupPanel /> },
  { id: 'about', label: 'About', render: () => <AboutPanel /> },
];

function PinPad({
  title,
  note,
  error,
  onSubmit,
}: {
  title: string;
  note: string;
  error: string | null;
  onSubmit: (pin: string) => void;
}) {
  const [pin, setPin] = useState('');
  const press = (digit: string) => {
    const next = `${pin}${digit}`.slice(0, 4);
    setPin(next);
    if (isValidPin(next)) {
      onSubmit(next);
      setPin('');
    }
  };
  return (
    <main className="screen pin-screen" data-testid="pin-screen">
      <div className="screen__body">
        <h1>{title}</h1>
        <p className="pin-note">{note}</p>
        <div className="pin-dots" aria-label={`${pin.length} of 4 digits entered`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i < pin.length ? 'pin-dot pin-dot--on' : 'pin-dot'} />
          ))}
        </div>
        <p className="form-error pin-error" role="alert">
          {error ?? ' '}
        </p>
        <div className="pin-pad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              className="pin-key"
              data-digit={digit}
              onClick={() => press(digit)}
            >
              {digit}
            </button>
          ))}
          <button type="button" className="pin-key pin-key--quiet" onClick={() => navigate('/')}>
            Back
          </button>
          <button type="button" className="pin-key" data-digit="0" onClick={() => press('0')}>
            0
          </button>
          <button
            type="button"
            className="pin-key pin-key--quiet"
            onClick={() => setPin(pin.slice(0, -1))}
          >
            Delete
          </button>
        </div>
      </div>
    </main>
  );
}

/**
 * PIN gate (spec §10.1). The PIN is set on first run and stored only as a
 * salted hash. The panel locks again after 5 minutes without input, or as
 * soon as the app goes to the background.
 */
function useParentLock() {
  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => {
    if (!unlocked) return undefined;
    let timer = window.setTimeout(() => setUnlocked(false), AUTO_LOCK_MS);
    const touch = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setUnlocked(false), AUTO_LOCK_MS);
    };
    const onVisibility = () => {
      if (document.hidden) setUnlocked(false);
    };
    window.addEventListener('pointerdown', touch);
    window.addEventListener('keydown', touch);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', touch);
      window.removeEventListener('keydown', touch);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [unlocked]);
  return { unlocked, unlock: () => setUnlocked(true), lock: () => setUnlocked(false) };
}

export function ParentArea({ path }: { path: string }) {
  const app = useApp();
  const lock = useParentLock();
  const updateReady = useUpdateReady();
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasPin = !!app.settings.pinHash;

  if (!lock.unlocked) {
    if (!hasPin) {
      return (
        <PinPad
          key={firstPin === null ? 'new' : 'confirm'}
          title={firstPin === null ? 'Choose a parent PIN' : 'Enter the PIN again'}
          note="Four digits. It keeps the settings out of small hands. Write it down: there is no reset without it."
          error={error}
          onSubmit={(pin) => {
            if (firstPin === null) {
              setFirstPin(pin);
              setError(null);
            } else if (pin === firstPin) {
              void createPin(pin)
                .then((stored) => app.saveSettings(stored))
                .then(lock.unlock);
              setFirstPin(null);
            } else {
              setFirstPin(null);
              setError('Those did not match. Start again.');
            }
          }}
        />
      );
    }
    return (
      <PinPad
        title="Parent area"
        note="Enter your PIN."
        error={error}
        onSubmit={(pin) => {
          void verifyPin(pin, app.settings).then((ok) => {
            if (ok) {
              setError(null);
              lock.unlock();
            } else {
              setError('That PIN is not right. Try again.');
            }
          });
        }}
      />
    );
  }

  const sectionId = matchRoute('/parent/:section', path)?.section ?? 'reports';
  const section = SECTIONS.find((s) => s.id === sectionId) ?? SECTIONS[0];

  return (
    <div className="parent" data-testid="parent-panel">
      <nav className="parent__nav" aria-label="Parent area">
        <p className="parent__title">Parent area</p>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`parent__link${s.id === section?.id ? ' parent__link--on' : ''}`}
            aria-current={s.id === section?.id ? 'page' : undefined}
            data-section={s.id}
            onClick={() => navigate(`/parent/${s.id}`)}
          >
            {s.label}
            {s.id === 'about' && updateReady && <span className="parent__dot" />}
          </button>
        ))}
        <button
          type="button"
          className="button parent__exit"
          data-testid="parent-exit"
          onClick={() => {
            lock.lock();
            navigate('/');
          }}
        >
          Lock and close
        </button>
      </nav>
      <div className="parent__content">{section?.render()}</div>
    </div>
  );
}
