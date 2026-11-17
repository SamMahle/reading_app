import { describe, expect, it } from 'vitest';
import { CROSSFADE_S, equalPowerCurve, planBlend } from '@/audio/blendPlan';
import {
  applyFades,
  encodeWav,
  mixToMono,
  normalizePeak,
  processRecording,
  sustainLoop,
  trimSilence,
} from '@/audio/processing';

const RATE = 16000;
const seconds = (s: number) => Math.round(s * RATE);
function tone(lengthS: number, amplitude: number): Float32Array {
  return Float32Array.from(
    { length: seconds(lengthS) },
    (_, i) => amplitude * Math.sin((2 * Math.PI * 220 * i) / RATE),
  );
}
function take(leadS: number, soundS: number, tailS: number, amplitude = 0.3): Float32Array {
  const out = new Float32Array(seconds(leadS) + seconds(soundS) + seconds(tailS));
  out.set(tone(soundS, amplitude), seconds(leadS));
  return out;
}
const peak = (samples: Float32Array) => samples.reduce((max, v) => Math.max(max, Math.abs(v)), 0);

describe('recording clean-up (spec §10.3)', () => {
  it('trims leading and trailing silence, keeping a short pad', () => {
    const trimmed = trimSilence(take(0.5, 0.6, 0.8), RATE);
    expect(trimmed.length / RATE).toBeGreaterThan(0.6);
    expect(trimmed.length / RATE).toBeLessThan(0.66);
  });

  it('returns nothing for a silent take', () => {
    expect(trimSilence(new Float32Array(seconds(1)), RATE)).toHaveLength(0);
    expect(processRecording(new Float32Array(seconds(1)), RATE)).toHaveLength(0);
  });

  it('normalizes the peak to −1 dBFS', () => {
    expect(peak(normalizePeak(tone(0.2, 0.1)))).toBeCloseTo(10 ** (-1 / 20), 3);
    expect(peak(normalizePeak(tone(0.2, 0.9), -6))).toBeCloseTo(10 ** (-6 / 20), 3);
    expect(peak(normalizePeak(new Float32Array(10)))).toBe(0);
  });

  it('adds 10 ms fades at both ends', () => {
    const faded = applyFades(new Float32Array(seconds(0.1)).fill(1), RATE);
    expect(faded[0]).toBe(0);
    expect(faded[seconds(0.005)]).toBeCloseTo(0.5, 1);
    expect(faded[seconds(0.05)]).toBe(1);
    expect(faded[faded.length - 1]).toBe(0);
    expect(applyFades(new Float32Array(3).fill(1), RATE)).toHaveLength(3);
  });

  it('runs the whole chain', () => {
    const processed = processRecording(take(0.3, 0.6, 0.3, 0.05), RATE);
    expect(processed.length / RATE).toBeLessThan(0.66);
    expect(peak(processed)).toBeCloseTo(10 ** (-1 / 20), 2);
    expect(processed[0]).toBe(0);
  });

  it('mixes channels to mono', () => {
    const mono = mixToMono([Float32Array.of(1, 0), Float32Array.of(0, 1)]);
    expect([...mono]).toEqual([0.5, 0.5]);
    expect([...mixToMono([Float32Array.of(0.25)])]).toEqual([0.25]);
    expect(mixToMono([])).toHaveLength(0);
  });

  it('encodes a valid 16-bit mono WAV', () => {
    const wav = new DataView(encodeWav(Float32Array.of(0, 1, -1, 2), RATE));
    const text = (offset: number) =>
      String.fromCharCode(...[0, 1, 2, 3].map((i) => wav.getUint8(offset + i)));
    expect([text(0), text(8), text(12), text(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data']);
    expect(wav.byteLength).toBe(44 + 8);
    expect(wav.getUint32(24, true)).toBe(RATE);
    expect(wav.getUint16(22, true)).toBe(1);
    expect([0, 1, 2, 3].map((i) => wav.getInt16(44 + i * 2, true))).toEqual([
      0, 32767, -32767, 32767,
    ]);
  });

  it('loops the middle of a continuous sound', () => {
    expect(sustainLoop(1)).toEqual({ start: 0.3, end: 0.7 });
  });
});

describe('auto-blend plan (spec §12)', () => {
  const m = { duration: 0.6, continuous: true };
  const a = { duration: 0.6, continuous: true };
  const t = { duration: 0.15, continuous: false };

  it('crossfades 80 ms between continuous sounds', () => {
    const { schedule, total } = planBlend([m, a]);
    expect(schedule[0]).toEqual({ start: 0, fadeIn: 0, fadeOut: CROSSFADE_S });
    expect(schedule[1]?.start).toBeCloseTo(0.6 - CROSSFADE_S);
    expect(schedule[1]?.fadeIn).toBe(CROSSFADE_S);
    expect(total).toBeCloseTo(1.2 - CROSSFADE_S);
  });

  it('never overlaps a stop sound', () => {
    const { schedule, total } = planBlend([m, a, t]);
    expect(schedule[1]?.fadeOut).toBe(0);
    expect(schedule[2]).toEqual({
      start: schedule[1] ? schedule[1].start + 0.6 : -1,
      fadeIn: 0,
      fadeOut: 0,
    });
    expect(total).toBeCloseTo(1.2 - CROSSFADE_S + 0.15);
    const stopFirst = planBlend([t, a]).schedule;
    expect(stopFirst[1]).toEqual({ start: 0.15, fadeIn: 0, fadeOut: 0 });
  });

  it('shortens the crossfade for very short clips', () => {
    const { schedule } = planBlend([{ duration: 0.1, continuous: true }, a]);
    expect(schedule[1]?.fadeIn).toBe(0.05);
    expect(planBlend([])).toEqual({ schedule: [], total: 0 });
  });

  it('uses equal-power curves', () => {
    const fadeIn = equalPowerCurve('in');
    const fadeOut = equalPowerCurve('out');
    fadeIn.forEach((gain, i) => expect(gain ** 2 + (fadeOut[i] ?? 0) ** 2).toBeCloseTo(1, 5));
    expect(fadeIn[0]).toBe(0);
    expect(fadeOut[0]).toBe(1);
  });
});
