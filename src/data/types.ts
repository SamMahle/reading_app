import type { HeartWordEntry, Story } from '@/engine/types';

/** Persisted records that are not part of the engine's domain model. */

export type SessionMinutesSetting = 4 | 6 | 8;

export interface Settings {
  schemaVersion: number;
  /** SHA-256 of salt + PIN, hex. The PIN itself is never stored. */
  pinHash?: string;
  pinSalt?: string;
  sessionMinutes: SessionMinutesSetting;
  dailySoloLimit: number;
  stripSide: 'left' | 'right';
  /**
   * Parent opt-in: use the device's built-in voice for whole words and
   * prompts that have no recording yet. Never used for single sounds.
   */
  deviceVoice: boolean;
  /** Parent switch for a silent room: skips listening items (spec §13). */
  quietMode: boolean;
  lastBackupTs?: number;
  persistGranted?: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: 2,
  sessionMinutes: 6,
  dailySoloLimit: 2,
  stripSide: 'right',
  deviceVoice: false,
  quietMode: false,
};

export interface StoryRecord {
  /** Story id, sentence id, or class passage id. */
  id: string;
  type: 'story' | 'sentence' | 'class_passage';
  /** Completion timestamps, for the 3-star repeated-reading track. */
  reads: number[];
  /** When it joined the Bookshelf. */
  shelvedTs?: number;
  /** Class passages carry their own text and one-time heart words. */
  passage?: { story: Story; oneTimeHeartWords: HeartWordEntry[] };
}

export interface AudioRecord {
  clipId: string;
  mime: string;
  /** Processed recording (WAV). Stored as bytes, which every WebKit handles. */
  data: ArrayBuffer;
  ts: number;
}

export interface ErrorRecord {
  id: string;
  ts: number;
  mode: string;
  message: string;
  stack?: string;
}
