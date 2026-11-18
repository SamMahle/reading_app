import { expect, test } from '@playwright/test';
import { answerItem, start } from './helpers';

test.describe('offline (spec §4, Phase 3)', () => {
  test('cold start with no network works, with content, pictures and font', async ({
    page,
    context,
    browserName,
  }) => {
    // Playwright's WebKit cannot load a page from a service worker while
    // offline ("WebKit encountered an internal error" on reload); its service
    // worker support is Chromium-only. CI runs this test in Chromium instead,
    // and real Safari is covered by the offline section of DEVICE_CHECKLIST.md.
    test.skip(
      browserName === 'webkit',
      'Service-worker offline loads need Chromium in Playwright.',
    );
    // First visit online: the service worker installs and precaches everything.
    await page.goto('/');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
        timeout: 20_000,
      })
      .toBe(true);

    // Record any request that would leave the device.
    const external: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.hostname !== 'localhost') external.push(request.url());
    });

    await context.setOffline(true);
    await page.reload();
    await page.getByTestId('start').click();
    await expect(page.getByTestId('home')).toBeVisible();
    // The reading font loads from the precache.
    expect(
      await page.evaluate(async () => (await document.fonts.load('40px Andika')).length),
    ).toBeGreaterThan(0);

    // Solo works offline, pictures included.
    await page.getByTestId('start-solo').click();
    for (let i = 0; i < 16; i += 1) {
      const kind = await page.locator('[data-activity]').getAttribute('data-activity');
      if (kind === 'pick' || kind === 'build') break;
      await answerItem(page);
    }
    const picture = page.locator('.prompt-picture img');
    await expect(picture).toBeVisible();
    expect(
      await picture.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
    ).toBe(true);

    // Coach works offline too.
    await page.goto('/#/coach');
    await page.reload();
    await page.getByTestId('start').click();
    await expect(page.getByTestId('story-card').first()).toBeVisible();
    expect(external).toEqual([]);
  });

  test('progress survives closing and reopening the app', async ({ page, context }) => {
    await start(page);
    await page.getByTestId('start-solo').click();
    await answerItem(page);
    await answerItem(page);
    // Leave part-way: hold the home button.
    const exit = page.getByTestId('exit-session');
    const box = await exit.boundingBox();
    if (!box) throw new Error('no exit button');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(2300);
    await page.mouse.up();
    await expect(page.getByTestId('home')).toBeVisible();
    await page.close();

    const reopened = await context.newPage();
    await reopened.goto('/');
    const attempts = await reopened.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const open = indexedDB.open('readingapp');
          open.onsuccess = () => {
            const count = open.result.transaction('attempts').objectStore('attempts').count();
            count.onsuccess = () => resolve(count.result);
          };
        }),
    );
    expect(attempts).toBe(2);
  });

  test('ships a valid installable manifest with icons', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const manifest = (await (
      await request.get(new URL(href ?? '', page.url()).toString())
    ).json()) as {
      display: string;
      icons: { src: string; sizes: string }[];
    };
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.map((icon) => icon.sizes)).toContain('512x512');
    for (const icon of manifest.icons) {
      expect(
        (await request.get(new URL(icon.src, new URL(href ?? '', page.url())).toString())).ok(),
      ).toBe(true);
    }
    const touchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
    expect((await request.get(new URL(touchIcon ?? '', page.url()).toString())).ok()).toBe(true);
  });
});
