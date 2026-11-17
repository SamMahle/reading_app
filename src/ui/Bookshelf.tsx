import { StarIcon } from './icons';
import { Picture } from './Picture';

export interface ShelfBook {
  id: string;
  /**
   * The picture on the spine. Spines carry no text: anything she reads is
   * shown at full reading size, after she opens the book.
   */
  sticker: string;
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
          aria-label="Read this book again"
          onClick={() => onOpen(book.id)}
        >
          <Picture id={book.sticker} className="shelf__sticker" />
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
