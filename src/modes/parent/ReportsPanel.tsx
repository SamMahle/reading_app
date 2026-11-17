import { useMemo } from 'react';
import { useApp } from '@/app/AppData';
import { PATTERN_MAP } from '@/content/index';
import { CONTENT } from '@/content/index';
import { DAY_MS } from '@/engine/dates';
import {
  accuracy,
  helpUseBySession,
  patternAccuracy,
  REPORT_WINDOW_DAYS,
  stallWords,
} from '@/engine/metrics';
import { RUNG_LABELS } from '@/modes/coach/CoachHome';
import { HelpUseChart, TrendChart } from './charts';

const percent = (value: number) => `${Math.round(value * 100)}%`;
const dateTime = (ts: number) =>
  new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
const day = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** Reports (spec §10.4): stall words, pattern accuracy, help use, ladder, session log. */
export function ReportsPanel() {
  const app = useApp();
  const now = Date.now();
  const recent = useMemo(
    () => app.attempts.filter((a) => a.ts >= now - REPORT_WINDOW_DAYS * DAY_MS),
    [app.attempts, now],
  );
  const stalls = useMemo(
    () => stallWords(app.attempts, app.cardMap, now).slice(0, 15),
    [app.attempts, app.cardMap, now],
  );
  const patterns = useMemo(
    () => patternAccuracy(app.attempts, app.lexicon, CONTENT.patterns, now),
    [app.attempts, app.lexicon, now],
  );
  const helpUse = useMemo(() => helpUseBySession(app.attempts), [app.attempts]);
  const sessions = useMemo(() => [...app.sessions].sort((a, b) => b.ts - a.ts), [app.sessions]);
  const solo = recent.filter((a) => a.mode === 'solo');
  const coach = recent.filter((a) => a.mode === 'coach');
  const opened = recent.filter((a) => a.usedHelp).length;
  const completed = recent.filter((a) => a.completedHelp).length;

  return (
    <div className="panel" data-testid="reports-panel">
      <h1>Reports</h1>
      <p className="panel__lead">
        Figures cover the last {REPORT_WINDOW_DAYS} days unless a chart shows its own dates.
      </p>

      <div className="tiles">
        <div className="tile-stat">
          <span className="tile-stat__value">{solo.length ? percent(accuracy(solo)) : '–'}</span>
          <span className="tile-stat__label">Solo accuracy (target about 95%)</span>
        </div>
        <div className="tile-stat">
          <span className="tile-stat__value">{coach.length ? percent(accuracy(coach)) : '–'}</span>
          <span className="tile-stat__label">Coach accuracy (target 90% or better)</span>
        </div>
        <div className="tile-stat">
          <span className="tile-stat__value">{opened ? `${completed} of ${opened}` : '–'}</span>
          <span className="tile-stat__label">Help routines completed</span>
        </div>
        <div className="tile-stat">
          <span className="tile-stat__value">Step {app.ladder.rung}</span>
          <span className="tile-stat__label">Coach text load: {RUNG_LABELS[app.ladder.rung]}</span>
        </div>
      </div>

      <section className="panel__section">
        <h2>Help use</h2>
        <p className="panel__note">
          A rising share of completed routines means sounding out is replacing guessing.
        </p>
        <HelpUseChart rows={helpUse} />
      </section>

      <section className="panel__section">
        <h2>Text-load ladder</h2>
        <TrendChart
          label="Ladder step over time"
          points={app.ladder.history.map((h) => ({ ts: h.ts, value: h.rung }))}
          yMax={5}
          yTicks={[1, 2, 3, 4, 5]}
          step
          format={(value) => `step ${value}`}
        />
        <p className="panel__note">
          Steps: 1 one word · 2 one phrase · 3 one sentence · 4 two sentences · 5 full page. Up
          after two Coach sessions in a row at 90% or better; down after one below 80%.
        </p>
      </section>

      <section className="panel__section">
        <h2>Session accuracy</h2>
        <TrendChart
          label="Accuracy per session"
          points={[...app.sessions]
            .sort((a, b) => a.ts - b.ts)
            .slice(-20)
            .map((s) => ({ ts: s.ts, value: Math.round(s.accuracy * 100) }))}
          yMax={100}
          yTicks={[0, 50, 100]}
          format={(value) => `${value}%`}
        />
      </section>

      <section className="panel__section">
        <h2>Stall words</h2>
        {stalls.length === 0 ? (
          <p className="panel__note">
            No words have needed help in the last {REPORT_WINDOW_DAYS} days.
          </p>
        ) : (
          <table className="data-table" data-testid="stall-table">
            <thead>
              <tr>
                <th>Word</th>
                <th>Misses</th>
                <th>Help uses</th>
                <th>Last seen</th>
                <th>Review box</th>
              </tr>
            </thead>
            <tbody>
              {stalls.map((row) => (
                <tr key={row.wordId}>
                  <td className="data-table__word">{row.wordId}</td>
                  <td>{row.misses}</td>
                  <td>{row.helpUses}</td>
                  <td>{day(row.lastSeenTs)}</td>
                  <td>{row.box ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel__section">
        <h2>Pattern accuracy</h2>
        {patterns.length === 0 ? (
          <p className="panel__note">No attempts yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Pattern</th>
                <th>Accuracy</th>
                <th>Attempts</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {patterns.map((row) => (
                <tr key={row.patternId} className={row.weak ? 'data-table__row--weak' : undefined}>
                  <td>{PATTERN_MAP.get(row.patternId)?.label ?? row.patternId}</td>
                  <td>{percent(row.accuracy)}</td>
                  <td>{row.total}</td>
                  <td>{row.weak ? 'Needs practice' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel__section">
        <h2>Session log</h2>
        {sessions.length === 0 ? (
          <p className="panel__note">No sessions yet.</p>
        ) : (
          <table className="data-table" data-testid="session-log">
            <thead>
              <tr>
                <th>Date</th>
                <th>Mode</th>
                <th>Minutes</th>
                <th>Items</th>
                <th>Accuracy</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {sessions.slice(0, 40).map((s) => (
                <tr key={s.id}>
                  <td>{dateTime(s.ts)}</td>
                  <td>{s.mode === 'solo' ? 'Solo' : 'Coach'}</td>
                  <td>{(s.durationMs / 60000).toFixed(1)}</td>
                  <td>{s.items}</td>
                  <td>{percent(s.accuracy)}</td>
                  <td>{s.notes.join(' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
