import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { answerItem, openParent, openSection, PIN, readStore, start } from './helpers';

async function exportBackup(
  page: Page,
): Promise<{ path: string; json: { stores: Record<string, unknown[]> } }> {
  await openSection(page, 'backup');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-backup').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^readingapp-backup-\d{8}\.json$/u);
  const path = await download.path();
  return {
    path,
    json: JSON.parse(await readFile(path, 'utf8')) as { stores: Record<string, unknown[]> },
  };
}

/** Everything except the timestamp the export itself writes. */
function comparable(stores: Record<string, unknown[]>) {
  const settings = (stores.settings ?? []).map((row) => ({ ...(row as object), lastBackupTs: 0 }));
  return { ...stores, settings };
}

test.describe('parent panel (spec §10)', () => {
  test('the PIN is never stored in plaintext, and a wrong PIN does not open the panel', async ({
    page,
  }) => {
    await start(page);
    await openParent(page);
    const [settings] = await readStore<Record<string, unknown>>(page, 'settings');
    expect(settings?.pinHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(JSON.stringify(settings)).not.toContain(PIN);
    expect(
      await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
    ).not.toContain(PIN);

    await page.getByTestId('parent-exit').click();
    const gear = page.getByTestId('parent-gear');
    // A short press on the gear does nothing: it needs a 3 second hold.
    await gear.click();
    await expect(page.getByTestId('pin-screen')).toHaveCount(0);
    const box = await gear.boundingBox();
    if (!box) throw new Error('no gear');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(3300);
    await page.mouse.up();
    for (const digit of '0000') await page.locator(`[data-digit="${digit}"]`).click();
    await expect(page.getByText('That PIN is not right')).toBeVisible();
    await expect(page.getByTestId('parent-panel')).toHaveCount(0);
  });

  test('a new heart word added in the panel is available to her straight away', async ({
    page,
  }) => {
    await start(page);
    await openParent(page);
    await openSection(page, 'heart');
    await page.getByTestId('heart-word-input').fill('and');
    await page.getByTestId('heart-propose').click();
    await expect(page.getByTestId('seg-chip')).toHaveCount(3);
    await page.getByTestId('heart-save').click();
    await expect(page.locator('[data-entry="and"]')).toContainText('added by you');

    const [unlock] = await readStore<{ heartWords: string[] }>(page, 'unlock');
    expect(unlock?.heartWords).toContain('and');
    // The checker now accepts text with "and" (it was "not taught yet" before).
    await openSection(page, 'passage');
    await page.getByTestId('passage-text').fill('Pam and Sam sat.');
    await page.getByTestId('passage-check').click();
    await expect(page.getByTestId('passage-analysis').locator('[data-cls="heart"]')).toHaveText(
      /and/u,
    );
    await expect(page.getByTestId('passage-analysis').locator('[data-cls="not_yet"]')).toHaveCount(
      0,
    );
  });

  test('unlocking a level shows a preview first, and is blocked while its sounds are missing', async ({
    page,
  }) => {
    await start(page);
    await openParent(page);
    await openSection(page, 'levels');
    // Level 4 only needs /s/ and /z/... which are not recorded in this clean install.
    await page.locator('[data-level="5"]').getByRole('switch').click();
    await expect(page.getByTestId('level-blocked')).toContainText('/sh/');
    await expect(page.getByTestId('unlock-preview')).toHaveCount(0);

    // Locking a level previews what will disappear, and Cancel changes nothing.
    await page.locator('[data-level="3"]').getByRole('switch').click();
    const preview = page.getByTestId('unlock-preview');
    await expect(preview).toContainText('Lock Level 3');
    await expect(preview).toContainText('-13 words');
    await preview.getByRole('button', { name: 'Cancel' }).click();
    expect((await readStore<{ levels: number[] }>(page, 'unlock'))[0]?.levels).toEqual([1, 2, 3]);

    await page.locator('[data-level="3"]').getByRole('switch').click();
    await page.getByTestId('apply-unlock').click();
    expect((await readStore<{ levels: number[] }>(page, 'unlock'))[0]?.levels).toEqual([1, 2]);
  });

  test('backup, clean install, import restores all stores exactly', async ({ page, browser }) => {
    // Create some real data: a few Solo items, a Coach read, a custom word, a setting.
    await start(page);
    await page.getByTestId('start-solo').click();
    await answerItem(page);
    await answerItem(page);
    await page.goto('/#/coach/read/big_pig');
    for (let i = 0; i < 40; i += 1) {
      if (await page.getByTestId('coach-summary').isVisible()) break;
      await page.getByTestId('reader-next').click();
    }
    await page.getByTestId('summary-home').click();
    await openParent(page);
    await openSection(page, 'words');
    await page.getByTestId('word-input').fill('zag');
    await page.getByTestId('word-propose').click();
    await page.getByTestId('word-save').click();
    await openSection(page, 'settings');
    await page.locator('[data-minutes="8"]').click();
    const original = await exportBackup(page);
    expect(original.json.stores.attempts?.length).toBeGreaterThan(10);
    expect(original.json.stores.customContent).toHaveLength(1);

    // A clean install: a brand new browser context with empty storage.
    const fresh = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    const page2 = await fresh.newPage();
    await start(page2);
    await openParent(page2);
    await openSection(page2, 'backup');
    await expect(page2.getByTestId('last-backup')).toContainText('No backup has been made yet');

    // A file that is not a backup is refused.
    await page2.getByTestId('import-file').setInputFiles({
      name: 'x.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"app":"other"}'),
    });
    await expect(page2.getByTestId('backup-message')).toContainText('not a Reading App backup');
    await expect(page2.getByTestId('import-confirm')).toHaveCount(0);

    await page2.getByTestId('import-file').setInputFiles(original.path);
    await expect(page2.getByTestId('import-confirm')).toContainText('Nothing is merged');
    await page2.getByTestId('import-apply').click();
    await expect(page2.getByTestId('backup-message')).toContainText('Backup imported');

    const restored = await exportBackup(page2);
    expect(comparable(restored.json.stores)).toEqual(comparable(original.json.stores));
    await fresh.close();
  });
});
