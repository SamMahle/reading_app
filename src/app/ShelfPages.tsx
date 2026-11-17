import { useMemo, useState } from 'react';
import { CONTENT } from '@/content/index';
import { isReadable, partitionReadable } from '@/engine/readability';
import type { AnyEntry, Sentence } from '@/engine/types';
import { Bookshelf, type ShelfBook } from '@/ui/Bookshelf';
import { FocusReader } from '@/ui/FocusReader';
import { HomeIcon } from '@/ui/icons';
import { PromptAudio } from '@/ui/PromptAudio';
import { SoundItOut } from '@/ui/SoundItOut';
import { useApp } from './AppData';
import { useReaderPosition } from './reading';
import { navigate } from './router';

function hueOf(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

/** Her collection: every sentence and story she has completed (spec §8.7). */
export function ShelfPage() {
  const app = useApp();
  const books = useMemo<ShelfBook[]>(() => {
    const shelved = app.storyRecords
      .filter((r) => r.shelvedTs !== undefined)
      .sort((a, b) => (a.shelvedTs ?? 0) - (b.shelvedTs ?? 0));
    return shelved.flatMap((record): ShelfBook[] => {
      if (record.type === 'sentence') {
        const sentence = CONTENT.sentences.find((s) => s.id === record.id);
        if (!sentence || !isReadable(sentence.text, app.unlock, app.lexicon).ok) return [];
        return [
          {
            id: record.id,
            sticker: sentence.scene?.subject ?? 'book',
            hue: hueOf(record.id),
          },
        ];
      }
      const story = app.stories.find((s) => s.id === record.id);
      if (!story) return [];
      // An app story is shelved only while every page still passes the checker.
      const readable =
        story.source !== 'app' ||
        partitionReadable(story.pages.flat(), app.unlock, app.lexicon).refused.length === 0;
      if (!readable) return [];
      return [
        {
          id: record.id,
          sticker: story.sticker ?? 'book',
          stars: Math.min(record.reads.length, 3),
          hue: hueOf(record.id),
        },
      ];
    });
  }, [app.storyRecords, app.stories, app.unlock, app.lexicon]);

  const open = (id: string) => {
    const record = app.storyRecords.find((r) => r.id === id);
    // Class passages always go through pre-teach, so they open in Coach mode.
    navigate(
      record?.type === 'class_passage'
        ? `/coach/read/${encodeURIComponent(id)}`
        : `/shelf/read/${encodeURIComponent(id)}`,
    );
  };

  return (
    <main className="screen kid-screen" data-testid="shelf-page">
      <div className="screen__bar">
        <button
          type="button"
          className="icon-button"
          aria-label="Home"
          onClick={() => navigate('/')}
        >
          <HomeIcon />
        </button>
        <PromptAudio promptId="pr_pick_book" />
      </div>
      <div className="screen__body">
        <Bookshelf books={books} onOpen={open} />
      </div>
    </main>
  );
}

/** Rereading a shelved sentence or story in the focus reader. */
export function ShelfRead({ id }: { id: string }) {
  const app = useApp();
  const pages = useMemo<Sentence[][]>(() => {
    const story = app.stories.find((s) => s.id === id && s.source === 'app');
    if (story) return story.pages;
    const sentence = CONTENT.sentences.find((s) => s.id === id);
    return sentence ? [[sentence]] : [];
  }, [app.stories, id]);
  const reader = useReaderPosition(pages, app.ladder.rung, app.unlock, app.lexicon);
  const [help, setHelp] = useState<{ entry: AnyEntry; display: string } | null>(null);

  return (
    <main className="screen kid-screen" data-testid="shelf-read">
      <div className="screen__bar">
        <button
          type="button"
          className="icon-button"
          aria-label="Back to my books"
          onClick={() => navigate('/shelf')}
        >
          <HomeIcon />
        </button>
        <PromptAudio promptId="pr_read_aloud" />
      </div>
      <div className="screen__body">
        <FocusReader
          key={reader.pageIdx}
          sentences={reader.sentences}
          rung={app.ladder.rung}
          chunkIdx={reader.chunkIdx}
          unlock={app.unlock}
          lexicon={app.lexicon}
          onWordTap={(entry, display) => setHelp({ entry, display })}
          onAdvance={() => {
            if (!reader.advance()) navigate('/shelf');
          }}
        />
      </div>
      {help && (
        <SoundItOut
          entry={help.entry}
          display={help.display}
          unlock={app.unlock}
          onClose={() => setHelp(null)}
        />
      )}
    </main>
  );
}
