/**
 * Auto-blend scheduling (spec §12): clips play back to back, with an 80 ms
 * equal-power crossfade between continuous sounds and no overlap after a
 * stop sound.
 */
export const CROSSFADE_S = 0.08;

export interface BlendClip {
  duration: number; // seconds
  continuous: boolean;
}

export interface ScheduledClip {
  /** Start time in seconds from the beginning of the blend. */
  start: number;
  /** Fade-in length in seconds (0 for a hard start). */
  fadeIn: number;
  /** Fade-out length in seconds (0 to let the clip end naturally). */
  fadeOut: number;
}

export function planBlend(
  clips: readonly BlendClip[],
  crossfade: number = CROSSFADE_S,
): { schedule: ScheduledClip[]; total: number } {
  const schedule: ScheduledClip[] = [];
  let cursor = 0;
  clips.forEach((clip, i) => {
    const previous = clips[i - 1];
    const next = clips[i + 1];
    const overlapIn =
      previous?.continuous && clip.continuous
        ? Math.min(crossfade, previous.duration / 2, clip.duration / 2)
        : 0;
    const overlapOut =
      next?.continuous && clip.continuous
        ? Math.min(crossfade, clip.duration / 2, next.duration / 2)
        : 0;
    const start = Math.max(0, cursor - overlapIn);
    schedule.push({ start, fadeIn: overlapIn, fadeOut: overlapOut });
    cursor = start + clip.duration;
  });
  return { schedule, total: cursor };
}

/** Equal-power gain curves: the two always sum to constant power. */
export function equalPowerCurve(direction: 'in' | 'out', steps = 16): Float32Array {
  const curve = new Float32Array(steps);
  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    curve[i] = direction === 'in' ? Math.sin((t * Math.PI) / 2) : Math.cos((t * Math.PI) / 2);
  }
  return curve;
}
