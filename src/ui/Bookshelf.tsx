import type { ReactNode } from 'react';
import { StarIcon } from './icons';
import { Picture } from './Picture';

export interface ShelfBook {
  id: string;
  /** Already passed through the decodability gate by the caller. */
  title: ReactNode;
  sticker?: string;
  /** 0–3 for stories; undefined for single sentences. */
  stars?: number;
  /** Stable colour index so a book always looks the same. */
  hue: number;
}

const SPINE_COLORS = ['#c9dcd6', '#e4d3b8', '#d3d0e6', '#e6cfcf', '#cfe0ea', '#dfe3c4'];

/** Her collection of completed sentences and stories (spec §7, §8.7). */
export function Bookshelf({
  books,
  onOpen,
}: {
  books: readonly ShelfBook[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="shelf" data-testid="bookshelf">
      {books.map((book) => (
        <button
          key={book.id}
          type="button"
          className="shelf__book"
          style={{ background: SPINE_COLORS[book.hue % SPINE_COLORS.length] }}
          data-testid="shelf-book"
          data-book={book.id}
          onClick={() => onOpen(book.id)}
        >
          {book.sticker && <Picture id={book.sticker} className="shelf__sticker" />}
          <span className="shelf__title">{book.title}</span>
          {book.stars !== undefined && (
            <span className="shelf__stars" aria-label={`${book.stars} of 3 reads`}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={i < (book.stars ?? 0) ? 'shelf__star shelf__star--on' : 'shelf__star'}
                >
                  <StarIcon filled={i < (book.stars ?? 0)} />
                </span>
              ))}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
