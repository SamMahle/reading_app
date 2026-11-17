import { useMemo } from 'react';
import { useApp } from '@/app/AppData';
import { navigate } from '@/app/router';
import { partitionReadable } from '@/engine/readability';
import { readStatus } from '@/engine/repeatedReading';
import type { Story } from '@/engine/types';
import { HomeIcon, StarIcon } from '@/ui/icons';
import { Picture } from '@/ui/Picture';
import { PromptAudio } from '@/ui/PromptAudio';
import './coach.css';

export const RUNG_LABELS: Record<number, string> = {
  1: 'one word at a time',
  2: 'one phrase at a time',
  3: 'one sentence at a time',
  4: 'two sentences at a time',
  5: 'the full page',
};

interface Card {
  story: Story;
  reads: number;
  due: boolean;
}

function StoryCard({ card }: { card: Card }) {
  const isPassage = card.story.source === 'class_passage';
  return (
    <button
      type="button"
      className={`story-card${card.due ? ' story-card--due' : ''}`}
      data-testid="story-card"
      data-story={card.story.id}
      onClick={() => navigate(`/coach/read/${encodeURIComponent(card.story.id)}`)}
    >
      {/* The sticker is a reward: it only appears once the story has been read. */}
      <Picture
        id={card.reads > 0 ? (card.story.sticker ?? 'book') : 'book'}
        className="story-card__sticker"
      />
      <span
        className={isPassage ? 'story-card__title story-card__title--plain' : 'story-card__title'}
      >
        {card.story.title}
      </span>
      <span className="story-card__stars" aria-label={`${Math.min(card.reads, 3)} of 3 reads done`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={i < card.reads ? 'shelf__star shelf__star--on' : 'shelf__star'}>
            <StarIcon filled={i < card.reads} />
          </span>
        ))}
      </span>
    </button>
  );
}

/** Coach mode entry: pick a story to read aloud together (spec §9). */
export function CoachHome() {
  const app = useApp();
  const now = Date.now();

  const { due, fresh, finished, passages } = useMemo(() => {
    const cards: Card[] = app.stories
      .filter((story) => {
        if (story.source === 'class_passage') return true;
        // Only stories she can read right now are offered.
        const sentences = [{ text: story.title }, ...story.pages.flat()];
        return partitionReadable(sentences, app.unlock, app.lexicon).refused.length === 0;
      })
      .map((story) => {
        const reads = app.storyRecords.find((r) => r.id === story.id)?.reads ?? [];
        return { story, reads: reads.length, due: readStatus(reads, now).due };
      });
    const appCards = cards.filter((c) => c.story.source === 'app');
    return {
      due: cards.filter((c) => c.due),
      fresh: appCards
        .filter((c) => c.reads === 0)
        .sort((a, b) => b.story.levelId - a.story.levelId),
      finished: appCards.filter((c) => c.reads > 0 && !c.due),
      passages: cards.filter((c) => c.story.source === 'class_passage' && !c.due),
    };
  }, [app.stories, app.storyRecords, app.unlock, app.lexicon, now]);

  const section = (title: string, cards: Card[], testId: string) =>
    cards.length > 0 && (
      <section className="coach-section" data-testid={testId}>
        <h2 className="coach-section__title">{title}</h2>
        <div className="coach-section__cards">
          {cards.map((card) => (
            <StoryCard key={card.story.id} card={card} />
          ))}
        </div>
      </section>
    );

  return (
    <main className="screen" data-testid="coach-home">
      <div className="screen__bar">
        <button
          type="button"
          className="icon-button"
          aria-label="Home"
          onClick={() => navigate('/')}
        >
          <HomeIcon />
        </button>
        <p className="coach-rung" data-testid="coach-rung">
          Reading {RUNG_LABELS[app.ladder.rung]}{' '}
          <span className="coach-rung__step">(step {app.ladder.rung} of 5)</span>
        </p>
        <PromptAudio promptId="pr_pick_book" />
      </div>
      <div className="coach-list">
        {section('Read again', due, 'coach-due')}
        {section('Class passages', passages, 'coach-passages')}
        {section('New stories', fresh, 'coach-new')}
        {section('Read before', finished, 'coach-done')}
      </div>
    </main>
  );
}
