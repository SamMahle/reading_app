import { useEffect, useState, type ReactNode } from 'react';
import { audio } from '@/audio/AudioService';
import { CoachHome } from '@/modes/coach/CoachHome';
import { CoachRead } from '@/modes/coach/CoachRead';
import { ParentArea } from '@/modes/parent/ParentArea';
import { SoloSession } from '@/modes/solo/SoloSession';
import { PlayIcon } from '@/ui/icons';
import { AppDataProvider, useApp } from './AppData';
import { ErrorBoundary } from './ErrorBoundary';
import { Home } from './Home';
import { matchRoute, navigate, useRoute } from './router';
import { ShelfPage, ShelfRead } from './ShelfPages';
import './app.css';

function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <main className="screen kid-screen" data-testid="start-gate">
      <div className="screen__body">
        <button
          type="button"
          className="icon-button icon-button--huge icon-button--accent start-gate__button"
          aria-label="Start"
          data-testid="start"
          onClick={() => {
            void audio.unlock().then(onStart);
          }}
        >
          <PlayIcon />
        </button>
      </div>
    </main>
  );
}

function Mode({ name, children }: { name: string; children: ReactNode }) {
  const { logError } = useApp();
  return (
    <ErrorBoundary mode={name} onError={logError} onRestart={() => navigate('/')}>
      {children}
    </ErrorBoundary>
  );
}

function Routes() {
  const app = useApp();
  const path = useRoute();
  /**
   * iOS only allows audio after a user gesture, so every launch begins with
   * one large Start button that also unlocks the AudioContext (spec §12).
   */
  const [started, setStarted] = useState(false);

  // Stop any sound still playing when the screen changes.
  useEffect(() => () => audio.stopAll(), [path]);

  if (app.failed) {
    return (
      <main className="screen">
        <div className="screen__body">
          <p className="storage-error">
            The app could not open its storage on this device. Close the app and open it again. If
            this keeps happening, check that Safari is not in Private Browsing mode.
          </p>
        </div>
      </main>
    );
  }
  if (!app.ready) return <main className="screen" aria-busy="true" />;

  if (matchRoute('/parent/*', path) || path === '/parent') {
    return (
      <Mode name="parent">
        <ParentArea path={path} />
      </Mode>
    );
  }

  const coachRead = matchRoute('/coach/read/:id', path);
  const shelfRead = matchRoute('/shelf/read/:id', path);
  let screen: ReactNode;
  if (path === '/solo') {
    screen = (
      <Mode name="solo">
        <SoloSession />
      </Mode>
    );
  } else if (coachRead?.id) {
    screen = (
      <Mode name="coach">
        <CoachRead key={coachRead.id} id={coachRead.id} />
      </Mode>
    );
  } else if (path === '/coach') {
    screen = (
      <Mode name="coach">
        <CoachHome />
      </Mode>
    );
  } else if (shelfRead?.id) {
    screen = (
      <Mode name="shelf">
        <ShelfRead key={shelfRead.id} id={shelfRead.id} />
      </Mode>
    );
  } else if (path === '/shelf') {
    screen = (
      <Mode name="shelf">
        <ShelfPage />
      </Mode>
    );
  } else {
    screen = (
      <Mode name="home">
        <Home />
      </Mode>
    );
  }
  return started ? screen : <StartScreen onStart={() => setStarted(true)} />;
}

export function App() {
  return (
    <AppDataProvider>
      <Routes />
    </AppDataProvider>
  );
}
