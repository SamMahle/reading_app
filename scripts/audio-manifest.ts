/**
 * Lists every audio clip the bundled content requires and reports which are
 * missing from assets/audio (spec §6.3). Pass --strict to exit non-zero when
 * any clip is missing, and --json for machine-readable output.
 *
 * Clips recorded in Sound Studio live on the device, not in the repo, so a
 * "missing" clip here only means it is not bundled.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { requiredClips, type ClipKind } from '../src/content/audioManifest';
import { CONTENT } from '../src/content/index';

const FOLDER: Record<ClipKind, string> = { sound: 'sounds', word: 'words', prompt: 'prompts' };
const EXTENSIONS = ['m4a', 'mp3', 'wav'];
const root = resolve(import.meta.dirname, '..', 'assets', 'audio');

const rows = requiredClips(CONTENT).map((clip) => {
  const file = EXTENSIONS.map((ext) =>
    resolve(root, FOLDER[clip.kind], `${clip.clipId}.${ext}`),
  ).find((path) => existsSync(path));
  return { ...clip, bundled: file !== undefined };
});

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  for (const kind of ['sound', 'word', 'prompt'] as const) {
    const group = rows.filter((r) => r.kind === kind);
    const missing = group.filter((r) => !r.bundled);
    console.log(
      `\n${kind.toUpperCase()}S: ${group.length} required, ${missing.length} not bundled`,
    );
    for (const row of group) {
      const level = row.levelId === undefined ? '' : `  [Level ${row.levelId}]`;
      console.log(`  ${row.bundled ? '✓' : '·'} ${row.clipId.padEnd(18)} ${row.label}${level}`);
    }
  }
  const missing = rows.filter((r) => !r.bundled).length;
  console.log(
    `\n${rows.length} clips required, ${missing} not bundled. Record missing clips in Sound Studio, or add files under assets/audio.`,
  );
}
if (process.argv.includes('--strict') && rows.some((r) => !r.bundled)) process.exit(1);
