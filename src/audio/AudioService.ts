import { soundClipId, wordClipId } from '@/content/audioManifest';
import { CONTENT } from '@/content/index';
import type { AudioRecord } from '@/data/types';
import type { AnyEntry, Grapheme } from '@/engine/types';
import { equalPowerCurve, planBlend } from './blendPlan';
import { sustainLoop } from './processing';
import { speak, stopSpeaking } from './speech';

/**
 * Audio playback (spec §12). One AudioContext, created up front and resumed
 * on the first user gesture (an iOS requirement). Clips are decoded into
 * AudioBuffers ahead of time so a tap plays with no perceptible delay.
 * Sound Studio recordings override bundled clips with the same id.
 */

export type ClipStatus = 'missing' | 'bundled' | 'recorded';

export interface SustainHandle {
  stop(): void;
}

// Bundled clips: any file dropped into assets/audio is picked up at build time.
const BUNDLED_URLS: Record<string, string> = import.meta.glob(
  '../../assets/audio/**/*.{m4a,mp3,wav}',
  {
    eager: true,
    query: '?url',
    import: 'default',
  },
);

function clipIdFromPath(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1).replace(/\.[^.]+$/u, '');
}

const PROMPT_TEXT = new Map(CONTENT.prompts.map((p) => [p.id, p.text]));

/**
 * Silence between a spoken direction and the target sound or word that
 * follows it ("Build the word." … "mat"), so the two never run together.
 * Recordings are trimmed to the voice, and the iPad's voice reports that it
 * has finished slightly early, so the gap must be deliberate.
 */
export const PROMPT_GAP_MS = 750;

export type AudioSessionType = 'playback' | 'play-and-record';

/**
 * Safari 17+ audio session (navigator.audioSession). "playback" makes the app
 * a media player, so the iPhone's Ring/Silent switch does not mute it (by
 * default Web Audio counts as a sound effect and is silenced). "playback"
 * does not allow the microphone, so Sound Studio switches to
 * "play-and-record" while it records, then back. Older Safari ignores this.
 */
export function setAudioSessionType(type: AudioSessionType): void {
  // `navigator.audioSession` is a WebKit API not yet in TypeScript's DOM types.
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (!session) return;
  try {
    session.type = type;
  } catch {
    // Not supported: keep the default behaviour.
  }
}

/** iOS only lets speech start after one utterance is spoken inside a tap. */
function unlockSpeech(): void {
  if (!('speechSynthesis' in window)) return;
  const silent = new SpeechSynthesisUtterance(' ');
  silent.volume = 0;
  window.speechSynthesis.speak(silent);
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
const NO_HANDLE: SustainHandle = { stop: () => undefined };
const FADE_OUT_S = 0.03;

type AudioContextCtor = typeof AudioContext;

export class AudioService {
  private ctx: AudioContext | undefined;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly recorded = new Map<string, AudioRecord>();
  private readonly bundled = new Map<string, string>(
    Object.entries(BUNDLED_URLS).map(([path, url]) => [clipIdFromPath(path), url]),
  );
  private readonly active = new Set<AudioBufferSourceNode>();
  private readonly listeners = new Set<() => void>();
  private loading = new Map<string, Promise<void>>();

  /** Parent opt-in: speak un-recorded words and prompts with the device voice. */
  deviceVoice = false;
  /** Parent switch: no sound at all (listening items are skipped). */
  quiet = false;

  private context(): AudioContext | undefined {
    if (this.ctx) return this.ctx;
    const Ctor: AudioContextCtor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!Ctor) return undefined;
    this.ctx = new Ctor({ latencyHint: 'interactive' });
    return this.ctx;
  }

  /**
   * Call from a user gesture. Everything here that iOS ties to the gesture
   * runs synchronously, before the first await.
   */
  async unlock(): Promise<void> {
    setAudioSessionType('playback');
    unlockSpeech();
    const ctx = this.context();
    if (!ctx) return;
    try {
      const source = ctx.createBufferSource();
      source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      source.connect(ctx.destination);
      source.start();
      if (ctx.state !== 'running') await ctx.resume();
    } catch {
      // Audio stays unavailable; listening items are skipped (spec §13).
    }
    this.notify();
  }

  /** True when sound can actually be produced right now. */
  get running(): boolean {
    return !this.quiet && this.ctx?.state === 'running';
  }

  get speechFallback(): boolean {
    return !this.quiet && (import.meta.env.DEV || this.deviceVoice);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  status(clipId: string): ClipStatus {
    if (this.recorded.has(clipId)) return 'recorded';
    return this.bundled.has(clipId) ? 'bundled' : 'missing';
  }

  has(clipId: string): boolean {
    return this.status(clipId) !== 'missing';
  }

  /** True when a word can be heard: its clip exists, or the voice fallback is on. */
  canSayWord(entry: AnyEntry): boolean {
    return this.has(entry.audioWord ?? wordClipId(entry.id)) || this.speechFallback;
  }

  /** Register Sound Studio recordings loaded from IndexedDB. */
  setRecordings(records: readonly AudioRecord[]): void {
    this.recorded.clear();
    for (const record of records) this.recorded.set(record.clipId, record);
    this.buffers.clear();
    this.loading.clear();
    this.notify();
  }

  async setRecording(record: AudioRecord): Promise<void> {
    this.recorded.set(record.clipId, record);
    this.buffers.delete(record.clipId);
    this.loading.delete(record.clipId);
    await this.load(record.clipId);
    this.notify();
  }

  removeRecording(clipId: string): void {
    this.recorded.delete(clipId);
    this.buffers.delete(clipId);
    this.loading.delete(clipId);
    this.notify();
  }

  private async decode(clipId: string): Promise<void> {
    const ctx = this.context();
    if (!ctx) return;
    const recording = this.recorded.get(clipId);
    const url = this.bundled.get(clipId);
    let bytes: ArrayBuffer | undefined;
    if (recording) bytes = recording.data.slice(0);
    else if (url) bytes = await (await fetch(url)).arrayBuffer();
    if (!bytes) return;
    try {
      this.buffers.set(clipId, await ctx.decodeAudioData(bytes));
    } catch (error) {
      console.warn(`Could not decode audio clip "${clipId}".`, error);
    }
  }

  private load(clipId: string): Promise<void> {
    if (this.buffers.has(clipId)) return Promise.resolve();
    let pending = this.loading.get(clipId);
    if (!pending) {
      pending = this.decode(clipId);
      this.loading.set(clipId, pending);
    }
    return pending;
  }

  /** Decode clips ahead of use (spec §12: preload at launch). */
  async preload(clipIds: readonly string[]): Promise<void> {
    await Promise.all(clipIds.filter((id) => this.has(id)).map((id) => this.load(id)));
  }

  private startSource(
    buffer: AudioBuffer,
    when: number,
    gain?: GainNode,
  ): AudioBufferSourceNode | undefined {
    const ctx = this.ctx;
    if (!ctx) return undefined;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain ?? ctx.destination);
    this.active.add(source);
    source.onended = () => this.active.delete(source);
    source.start(when);
    return source;
  }

  /** Play a clip once. Resolves when it ends; resolves at once if it cannot play. */
  async play(clipId: string): Promise<boolean> {
    if (!this.running || !this.has(clipId)) return false;
    await this.load(clipId);
    const buffer = this.buffers.get(clipId);
    const ctx = this.ctx;
    if (!buffer || !ctx) return false;
    return new Promise((resolve) => {
      const source = this.startSource(buffer, 0);
      if (!source) {
        resolve(false);
        return;
      }
      source.addEventListener('ended', () => resolve(true));
    });
  }

  playSound(grapheme: Pick<Grapheme, 'soundId'>): Promise<boolean> {
    return this.play(soundClipId(grapheme.soundId));
  }

  /**
   * Scrub playback for the BlendSlider: a continuous sound loops its sustain
   * segment until stopped; a stop sound plays once.
   */
  startSustain(grapheme: Pick<Grapheme, 'soundId' | 'continuous'>): SustainHandle {
    const clipId = soundClipId(grapheme.soundId);
    const ctx = this.ctx;
    const buffer = this.buffers.get(clipId);
    if (!this.running || !ctx || !buffer) {
      void this.load(clipId);
      return NO_HANDLE;
    }
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    const source = this.startSource(buffer, 0, gain);
    if (!source) return NO_HANDLE;
    if (!grapheme.continuous) return NO_HANDLE; // a stop sound just plays out
    const loop = sustainLoop(buffer.duration);
    source.loop = true;
    source.loopStart = loop.start;
    source.loopEnd = loop.end;
    return {
      stop: () => {
        const now = ctx.currentTime;
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + FADE_OUT_S);
        try {
          source.stop(now + FADE_OUT_S);
        } catch {
          // Already stopped.
        }
      },
    };
  }

  /** Auto-blend for the modeling step: clips back to back, crossfaded. */
  async playBlend(
    graphemes: readonly Pick<Grapheme, 'soundId' | 'continuous'>[],
  ): Promise<boolean> {
    const ctx = this.ctx;
    const ids = graphemes.map((g) => soundClipId(g.soundId));
    if (!this.running || !ctx || !ids.every((id) => this.has(id))) return false;
    await this.preload(ids);
    const buffers = ids.map((id) => this.buffers.get(id));
    if (buffers.some((b) => !b)) return false;
    const clips = graphemes.map((g, i) => ({
      duration: buffers[i]?.duration ?? 0,
      continuous: g.continuous,
    }));
    const { schedule, total } = planBlend(clips);
    const t0 = ctx.currentTime + 0.03;
    schedule.forEach((slot, i) => {
      const buffer = buffers[i];
      if (!buffer) return;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      const start = t0 + slot.start;
      if (slot.fadeIn > 0) gain.gain.setValueCurveAtTime(equalPowerCurve('in'), start, slot.fadeIn);
      if (slot.fadeOut > 0) {
        gain.gain.setValueCurveAtTime(
          equalPowerCurve('out'),
          start + buffer.duration - slot.fadeOut,
          slot.fadeOut,
        );
      }
      this.startSource(buffer, start, gain);
    });
    await new Promise((resolve) => window.setTimeout(resolve, (total + 0.05) * 1000));
    return true;
  }

  /** Whole-word audio: the recording, or the device voice if allowed. */
  async playWord(entry: AnyEntry): Promise<boolean> {
    if (this.quiet) return false;
    const clipId = entry.audioWord ?? wordClipId(entry.id);
    if (await this.play(clipId)) return true;
    if (!this.speechFallback) return false;
    await speak(entry.id === 'i' ? 'I' : entry.text);
    return true;
  }

  /**
   * A spoken direction, then a clear pause, then the target audio. The pause
   * is skipped when the direction could not be played (nothing to separate).
   */
  async playPromptThen(promptId: string, target: () => Promise<unknown>): Promise<void> {
    if (await this.playPrompt(promptId)) await wait(PROMPT_GAP_MS);
    await target();
  }

  /** A spoken direction. Resolves when it has finished (or cannot play). */
  async playPrompt(promptId: string): Promise<boolean> {
    if (this.quiet) return false;
    if (await this.play(promptId)) return true;
    const text = PROMPT_TEXT.get(promptId);
    if (!this.speechFallback || !text) return false;
    await speak(text);
    return true;
  }

  /** Soft two-note chime for a correct answer. Synthesized, so it needs no file. */
  chime(): void {
    const ctx = this.ctx;
    if (!this.running || !ctx) return;
    const now = ctx.currentTime;
    [659.25, 880].forEach((frequency, i) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      const start = now + i * 0.11;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.16, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.55);
    });
  }

  stopAll(): void {
    for (const source of this.active) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    }
    this.active.clear();
    stopSpeaking();
  }

  /** Decode a fresh recording to mono samples (Sound Studio). */
  async decodeToBuffer(bytes: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = this.context();
    if (!ctx) throw new Error('Audio is not available on this device.');
    return ctx.decodeAudioData(bytes);
  }
}

export const audio = new AudioService();
