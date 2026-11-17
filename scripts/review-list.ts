/**
 * Regenerates content/REVIEW.md, the parent's read-through list (spec §6.6).
 * Items already marked `true` in the existing file keep that mark.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONTENT } from '../src/content/index';
import { wordLevel } from '../src/engine/lexicon';
import type { AnyEntry } from '../src/engine/types';

const path = resolve(import.meta.dirname, '..', 'content', 'REVIEW.md');
const approved = new Set<string>();
if (existsSync(path)) {
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^\| `([^`]+)` \|.*\| true \|$/u.exec(line);
    if (match?.[1]) approved.add(match[1]);
  }
}
const mark = (key: string) => (approved.has(key) ? 'true' : 'false');
const segmentation = (entry: AnyEntry) =>
  entry.graphemes
    .map(
      (g, i) =>
        `${g.spelling}→${g.soundId}${entry.isHeartWord === true && entry.irregularIdx.includes(i) ? ' ♥' : ''}`,
    )
    .join(' · ');

const out: string[] = [
  '# Content review',
  '',
  'Every bundled word, sentence and story is listed here for the parent to read through (spec §6.6).',
  'All content was drafted for the app and passes `npm run validate-content`, but a person should still',
  'confirm each segmentation and each sentence. Change `false` to `true` in the last column as you approve',
  'an item. `npm run review-list` regenerates this file and keeps your `true` marks.',
  '',
  'Segmentation is written spelling→sound. ♥ marks a part that is irregular by nature.',
  '',
];

out.push(
  '## Heart words',
  '',
  '| id | word | segmentation | starts unlocked | reviewed |',
  '| --- | --- | --- | --- | --- |',
);
for (const h of CONTENT.heartWords) {
  out.push(
    `| \`heart:${h.id}\` | ${h.text} | ${segmentation(h)} | ${h.optional ? 'no (interest word)' : 'yes'} | ${mark(`heart:${h.id}`)} |`,
  );
}

for (const level of CONTENT.levels) {
  const words = CONTENT.words.filter((w) => wordLevel(w, CONTENT.levels) === level.id);
  if (words.length === 0) continue;
  out.push(
    '',
    `## Level ${level.id} words: ${level.title} (${words.length})`,
    '',
    '| id | word | segmentation | picture | reviewed |',
    '| --- | --- | --- | --- | --- |',
  );
  for (const w of words) {
    out.push(
      `| \`word:${w.id}\` | ${w.text} | ${segmentation(w)}${w.requires ? ` (+ ${w.requires.join(', ')})` : ''} | ${w.pictureId ?? ''} | ${mark(`word:${w.id}`)} |`,
    );
  }
}

out.push(
  '',
  `## Sentences (${CONTENT.sentences.length})`,
  '',
  '| id | level | sentence | scene | reviewed |',
  '| --- | --- | --- | --- | --- |',
);
for (const s of CONTENT.sentences) {
  const scene = s.scene
    ? [s.scene.subject, s.scene.relation === 'none' ? '' : s.scene.relation, s.scene.object]
        .filter(Boolean)
        .join(' ')
    : '';
  out.push(
    `| \`sentence:${s.id}\` | ${s.levelId}${s.bonus ? ` + ${s.bonus.join(', ')}` : ''} | ${s.text} | ${scene} | ${mark(`sentence:${s.id}`)} |`,
  );
}

out.push(
  '',
  `## Stories (${CONTENT.stories.length})`,
  '',
  '| id | level | title and pages | reviewed |',
  '| --- | --- | --- | --- |',
);
for (const story of CONTENT.stories) {
  const pages = story.pages
    .map((page, i) => `**${i + 1}.** ${page.map((s) => s.text).join(' ')}`)
    .join('<br>');
  out.push(
    `| \`story:${story.id}\` | ${story.levelId}${story.bonus ? ` + ${story.bonus.join(', ')}` : ''} | **${story.title}**<br>${pages} | ${mark(`story:${story.id}`)} |`,
  );
}

writeFileSync(path, `${out.join('\n')}\n`);
console.log(`Wrote ${path}`);
