import { useMemo, useRef, useState } from 'react';
import { useApp } from '@/app/AppData';
import { audio } from '@/audio/AudioService';
import { canRecord, startRecording, type ActiveRecording } from '@/audio/recorder';
import {
  requiredClips,
  soundClipsForUnlock,
  wordClipId,
  type ClipRequirement,
} from '@/content/audioManifest';
import { CONTENT } from '@/content/index';
import { classifyWord } from '@/engine/readability';
import { MicIcon, PlayIcon, StopIcon, TrashIcon } from '@/ui/icons';

interface Group {
  id: string;
  title: string;
  note: string;
  clips: ClipRequirement[];
  open: boolean;
}

/**
 * Sound Studio (spec §10.3): the parent records every clip on the iPad.
 * Each take is trimmed, normalized and faded, and overrides a bundled clip
 * with the same id.
 */
export function SoundStudio() {
  const app = useApp();
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [blendWord, setBlendWord] = useState('sat');
  const active = useRef<ActiveRecording | null>(null);
  const recorded = useMemo(() => new Set(app.recordedClips), [app.recordedClips]);

  const groups = useMemo<Group[]>(() => {
    const clips = requiredClips(CONTENT, app.custom);
    const soundsNow = new Set(soundClipsForUnlock(app.unlock, CONTENT, app.custom));
    const wordsNow = new Set(
      [...app.lexicon.words.values(), ...app.lexicon.heartWords.values()]
        .filter((entry) =>
          ['decodable', 'heart'].includes(classifyWord(entry.text, app.unlock, app.lexicon).cls),
        )
        .map((entry) => entry.audioWord ?? wordClipId(entry.id)),
    );
    const sounds = clips.filter((c) => c.kind === 'sound');
    const words = clips.filter((c) => c.kind === 'word');
    return [
      {
        id: 'sounds-now',
        title: 'Sounds she is using now',
        note: 'Record these first. Nothing in the app works well without them.',
        clips: sounds.filter((c) => soundsNow.has(c.clipId)),
        open: true,
      },
      {
        id: 'prompts',
        title: 'Spoken directions',
        note: 'Say each one warmly and clearly, as you would to her.',
        clips: clips.filter((c) => c.kind === 'prompt'),
        open: false,
      },
      {
        id: 'words-now',
        title: 'Words she can read now',
        note: 'Say the whole word naturally. She hears it only after sounding it out herself.',
        clips: words.filter((c) => wordsNow.has(c.clipId)),
        open: false,
      },
      {
        id: 'sounds-later',
        title: 'Sounds for later levels',
        note: 'Needed before those levels can be unlocked.',
        clips: sounds.filter((c) => !soundsNow.has(c.clipId)),
        open: false,
      },
      {
        id: 'words-later',
        title: 'Words for later levels',
        note: 'These can wait until the level is unlocked.',
        clips: words.filter((c) => !wordsNow.has(c.clipId)),
        open: false,
      },
    ];
  }, [app.custom, app.unlock, app.lexicon]);

  const toggleRecord = async (clipId: string) => {
    setMessage(null);
    if (recordingId === clipId && active.current) {
      const current = active.current;
      active.current = null;
      setRecordingId(null);
      try {
        const record = await current.stop();
        if (!record) setMessage('That take was silent. Check the microphone and try again.');
        else await app.saveRecording(record);
      } catch {
        setMessage('That take could not be saved. Please record it again.');
      }
      return;
    }
    active.current?.cancel();
    try {
      await audio.unlock();
      active.current = await startRecording(clipId);
      setRecordingId(clipId);
    } catch {
      setMessage(
        'The microphone is not available. Allow microphone access for this app in iPad Settings, then try again.',
      );
    }
  };

  const decodable = useMemo(
    () =>
      [...app.lexicon.words.values()]
        .filter((w) => classifyWord(w.text, app.unlock, app.lexicon).cls === 'decodable')
        .map((w) => w.id),
    [app.lexicon, app.unlock],
  );

  const testBlend = async () => {
    const entry = app.lexicon.words.get(blendWord);
    if (!entry) return;
    await audio.unlock();
    const played = await audio.playBlend(entry.graphemes);
    if (!played) setMessage(`Record every sound in “${blendWord}” first, then test the blend.`);
    else await audio.playWord(entry);
  };

  const all = groups.flatMap((g) => g.clips);
  const done = all.filter(
    (c) => audio.status(c.clipId) !== 'missing' || recorded.has(c.clipId),
  ).length;

  return (
    <div className="panel" data-testid="studio-panel">
      <h1>Sound Studio</h1>
      <p className="panel__lead">
        Record in a quiet room with the iPad about a hand’s width from your mouth. Each take is
        trimmed and levelled for you. {done} of {all.length} clips are ready.
      </p>
      {!canRecord() && (
        <p className="form-error">
          This browser cannot record audio. Open the app from the iPad home screen to record.
        </p>
      )}
      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}

      <section className="panel__section">
        <h2>Test blend</h2>
        <div className="form-row">
          <label className="field">
            <span>Word</span>
            <select value={blendWord} onChange={(event) => setBlendWord(event.target.value)}>
              {decodable.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="button"
            onClick={() => void testBlend()}
            data-testid="test-blend"
          >
            Play the blend
          </button>
        </div>
        <p className="panel__note">
          The sounds should run together smoothly, with no “uh” after b, d, g, p, t or k.
        </p>
      </section>

      {groups.map((group) => {
        const ready = group.clips.filter((c) => audio.status(c.clipId) !== 'missing').length;
        return (
          <details
            key={group.id}
            className="clip-group"
            open={group.open}
            data-testid={`clips-${group.id}`}
          >
            <summary>
              {group.title}{' '}
              <span className="clip-group__count">
                {ready} of {group.clips.length} ready
              </span>
            </summary>
            <p className="panel__note">{group.note}</p>
            <ul className="clip-list">
              {group.clips.map((clip) => {
                const status = audio.status(clip.clipId);
                const isRecording = recordingId === clip.clipId;
                return (
                  <li
                    key={clip.clipId}
                    className="clip-row"
                    data-clip={clip.clipId}
                    data-status={status}
                  >
                    <div className="clip-row__text">
                      <strong>{clip.label}</strong>
                      {clip.guidance && <span>{clip.guidance}</span>}
                    </div>
                    <span className={`status status--${status}`}>
                      {status === 'missing'
                        ? 'Not recorded'
                        : status === 'bundled'
                          ? 'Built in'
                          : 'Recorded'}
                    </span>
                    <button
                      type="button"
                      className={`icon-button${isRecording ? ' icon-button--recording' : ''}`}
                      aria-label={
                        isRecording ? `Stop recording ${clip.label}` : `Record ${clip.label}`
                      }
                      disabled={!canRecord() || (recordingId !== null && !isRecording)}
                      onClick={() => void toggleRecord(clip.clipId)}
                    >
                      {isRecording ? <StopIcon /> : <MicIcon />}
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Play ${clip.label}`}
                      disabled={status === 'missing'}
                      onClick={() => void audio.unlock().then(() => audio.play(clip.clipId))}
                    >
                      <PlayIcon />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Delete recording of ${clip.label}`}
                      disabled={status !== 'recorded'}
                      onClick={() => void app.deleteRecording(clip.clipId)}
                    >
                      <TrashIcon />
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
