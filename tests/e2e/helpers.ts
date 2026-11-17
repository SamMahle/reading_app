import { expect, type Locator, type Page } from '@playwright/test';
import lexiconJson from '../../content/lexicon.json' with { type: 'json' };
import sentencesJson from '../../content/sentences.json' with { type: 'json' };

/** The anti-guessing guard ignores taps for 1.0 s after a prompt or another tap. */
export const GUARD_WAIT_MS = 1150;
export const PIN = '4821';

const WORDS = new Map(lexiconJson.map((w) => [w.id, w.graphemes.map((g) => g.spelling)]));
const SENTENCES = new Map(sentencesJson.map((s) => [s.id, s]));

export async function start(page: Page, path = '/'): Promise<void> {
  await page.goto(`/#${path}`);
  await page.getByTestId('start').click();
}

async function drag(page: Page, slider: Locator): Promise<void> {
  const box = await slider.boundingBox();
  if (!box) throw new Error('Slider is not visible.');
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, y, { steps: 8 });
  await page.mouse.move(box.x + box.width + 30, y, { steps: 8 });
  await page.mouse.up();
}

/** Do the whole sound-it-out routine: tap every dot, slide to blend, tap done. */
export async function completeRoutine(page: Page): Promise<void> {
  const overlay = page.getByTestId('sound-it-out');
  await expect(overlay).toBeVisible();
  const word = await overlay.getAttribute('data-word');
  const dots = overlay.locator('button[data-grapheme]');
  const count = await dots.count();
  for (let i = 0; i < count; i += 1) await dots.nth(i).click();
  await drag(page, overlay.getByTestId('blend-slider'));
  await overlay.getByTestId('help-done').click();
  // In pre-teach the next word opens at once, so wait for THIS word to close.
  await expect(page.locator(`[data-testid=sound-it-out][data-word="${word}"]`)).toHaveCount(0);
}

export async function slideBlend(page: Page): Promise<void> {
  await drag(page, page.getByTestId('blend-slider'));
}

function sceneKey(scene: { subject: string; object?: string; relation?: string }): string {
  const { relation, object } = scene;
  let layout = 'alone';
  if (object && relation && relation !== 'none')
    layout = relation === 'on' || relation === 'in' ? relation : 'beside';
  return `${scene.subject}|${layout}|${layout === 'alone' ? '' : (object ?? '')}`;
}

/** Answer the Solo item on screen correctly, the way a careful learner would. */
export async function answerItem(page: Page): Promise<string> {
  const activity = page.locator('[data-activity]');
  await expect(activity).toBeVisible();
  const kind = (await activity.getAttribute('data-activity')) ?? '';
  const item = (await activity.getAttribute('data-item')) ?? '';
  const position = await page.getByTestId('solo-session').getAttribute('data-position');
  await page.waitForTimeout(GUARD_WAIT_MS);

  if (kind === 'warmup-hear') {
    await page.getByTestId('grapheme-button').click();
    await page.waitForTimeout(GUARD_WAIT_MS);
    await page.getByTestId('next').click();
  } else if (kind === 'warmup-find') {
    await page.locator(`[data-testid=choice]:has([data-spelling="${item}"])`).click();
  } else if (kind === 'pick') {
    await page.locator(`[data-testid=choice]:has([data-word="${item}"])`).click();
  } else if (kind === 'build') {
    for (const spelling of WORDS.get(item) ?? []) {
      await page.locator(`[data-testid=tile][data-spelling="${spelling}"]`).first().click();
      await page.waitForTimeout(600);
    }
  } else if (kind === 'match') {
    await page.getByTestId('read-done').click();
    await page.waitForTimeout(GUARD_WAIT_MS);
    const scene = SENTENCES.get(item)?.scene;
    if (!scene) throw new Error(`Sentence ${item} has no scene.`);
    await page.locator(`[data-testid=choice]:has([data-scene="${sceneKey(scene)}"])`).click();
  } else {
    throw new Error(`Unknown activity "${kind}".`);
  }

  // The item is done when the session moves on, or the finish screen appears.
  await expect(async () => {
    if ((await page.getByTestId('session-finish').count()) > 0) return;
    const session = page.locator(`[data-testid=solo-session][data-position="${position}"]`);
    const sameItem = session.locator(`[data-activity="${kind}"][data-item="${item}"]`);
    expect((await session.count()) === 0 || (await sameItem.count()) === 0).toBe(true);
  }).toPass({ timeout: 8000 });
  return kind;
}

/** Hold the gear for 3 s, then set or enter the PIN. */
export async function openParent(page: Page): Promise<void> {
  const gear = page.getByTestId('parent-gear');
  const box = await gear.boundingBox();
  if (!box) throw new Error('Gear is not visible.');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(3300);
  await page.mouse.up();
  await expect(page.getByTestId('pin-screen')).toBeVisible();
  const enter = async () => {
    for (const digit of PIN) await page.locator(`[data-digit="${digit}"]`).click();
  };
  const firstRun = await page.getByText('Choose a parent PIN').isVisible();
  await enter();
  if (firstRun) {
    await expect(page.getByText('Enter the PIN again')).toBeVisible();
    await enter();
  }
  await expect(page.getByTestId('parent-panel')).toBeVisible();
}

export async function openSection(page: Page, section: string): Promise<void> {
  await page.locator(`[data-section="${section}"]`).click();
}

/** Read every record of an IndexedDB store from the page. */
export function readStore<T>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(
    (name) =>
      new Promise<T[]>((resolve, reject) => {
        const open = indexedDB.open('readingapp');
        open.onerror = () => reject(new Error('Could not open the database.'));
        open.onsuccess = () => {
          const request = open.result.transaction(name).objectStore(name).getAll();
          request.onsuccess = () => {
            open.result.close();
            resolve(request.result as T[]);
          };
          request.onerror = () => reject(new Error(`Could not read ${name}.`));
        };
      }),
    store,
  );
}
