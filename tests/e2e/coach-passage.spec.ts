import { expect, test } from '@playwright/test';
import { completeRoutine, openParent, openSection, readStore, start } from './helpers';

const FIXTURE =
  'I see Pam. She has a cat. The cat sits on the mat. Pam can pat the cat. Pam and her friend go to the pond. They stop at the top. I like to see Pam and her cat run.';

test.describe('Coach mode and Class Passage (spec §9)', () => {
  test('the fixture passage runs through pre-teach, then reading at rung 2', async ({ page }) => {
    await start(page);
    await openParent(page);
    await openSection(page, 'passage');
    await page.getByTestId('passage-title').fill('Week 12: Pam');
    await page.getByTestId('passage-text').fill(FIXTURE);
    await page.getByTestId('passage-check').click();

    // Classification matches the spec fixture.
    const analysis = page.getByTestId('passage-analysis');
    const keys = async (cls: string) => [
      ...new Set(
        (await analysis.locator(`[data-cls="${cls}"]`).allInnerTexts()).map((t) =>
          t.replace(/[^a-z]/giu, '').toLowerCase(),
        ),
      ),
    ];
    expect(await keys('not_yet')).toEqual(['sits', 'and', 'pond', 'stop', 'run']);
    expect(await keys('unknown')).toEqual([]);
    expect(await keys('decodable')).toEqual(['pam', 'cat', 'on', 'mat', 'can', 'pat', 'at', 'top']);
    await expect(page.getByTestId('preteach-note')).toContainText('sits, and, pond, stop, run');
    await page.getByTestId('passage-save').click();
    await expect(page.getByTestId('passage-list')).toContainText('Week 12: Pam');
    await page.getByTestId('parent-exit').click();

    // Coach: the passage is offered, and pre-teach comes first.
    await page.getByTestId('start-coach').click();
    await page.getByTestId('coach-passages').getByTestId('story-card').click();
    const preTeach = page.getByTestId('pre-teach');
    await expect(preTeach).toHaveAttribute('data-remaining', '5');
    for (const word of ['sits', 'and', 'pond', 'stop', 'run']) {
      await expect(page.getByTestId('sound-it-out')).toHaveAttribute('data-word', word);
      await expect(page.getByTestId('reader-text')).toHaveCount(0); // no passage text before pre-teach is done
      await expect(page.getByTestId('help-close')).toHaveCount(0);
      await completeRoutine(page);
    }

    // Reading at the starting rung (2: one phrase), with past text dimmed and future text hidden.
    const text = page.getByTestId('reader-text');
    await expect(text).toHaveAttribute('data-rung', '2');
    await expect(text.locator('[data-state="current"]')).toHaveCount(3); // "I see Pam."
    await expect(text.locator('[data-state="future"]').first()).toBeHidden();
    await page.getByTestId('mark-correct').click();
    await expect(text.locator('[data-state="past"]')).toHaveCount(3);

    // Score one word as "needed help" by long-pressing it, then finish the passage.
    const cat = text.locator('[data-testid=reader-word][data-key="cat"][data-state="current"]');
    await expect(cat).toHaveCount(1);
    const box = await cat.boundingBox();
    if (!box) throw new Error('no word');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await expect(page.getByTestId('parent-strip')).toContainText('Scoring “cat”');
    await page.getByTestId('mark-help').click();
    for (let i = 0; i < 40; i += 1) {
      if (await page.getByTestId('coach-summary').isVisible()) break;
      await page.getByTestId('mark-correct').click();
    }

    // 39 of 40 words correct: one star, and the stall word goes to the Solo queue in box 1.
    await expect(page.getByTestId('summary-accuracy')).toContainText('98%');
    await expect(page.getByTestId('summary-stars')).toHaveAttribute('data-stars', '1');
    await expect(page.getByTestId('summary-help-words')).toContainText('cat');
    const cards = await readStore<{ wordId: string; box: number }>(page, 'leitner');
    expect(cards).toEqual([expect.objectContaining({ wordId: 'cat', box: 1 })]);
    const attempts = await readStore<{ mode: string }>(page, 'attempts');
    expect(attempts).toHaveLength(40);

    // The passage is now due for its second read on the home screen.
    await page.getByTestId('summary-home').click();
    await expect(page.getByTestId('due-stories').locator('.due-card')).toHaveCount(1);
  });

  test('an unknown word must be resolved before a passage can be saved', async ({ page }) => {
    await start(page);
    await openParent(page);
    await openSection(page, 'passage');
    await page.getByTestId('passage-text').fill('Pam said yes to the cat.');
    await page.getByTestId('passage-check').click();
    await expect(page.getByTestId('passage-save')).toBeDisabled();
    const unknown = page.getByTestId('unknown-list');
    await expect(unknown.locator('li')).toHaveCount(2);

    // "said" becomes a one-time heart word; "yes" is added to the word list.
    await unknown.locator('[data-word="said"]').getByTestId('one-time-heart').click();
    await expect(page.getByTestId('seg-chip')).toHaveCount(4);
    await page.getByTestId('seg-chip').nth(1).getByRole('button', { name: 'Join next' }).click();
    await expect(page.getByTestId('seg-chip')).toHaveCount(3);
    await page.getByTestId('seg-chip').nth(1).getByRole('button', { name: '♥ irregular' }).click();
    await page.getByTestId('resolve-confirm').click();
    await unknown.locator('[data-word="yes"]').getByTestId('add-to-lexicon').click();
    await page.getByTestId('resolve-confirm').click();

    await expect(page.getByTestId('unknown-list')).toHaveCount(0);
    await expect(page.getByTestId('preteach-note')).toContainText('said');
    await expect(page.getByTestId('passage-save')).toBeEnabled();
    await page.getByTestId('passage-save').click();
    const custom = await readStore<{ id: string }>(page, 'customContent');
    expect(custom.map((entry) => entry.id)).toEqual(['yes']); // the one-time heart word stays with its passage
  });

  test('the ladder moves up after two Coach sessions at 90% or better', async ({ page }) => {
    await start(page);
    for (const story of ['big_pig', 'sad_cat']) {
      await page.goto(`/#/coach/read/${story}`);
      await expect(page.getByTestId('reader-text')).toBeVisible();
      for (let i = 0; i < 40; i += 1) {
        if (await page.getByTestId('coach-summary').isVisible()) break;
        await page.getByTestId('reader-next').click();
      }
      await expect(page.getByTestId('summary-accuracy')).toContainText('100%');
    }
    await expect(page.getByTestId('summary-ladder')).toContainText('Moving up');
    const [ladder] = await readStore<{ rung: number; history: { reason: string }[] }>(
      page,
      'ladder',
    );
    expect(ladder?.rung).toBe(3);
    expect(ladder?.history.map((h) => h.reason)).toEqual(['start', 'up']);
  });
});
