import { relationLayout } from '@/engine/distractors';
import type { Scene } from '@/engine/types';
import { pictureUrl } from './pictures';

/** One bundled picture. Decorative for assistive tech: the word is the content. */
export function Picture({ id, className }: { id: string; className?: string }) {
  const url = pictureUrl(id);
  if (!url) return null;
  return (
    <img className={className ?? 'picture'} src={url} alt="" draggable={false} data-picture={id} />
  );
}

/**
 * A read-then-match scene composed from two pictures and a relation
 * (spec §6.5): the subject drawn over, inside or beside the object.
 */
export function ScenePicture({ scene }: { scene: Scene }) {
  const layout = relationLayout(scene);
  return (
    <span
      className={`scene scene--${layout}`}
      data-scene={`${scene.subject}|${layout}|${scene.object ?? ''}`}
    >
      {layout !== 'alone' && scene.object && (
        <Picture id={scene.object} className="scene__object" />
      )}
      <Picture id={scene.subject} className="scene__subject" />
    </span>
  );
}
