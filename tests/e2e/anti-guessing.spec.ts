import { expect, test } from '@playwright/test';
import { answerItem, start } from './helpers';

/** Small seeded generator so a failing run can be reproduced. */
function rng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

test.describe('anti-guessing guardrails (spec §8.4)', () => {
  for (const [name, stopAt] of [
    ['a sound warm-up', 'warmup-hear'],
    ['word building', 'build'],
    ['pick the word', 'pick'],
    ['read then match', 'match'],
  ] as const) {
    test(`rapid random tapping cannot complete ${name}`, async ({ page }) => {
      await start(page);
      await page.getByTestId('start-solo').click();
      const session = page.getByTestId('solo-session');
      for (let i = 0; i < 20; i += 1) {
        if ((await page.locator('[data-activity]').getAttribute('data-activity')) === stopAt) break;
        await answerItem(page);
      }
      const activity = page.locator('[data-activity]');
      await expect(activity).toHaveAttribute('data-activity', stopAt);
      const position = await session.getAttribute('data-position');
      const item = await activity.getAttribute('data-item');

      // 25 seconds of fast taps all over the screen (about 6 per second).
      const random = rng(stopAt.length * 7919);
      const started = Date.now();
      let sawSuccess = false;
      while (Date.now() - started < 25_000) {
        await page.mouse.click(40 + random() * 944, 110 + random() * 620);
        await page.waitForTimeout(90 + random() * 140);
        sawSuccess ||= await page.getByTestId('item-success').isVisible();
      }

      expect(sawSuccess).toBe(false);
      await expect(page.getByTestId('session-finish')).toHaveCount(0);
      await expect(session).toHaveAttribute('data-position', position ?? '');
      await expect(activity).toHaveAttribute('data-item', item ?? '');
    });
  }
});
