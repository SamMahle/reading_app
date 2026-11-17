import { expect, test } from '@playwright/test';
import { answerItem, completeRoutine, GUARD_WAIT_MS, readStore, start } from './helpers';

test.describe('Solo mode (spec §8)', () => {
  test('a 6-minute session completes end to end and ends on the closing item', async ({ page }) => {
    await start(page);
    await page.getByTestId('start-solo').click();
    const session = page.getByTestId('solo-session');
    await expect(session).toBeVisible();
    const total = Number(await session.getAttribute('data-total'));
    expect(total).toBeGreaterThanOrEqual(13);

    const kinds: string[] = [];
    for (let i = 0; i < total + 5; i += 1) {
      if (await page.getByTestId('session-finish').isVisible()) break;
      kinds.push(await answerItem(page));
    }
    await expect(page.getByTestId('session-finish')).toBeVisible();
    expect(kinds).toHaveLength(total);
    expect(new Set(kinds)).toEqual(new Set(['warmup-hear', 'build', 'pick', 'match']));
    // Activities come in order; the closing item is last.
    expect(kinds.indexOf('pick')).toBeGreaterThan(kinds.indexOf('warmup-hear'));
    expect(kinds.lastIndexOf('match')).toBeLessThan(kinds.length - 1);

    // New sentences join the Bookshelf.
    await expect(page.getByTestId('new-books').locator('.finish__book')).toHaveCount(3);
    await page.getByTestId('finish-home').click();
    await expect(page.locator('.day-dot--on')).toHaveCount(1);
    await page.getByTestId('open-shelf').click();
    await expect(page.getByTestId('shelf-book')).toHaveCount(3);

    const sessions = await readStore<{ mode: string; items: number; accuracy: number }>(
      page,
      'sessions',
    );
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ mode: 'solo', items: total, accuracy: 1 });
    const cards = await readStore<{ box: number }>(page, 'leitner');
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((card) => card.box === 2)).toBe(true); // correct with no help: up one box
  });

  test('a miss leads to the routine, then the model, then her own correct answer', async ({
    page,
  }) => {
    await start(page);
    await page.getByTestId('start-solo').click();
    const session = page.getByTestId('solo-session');
    // Work through to the first Pick the Word item.
    for (let i = 0; i < 12; i += 1) {
      if ((await page.locator('[data-activity]').getAttribute('data-activity')) === 'pick') break;
      await answerItem(page);
    }
    const activity = page.locator('[data-activity="pick"]');
    const target = (await activity.getAttribute('data-item')) ?? '';
    const totalBefore = Number(await session.getAttribute('data-total'));
    const wrong = page.locator(`[data-testid=choice]:not(:has([data-word="${target}"]))`).first();

    // First miss: no buzzer or red X, just the routine on the target word. It cannot be dismissed.
    await page.waitForTimeout(GUARD_WAIT_MS);
    await wrong.click();
    await expect(page.getByTestId('sound-it-out')).toHaveAttribute('data-word', target);
    await expect(page.getByTestId('help-close')).toHaveCount(0);
    await completeRoutine(page);

    // Second miss: the app models the word, then highlights the answer for her to tap.
    await page.waitForTimeout(GUARD_WAIT_MS);
    await wrong.click();
    await expect(page.getByTestId('model-word')).toBeVisible();
    await expect(page.getByTestId('model-word')).toBeHidden({ timeout: 15_000 });
    const highlighted = page.locator('.choice--highlight');
    await expect(highlighted).toHaveCount(1);
    await expect(highlighted.locator(`[data-word="${target}"]`)).toHaveCount(1);
    await page.waitForTimeout(GUARD_WAIT_MS);
    await highlighted.click();
    await expect(page.getByTestId('item-success')).toBeVisible();

    // The item is re-queued later in the same session, and its Leitner box resets.
    await expect(session).toHaveAttribute('data-total', String(totalBefore + 1));
  });
});
