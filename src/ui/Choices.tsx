import type { ReactNode } from 'react';
import type { AnyEntry, Scene, UnlockState } from '@/engine/types';
import { Picture, ScenePicture } from './Picture';
import { Word } from './Word';

interface ChoiceGridProps {
  kind: 'word' | 'picture' | 'grapheme';
  children: ReactNode[];
  /** In the "tap it yourself" step only this choice is live, and it is highlighted. */
  highlightIdx?: number | null;
  disabled?: boolean;
  /** Fires for every tap; the caller applies the anti-guessing guard. */
  onChoose: (index: number) => void;
}

function ChoiceGrid({
  kind,
  children,
  highlightIdx = null,
  disabled = false,
  onChoose,
}: ChoiceGridProps) {
  return (
    <div className={`choices choices--${kind}`} data-testid="choices">
      {children.map((child, index) => {
        const guided = highlightIdx !== null;
        const live = !disabled && (!guided || highlightIdx === index);
        return (
          <button
            key={index}
            type="button"
            className={`choice${guided && highlightIdx === index ? ' choice--highlight' : ''}${guided && highlightIdx !== index ? ' choice--faded' : ''}`}
            data-testid="choice"
            data-index={index}
            aria-disabled={!live}
            onClick={() => {
              if (live) onChoose(index);
            }}
          >
            {child}
          </button>
        );
      })}
    </div>
  );
}

type SharedProps = Pick<ChoiceGridProps, 'highlightIdx' | 'disabled' | 'onChoose'>;

/** Grid of 3 word cards (spec §7). */
export function WordChoice({
  options,
  unlock,
  ...rest
}: SharedProps & { options: readonly AnyEntry[]; unlock: UnlockState }) {
  return (
    <ChoiceGrid kind="word" {...rest}>
      {options.map((entry) => (
        <Word key={entry.id} entry={entry} unlock={unlock} size="word" />
      ))}
    </ChoiceGrid>
  );
}

/** Grid of 3 tappable scenes, with large targets (spec §7). */
export function PictureChoice({ scenes, ...rest }: SharedProps & { scenes: readonly Scene[] }) {
  return (
    <ChoiceGrid kind="picture" {...rest}>
      {scenes.map((scene, i) => (
        <ScenePicture key={i} scene={scene} />
      ))}
    </ChoiceGrid>
  );
}

/** Grid of 3 grapheme cards for the sound warm-up. */
export function GraphemeChoice({
  spellings,
  ...rest
}: SharedProps & { spellings: readonly string[] }) {
  return (
    <ChoiceGrid kind="grapheme" {...rest}>
      {spellings.map((spelling) => (
        <span key={spelling} className="grapheme-card" data-spelling={spelling}>
          {spelling}
        </span>
      ))}
    </ChoiceGrid>
  );
}

/** A single prompt picture (Pick the Word, Word Building). */
export function PromptPicture({ pictureId }: { pictureId: string }) {
  return (
    <span className="prompt-picture">
      <Picture id={pictureId} />
    </span>
  );
}
