import { useCallback, useState } from 'react';
import { usePageLayout } from '@/ui/FocusReader';
import type { Lexicon, Rung, Sentence, UnlockState } from '@/engine/types';

/**
 * Reading position through a paged text: which page, and which chunk of it.
 * Shared by Coach reading and Bookshelf rereading.
 */
export function useReaderPosition(
  pages: readonly (readonly Sentence[])[],
  rung: Rung,
  unlock: UnlockState,
  lexicon: Lexicon,
  preTaught?: ReadonlySet<string>,
) {
  const [pageIdx, setPageIdx] = useState(0);
  const [chunkIdx, setChunkIdx] = useState(0);
  const sentences = pages[pageIdx] ?? [];
  const layout = usePageLayout(sentences, rung, unlock, lexicon, preTaught);
  const lastChunk = chunkIdx >= layout.chunks.length - 1;
  const lastPage = pageIdx >= pages.length - 1;

  /** Move on one chunk. Returns false when the text is finished. */
  const advance = useCallback((): boolean => {
    if (!lastChunk) {
      setChunkIdx((value) => value + 1);
      return true;
    }
    if (!lastPage) {
      setPageIdx((value) => value + 1);
      setChunkIdx(0);
      return true;
    }
    return false;
  }, [lastChunk, lastPage]);

  return { pageIdx, chunkIdx, sentences, layout, advance, finished: lastChunk && lastPage };
}
