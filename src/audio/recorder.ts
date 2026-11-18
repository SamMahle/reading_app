import type { AudioRecord } from '@/data/types';
import { audio, setAudioSessionType } from './AudioService';
import { encodeWav, mixToMono, processRecording } from './processing';

/**
 * Sound Studio capture (spec §10.3): MediaRecorder (Safari produces
 * audio/mp4), then trim, normalize and fade, stored as WAV.
 */
export interface ActiveRecording {
  /** Stop and return the processed clip, or undefined for a silent take. */
  stop(): Promise<AudioRecord | undefined>;
  cancel(): void;
}

export function canRecord(): boolean {
  return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

export async function startRecording(clipId: string): Promise<ActiveRecording> {
  // The normal "playback" session blocks the microphone on iOS.
  setAudioSessionType('play-and-record');
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: false },
    });
  } catch (error) {
    setAudioSessionType('playback');
    throw error;
  }
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });
  recorder.start();
  const release = () => {
    stream.getTracks().forEach((track) => track.stop());
    setAudioSessionType('playback');
  };

  return {
    stop: () =>
      new Promise((resolve, reject) => {
        recorder.addEventListener('stop', () => {
          release();
          void (async () => {
            try {
              const raw = await new Blob(chunks, { type: recorder.mimeType }).arrayBuffer();
              const decoded = await audio.decodeToBuffer(raw);
              const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) =>
                decoded.getChannelData(i),
              );
              const processed = processRecording(mixToMono(channels), decoded.sampleRate);
              if (processed.length === 0) {
                resolve(undefined);
                return;
              }
              resolve({
                clipId,
                mime: 'audio/wav',
                data: encodeWav(processed, decoded.sampleRate),
                ts: Date.now(),
              });
            } catch (error) {
              reject(
                error instanceof Error ? error : new Error('The recording could not be processed.'),
              );
            }
          })();
        });
        recorder.stop();
      }),
    cancel: () => {
      if (recorder.state !== 'inactive') recorder.stop();
      release();
    },
  };
}
