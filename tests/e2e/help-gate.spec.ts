import { expect, test } from '@playwright/test';
import { openParent, openSection, slideBlend, start } from './helpers';

test.describe('sound-it-out gate (spec §8.1)', () => {
  test('whole-word audio is unreachable until every dot is tapped and the blend is swiped', async ({
    page,
  }) => {
    await start(page, '/coach/read/dog_on_a_log');
    await page.locator('[data-testid=reader-word][data-key="dog"]').first().click();

    const overlay = page.getByTestId('sound-it-out');
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveAttribute('data-word', 'dog');
    const wholeWord = page.getByTestId('whole-word');
    const slider = page.getByTestId('blend-slider');
    const dots = overlay.locator('button[data-grapheme]');
    await expect(dots).toHaveCount(3);

    // Nothing tapped: no speaker button, and no slider to skip ahead with.
    await expect(wholeWord).toHaveCount(0);
    await expect(slider).toHaveCount(0);

    await dots.nth(0).click();
    await dots.nth(1).click();
    await expect(dots.nth(0)).toHaveAttribute('data-tapped', 'true');
    await expect(slider).toHaveCount(0);
    await expect(wholeWord).toHaveCount(0);

    // All dots tapped: the slider opens, but the word is still gated.
    await dots.nth(2).click();
    await expect(slider).toBeVisible();
    await expect(wholeWord).toHaveCount(0);

    // A partial drag that is let go returns to the start and does not count.
    const box = await slider.boundingBox();
    if (!box) throw new Error('no slider');
    await page.mouse.move(box.x + 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect(slider).toHaveAttribute('aria-valuenow', '0');
    await expect(wholeWord).toHaveCount(0);

    // A tap in the middle of the track is not a blend either.
    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height / 2);
    await expect(wholeWord).toHaveCount(0);

    // Full swipe, then the "Say the word" pause, and only then the speaker.
    await slideBlend(page);
    await expect(wholeWord).toHaveCount(0);
    await expect(wholeWord).toBeVisible({ timeout: 4000 });
    await wholeWord.click();
    await page.getByTestId('help-done').click();
    await expect(overlay).toBeHidden();
  });

  test('renders the split digraph in "like" with one dot under i, linked to e', async ({
    page,
  }) => {
    // The heart word list shows every heart word with its dots and hearts.
    await start(page);
    await openParent(page);
    await openSection(page, 'heart');
    const like = page.locator('[data-entry="like"] .word');
    await expect(like.locator('.word__split')).toHaveCount(1);
    await expect(like.locator('.word__arc')).toHaveCount(1);
    await expect(like.locator('.word__dot:not(.word__dot--none)')).toHaveCount(3); // l, i_e, k
    await expect(like.locator('.word__dot--none')).toHaveCount(1); // the silent e
    await expect(like.locator('.word__heart svg')).toHaveCount(3); // i and e (one grapheme), and k
  });
});
