import { useMemo } from 'react';
import { soundClipsForUnlock } from '@/content/audioManifest';
import { CONTENT } from '@/content/index';
import { DAY_MS, toIsoDate } from '@/engine/dates';
import { practiceDays } from '@/engine/metrics';
import { isReadable } from '@/engine/readability';
import { readStatus } from '@/engine/repeatedReading';
import { HoldButton } from '@/ui/HoldButton';
import { BooksIcon, CoachIcon, GearIcon, SoloIcon, StarIcon } from '@/ui/icons';
import { Picture } from '@/ui/Picture';
import { useApp } from './AppData';
import { navigate } from './router';
import { useUpdateReady } from './update';

const GEAR_HOLD_MS = 3000;
const TRACKER_DAYS = 7;

/**
 * A dot per day she practiced (spec §8.7). It only ever shows days gained:
 * there is no streak count and nothing is ever shown as lost.
 */
function DayTracker() {
  const { sessions } = useApp();
  const practiced = useMemo(() => new Set(practiceDays(sessions)), [sessions]);
  const today = Date.now();
  return (
    <div className="day-tracker" data-testid="day-tracker" aria-label="Days practiced this week">
      {Array.from({ length: TRACKER_DAYS }, (_, i) => {
        const date = toIsoDate(today - (TRACKER_DAYS - 1 - i) * DAY_MS);
        return (
          <span
            key={date}
            className={`day-dot${practiced.has(date) ? ' day-dot--on' : ''}`}
            data-date={date}
          />
        );
      })}
    </div>
  );
}

export function Home() {
  const app = useApp();
  const updateReady = useUpdateReady();
  const now = Date.now();

  // Stories that are due for their next read (spec §9.4).
  const dueStories = useMemo(
    () =>
      app.storyRecords
        .filter((record) => record.type !== 'sentence' && readStatus(record.reads, now).due)
        .map((record) => ({ record, story: app.stories.find((s) => s.id === record.id) }))
        .filter(
          (x) =>
            x.story &&
            (x.story.source === 'class_passage' ||
              isReadable(x.story.title, app.unlock, app.lexicon).ok),
        )
        .slice(0, 3),
    [app.storyRecords, app.stories, app.unlock, app.lexicon, now],
  );

  const missingSounds = soundClipsForUnlock(app.unlock, CONTENT, app.custom).filter(
    (id) => !app.recordedClips.includes(id),
  ).length;
  const needsParent = updateReady || (missingSounds > 0 && !import.meta.env.DEV);

  return (
    <main className="screen kid-screen home" data-testid="home">
      <div className="screen__bar">
        <DayTracker />
        <HoldButton
          holdMs={GEAR_HOLD_MS}
          label="Parent area: hold for 3 seconds"
          testId="parent-gear"
          onHeld={() => navigate('/parent')}
        >
          <GearIcon />
          {needsParent && <span className="home__badge" data-testid="parent-badge" />}
        </HoldButton>
      </div>
      <div className="screen__body">
        <div className="home__modes">
          <button
            type="button"
            className="mode-card"
            aria-label="Read on my own"
            data-testid="start-solo"
            onClick={() => navigate('/solo')}
          >
            <SoloIcon />
          </button>
          <button
            type="button"
            className="mode-card"
            aria-label="Read together"
            data-testid="start-coach"
            onClick={() => navigate('/coach')}
          >
            <CoachIcon />
          </button>
          <button
            type="button"
            className="mode-card mode-card--small"
            aria-label="My books"
            data-testid="open-shelf"
            onClick={() => navigate('/shelf')}
          >
            <BooksIcon />
          </button>
        </div>
        {dueStories.length > 0 && (
          <div className="home__due" data-testid="due-stories">
            {dueStories.map(({ record, story }) => (
              <button
                key={record.id}
                type="button"
                className="due-card"
                aria-label="Read this story again"
                data-story={record.id}
                onClick={() => navigate(`/coach/read/${encodeURIComponent(record.id)}`)}
              >
                <Picture id={story?.sticker ?? 'book'} className="due-card__sticker" />
                <span className="due-card__stars">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className={
                        i < record.reads.length ? 'shelf__star shelf__star--on' : 'shelf__star'
                      }
                    >
                      <StarIcon filled={i < record.reads.length} />
                    </span>
                  ))}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
