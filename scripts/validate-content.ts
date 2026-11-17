/**
 * Runs the decodability checker and structural checks over all bundled
 * content. Exits non-zero on any failure (used in CI, spec §6.4).
 */
import { CONTENT } from '../src/content/index';
import { validateContent } from '../src/content/validate';

const errors = validateContent(CONTENT);
if (errors.length > 0) {
  console.error(`Content validation failed with ${errors.length} problem(s):\n`);
  for (const error of errors) console.error(`  ✗ ${error}`);
  process.exit(1);
}
console.log(
  `Content OK: ${CONTENT.words.length} words, ${CONTENT.heartWords.length} heart words, ` +
    `${CONTENT.sentences.length} sentences, ${CONTENT.stories.length} stories.`,
);
