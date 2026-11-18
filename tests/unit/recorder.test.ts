import { afterEach, describe, expect, it, vi } from 'vitest';
import { startRecording } from '@/audio/recorder';

/** A fake Safari: an audio session, a microphone and a MediaRecorder. */
function fakeSafari(getUserMedia: () => Promise<unknown>) {
  const session = { type: 'playback' };
  const seenDuringCapture: string[] = [];
  const track = { stop: vi.fn() };
  vi.stubGlobal('navigator', {
    audioSession: session,
    mediaDevices: {
      getUserMedia: () => {
        seenDuringCapture.push(session.type);
        return getUserMedia().then(() => ({ getTracks: () => [track] }));
      },
    },
  });
  vi.stubGlobal(
    'MediaRecorder',
    class {
      state = 'recording';
      mimeType = 'audio/mp4';
      addEventListener() {}
      start() {}
      stop() {
        this.state = 'inactive';
      }
    },
  );
  return { session, seenDuringCapture, track };
}

describe('Sound Studio audio session (iOS)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks for the microphone in play-and-record mode, then returns to playback', async () => {
    const safari = fakeSafari(() => Promise.resolve());
    const recording = await startRecording('snd_m');
    expect(safari.seenDuringCapture).toEqual(['play-and-record']);
    expect(safari.session.type).toBe('play-and-record');
    recording.cancel();
    expect(safari.track.stop).toHaveBeenCalled();
    expect(safari.session.type).toBe('playback');
  });

  it('returns to playback when microphone access is refused', async () => {
    const refused = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    const safari = fakeSafari(() => Promise.reject(refused));
    await expect(startRecording('snd_m')).rejects.toThrow('denied');
    expect(safari.session.type).toBe('playback');
  });
});
