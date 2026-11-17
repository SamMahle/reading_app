import type { Grapheme } from './types';

/**
 * Maps graphemes (in sound order) onto the letters of a word (in print
 * order). The two orders differ only for split digraphs: in "like" the
 * grapheme "i_e" owns the "i" and the final "e", with "k" between them.
 */

export interface LetterCell {
  /** Index into the word's graphemes. */
  graphemeIdx: number;
  /** The letters shown in this cell, with the display capitalisation. */
  text: string;
  /** True for the silent final "e" of a split digraph (it gets no dot). */
  silent: boolean;
  /** True when the cell belongs to a split digraph (vowel or silent e). */
  split: boolean;
}

const SPLIT_DIGRAPH = /^[a-z]_e$/u;

export function isSplitDigraph(spelling: string): boolean {
  return SPLIT_DIGRAPH.test(spelling.toLowerCase());
}

/** The letters a grapheme contributes to the printed word. */
export function graphemeLetters(spelling: string): string {
  return spelling.replace('_', '');
}

/** The word a segmentation spells, used to verify entries. */
export function spellingOf(graphemes: readonly Grapheme[]): string {
  let word = '';
  let pendingE = false;
  for (const grapheme of graphemes) {
    if (isSplitDigraph(grapheme.spelling)) {
      word += grapheme.spelling.charAt(0);
      pendingE = true;
      continue;
    }
    word += grapheme.spelling;
    if (pendingE) {
      word += 'e';
      pendingE = false;
    }
  }
  return pendingE ? `${word}e` : word;
}

/**
 * Lay a word out as letter cells. `display` supplies the capitalisation to
 * show ("The", "Pam"); it must spell the same letters as the graphemes.
 * Returns undefined when the segmentation does not match the display text.
 */
export function layoutWord(
  display: string,
  graphemes: readonly Grapheme[],
): LetterCell[] | undefined {
  if (spellingOf(graphemes).toLowerCase() !== display.toLowerCase()) return undefined;
  const cells: LetterCell[] = [];
  let pos = 0;
  let pendingSplit: number | undefined;
  graphemes.forEach((grapheme, graphemeIdx) => {
    if (isSplitDigraph(grapheme.spelling)) {
      cells.push({ graphemeIdx, text: display.slice(pos, pos + 1), silent: false, split: true });
      pos += 1;
      pendingSplit = graphemeIdx;
      return;
    }
    const length = grapheme.spelling.length;
    cells.push({
      graphemeIdx,
      text: display.slice(pos, pos + length),
      silent: false,
      split: false,
    });
    pos += length;
    if (pendingSplit !== undefined) {
      cells.push({
        graphemeIdx: pendingSplit,
        text: display.slice(pos, pos + 1),
        silent: true,
        split: true,
      });
      pos += 1;
      pendingSplit = undefined;
    }
  });
  if (pendingSplit !== undefined) {
    cells.push({
      graphemeIdx: pendingSplit,
      text: display.slice(pos, pos + 1),
      silent: true,
      split: true,
    });
  }
  return cells;
}
