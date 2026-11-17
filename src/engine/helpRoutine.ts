/**
 * State machine for the sound-it-out routine (spec §8.1): tap each sound,
 * swipe to blend, say the word, and only then may the whole word be heard.
 */
export interface HelpState {
  tapped: boolean[];
  slideDone: boolean;
  /** The "Say the word" pause (about 1.5 s) has elapsed. */
  pauseDone: boolean;
}

export type HelpEvent =
  { type: 'dot'; index: number } | { type: 'slide_complete' } | { type: 'pause_elapsed' };

export const SAY_THE_WORD_PAUSE_MS = 1500;

export function initialHelpState(graphemeCount: number): HelpState {
  return {
    tapped: Array.from({ length: graphemeCount }, () => false),
    slideDone: false,
    pauseDone: false,
  };
}

export function allDotsTapped(state: HelpState): boolean {
  return state.tapped.every(Boolean);
}

/** The slider opens only once every dot has been tapped. */
export function canSlide(state: HelpState): boolean {
  return allDotsTapped(state);
}

/** `completedHelp` in the attempt record: all dots tapped AND the blend swiped. */
export function completedHelp(state: HelpState): boolean {
  return allDotsTapped(state) && state.slideDone;
}

/** The gate: whole-word audio is unreachable until the routine is complete. */
export function canPlayWholeWord(state: HelpState): boolean {
  return completedHelp(state) && state.pauseDone;
}

export function helpReducer(state: HelpState, event: HelpEvent): HelpState {
  switch (event.type) {
    case 'dot': {
      if (event.index < 0 || event.index >= state.tapped.length) return state;
      if (state.tapped[event.index]) return state;
      const tapped = state.tapped.slice();
      tapped[event.index] = true;
      return { ...state, tapped };
    }
    case 'slide_complete':
      return canSlide(state) ? { ...state, slideDone: true } : state;
    case 'pause_elapsed':
      return state.slideDone ? { ...state, pauseDone: true } : state;
  }
}
