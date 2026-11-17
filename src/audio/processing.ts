/**
 * Recording clean-up for Sound Studio (spec §10.3), as pure functions over
 * mono samples: trim silence, normalize peak to −1 dBFS, add 10 ms fades.
 */

export const PROCESSING = {
  /** RMS level (linear) below which a window counts as silence. */
  silenceRms: 0.012,
  windowMs: 10,
  /** Sound kept before the first and after the last loud window. */
  paddingMs: 15,
  peakDb: -1,
  fadeMs: 10,
} as const;

function rms(samples: Float32Array, start: number, end: number): number {
  let sum = 0;
  for (let i = start; i < end; i += 1) {
    const value = samples[i] ?? 0;
    sum += value * value;
  }
  return Math.sqrt(sum / Math.max(1, end - start));
}

/** Remove leading and trailing silence using a windowed RMS threshold. */
export function trimSilence(samples: Float32Array, sampleRate: number): Float32Array {
  const window = Math.max(1, Math.round((PROCESSING.windowMs / 1000) * sampleRate));
  const padding = Math.round((PROCESSING.paddingMs / 1000) * sampleRate);
  let first = -1;
  let last = -1;
  for (let start = 0; start < samples.length; start += window) {
    const end = Math.min(samples.length, start + window);
    if (rms(samples, start, end) >= PROCESSING.silenceRms) {
      if (first === -1) first = start;
      last = end;
    }
  }
  if (first === -1) return new Float32Array(0);
  return samples.slice(Math.max(0, first - padding), Math.min(samples.length, last + padding));
}

/** Scale so the loudest sample sits at the target level (default −1 dBFS). */
export function normalizePeak(
  samples: Float32Array,
  targetDb: number = PROCESSING.peakDb,
): Float32Array {
  let peak = 0;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  if (peak === 0) return samples.slice();
  const gain = 10 ** (targetDb / 20) / peak;
  return samples.map((value) => value * gain);
}

/** Linear fade in and out to avoid clicks. */
export function applyFades(
  samples: Float32Array,
  sampleRate: number,
  fadeMs: number = PROCESSING.fadeMs,
): Float32Array {
  const out = samples.slice();
  const fade = Math.min(Math.round((fadeMs / 1000) * sampleRate), Math.floor(out.length / 2));
  for (let i = 0; i < fade; i += 1) {
    const gain = i / fade;
    out[i] = (out[i] ?? 0) * gain;
    const j = out.length - 1 - i;
    out[j] = (out[j] ?? 0) * gain;
  }
  return out;
}

/** The full Sound Studio chain. Returns an empty array for a silent take. */
export function processRecording(samples: Float32Array, sampleRate: number): Float32Array {
  const trimmed = trimSilence(samples, sampleRate);
  if (trimmed.length === 0) return trimmed;
  return applyFades(normalizePeak(trimmed), sampleRate);
}

/** Average several channels into one. */
export function mixToMono(channels: readonly Float32Array[]): Float32Array {
  const first = channels[0];
  if (!first) return new Float32Array(0);
  if (channels.length === 1) return first.slice();
  const out = new Float32Array(first.length);
  for (const channel of channels) {
    for (let i = 0; i < out.length; i += 1)
      out[i] = (out[i] ?? 0) + (channel[i] ?? 0) / channels.length;
  }
  return out;
}

/** Encode mono samples as a 16-bit PCM WAV file. */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeText(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((value, i) => {
    const clamped = Math.max(-1, Math.min(1, value));
    view.setInt16(44 + i * 2, Math.round(clamped * 0x7fff), true);
  });
  return buffer;
}

/** The stretch of a continuous sound that is looped while it is held. */
export function sustainLoop(duration: number): { start: number; end: number } {
  return { start: duration * 0.3, end: duration * 0.7 };
}
