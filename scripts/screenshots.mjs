/**
 * Walks through the built app and saves screenshots to docs/img (used by the
 * manual). Needs the preview server: `npm run build && npm run preview`.
 * The report screens use two weeks of clearly artificial sample history.
 *
 *   node scripts/screenshots.mjs [outDir] [width] [height]
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const root = resolve(import.meta.dirname, '..');
const out = resolve(process.argv[2] ?? resolve(root, 'docs', 'img'));
const width = Number(process.argv[3] ?? 1024);
const height = Number(process.argv[4] ?? 768);
const base = 'http://localhost:4173';
const lexicon = JSON.parse(readFileSync(resolve(root, 'content', 'lexicon.json'), 'utf8'));
const sentences = JSON.parse(readFileSync(resolve(root, 'content', 'sentences.json'), 'utf8'));
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 2,
  hasTouch: true,
});
const page = await context.newPage();
const problems = [];
page.on('pageerror', (error) => problems.push(String(error)));
const shot = async (name) => {
  await page.waitForTimeout(350);
  await page.screenshot({ path: resolve(out, `${name}.png`) });
};
const tid = (id) => page.locator(`[data-testid="${id}"]`);
const wait = (ms) => page.waitForTimeout(ms);

async function hold(locator, ms) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await wait(ms);
  await page.mouse.up();
}
async function slide() {
  const box = await tid('blend-slider').boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, y, { steps: 6 });
  await page.mouse.move(box.x + box.width + 30, y, { steps: 6 });
  await page.mouse.up();
}
async function tapDots() {
  const dots = tid('sound-it-out').locator('button[data-grapheme]');
  for (let i = 0; i < (await dots.count()); i += 1) await dots.nth(i).click();
}
const sceneKey = (scene) => {
  const layout =
    !scene.object || scene.relation === 'none'
      ? 'alone'
      : ['on', 'in'].includes(scene.relation)
        ? scene.relation
        : 'beside';
  return `${scene.subject}|${layout}|${layout === 'alone' ? '' : scene.object}`;
};
/** Answer the current Solo item; optionally screenshot it first. */
async function answer(shots) {
  const activity = page.locator('[data-activity]');
  const kind = await activity.getAttribute('data-activity');
  const item = await activity.getAttribute('data-item');
  const position = await tid('solo-session').getAttribute('data-position');
  await wait(1150);
  if (shots?.[kind]) {
    await shot(shots[kind]);
    delete shots[kind];
  }
  if (kind === 'warmup-hear') {
    await tid('grapheme-button').click();
    await wait(1150);
    await tid('next').click();
  } else if (kind === 'pick') {
    await page.locator(`[data-testid=choice]:has([data-word="${item}"])`).click();
  } else if (kind === 'build') {
    for (const g of lexicon.find((w) => w.id === item).graphemes) {
      await page.locator(`[data-testid=tile][data-spelling="${g.spelling}"]`).first().click();
      await wait(600);
    }
  } else if (kind === 'match') {
    await tid('read-done').click();
    await wait(1150);
    if (shots?.matchChoose) {
      await shot(shots.matchChoose);
      delete shots.matchChoose;
    }
    await page
      .locator(
        `[data-testid=choice]:has([data-scene="${sceneKey(sentences.find((s) => s.id === item).scene)}"])`,
      )
      .click();
  }
  await page.waitForFunction(
    ([p, k, i]) => {
      if (document.querySelector('[data-testid=session-finish]')) return true;
      const session = document.querySelector(`[data-testid=solo-session][data-position="${p}"]`);
      return !session || !session.querySelector(`[data-activity="${k}"][data-item="${i}"]`);
    },
    [position, kind, item],
  );
}

// ---- Start, home, a full Solo session --------------------------------------
await page.goto(base);
await shot('start');
await tid('start').click();
await shot('home-first-day');
await tid('start-solo').click();
const shots = {
  'warmup-hear': 'solo-warmup',
  build: 'solo-build',
  pick: 'solo-pick',
  match: 'solo-match-read',
  matchChoose: 'solo-match-choose',
};
let missed = false;
while (!(await tid('session-finish').count())) {
  const kind = await page.locator('[data-activity]').getAttribute('data-activity');
  if (kind === 'pick' && !missed && !shots.pick) {
    // One deliberate miss, to capture the sound-it-out routine.
    missed = true;
    const item = await page.locator('[data-activity]').getAttribute('data-item');
    await wait(1150);
    await page.locator(`[data-testid=choice]:not(:has([data-word="${item}"]))`).first().click();
    await tid('sound-it-out').waitFor();
    await shot('help-1-tap-sounds');
    await tapDots();
    await shot('help-2-slide');
    await slide();
    await tid('whole-word').waitFor();
    await shot('help-3-word');
    await tid('help-done').click();
  }
  await answer(shots);
}
await shot('solo-finish');
await tid('finish-home').click();
await tid('open-shelf').click();
await shot('bookshelf');

// ---- Coach: story list, reading, summary ------------------------------------
await page.goto(`${base}/#/coach`);
await tid('story-card').first().waitFor();
await shot('coach-home');
await page.goto(`${base}/#/coach/read/bot_in_a_pod`);
await tid('reader-text').waitFor();
await tid('mark-correct').click();
await shot('coach-read');
while (!(await tid('coach-summary').count())) await tid('mark-correct').click();
await shot('coach-summary');
await tid('summary-home').click();
await shot('home');

// ---- Parent area --------------------------------------------------------------
await hold(tid('parent-gear'), 3300);
await shot('parent-pin');
for (let round = 0; round < 2; round += 1)
  for (const d of '4821') await page.locator(`[data-digit="${d}"]`).click();
await tid('parent-panel').waitFor();

// Sample history for the report screenshots (two weeks, clearly artificial).
await page.evaluate(async () => {
  const DAY = 86400000;
  const now = Date.now();
  const db = await new Promise((done) => {
    const open = indexedDB.open('readingapp');
    open.onsuccess = () => done(open.result);
  });
  const tx = db.transaction(['attempts', 'sessions', 'ladder', 'leitner'], 'readwrite');
  const words = [
    'dog',
    'hot',
    'chip',
    'thin',
    'map',
    'pig',
    'log',
    'path',
    'cat',
    'pot',
    'bath',
    'hop',
  ];
  let n = 0;
  for (let day = 13; day >= 1; day -= 1) {
    const mode = day % 3 === 0 ? 'coach' : 'solo';
    const sessionId = `sample-${day}`;
    const ts = now - day * DAY;
    const helpRate = 0.34 - (13 - day) * 0.018;
    let ok = 0;
    for (let i = 0; i < 16; i += 1) {
      n += 1;
      const roll = ((n * 7919) % 100) / 100;
      const usedHelp = roll < helpRate;
      const completedHelp = usedHelp && ((n * 31) % 100) / 100 < 0.45 + (13 - day) * 0.04;
      const outcome = usedHelp ? (roll < 0.04 ? 'modeled' : 'helped') : 'correct';
      if (outcome === 'correct') ok += 1;
      tx.objectStore('attempts').put({
        id: `sample-${n}`,
        ts: ts + i * 20000,
        mode,
        activity: mode === 'coach' ? 'read' : 'pick',
        itemId: words[(n * 5) % words.length],
        outcome,
        usedHelp,
        completedHelp,
        sessionId,
      });
    }
    tx.objectStore('sessions').put({
      id: sessionId,
      ts,
      mode,
      durationMs: 360000 + day * 4000,
      items: 16,
      accuracy: ok / 16,
      helpOpened: 0,
      helpCompleted: 0,
      notes: [],
    });
  }
  tx.objectStore('ladder').put(
    {
      rung: 3,
      streak: 1,
      history: [
        { ts: now - 13 * DAY, rung: 2, reason: 'start' },
        { ts: now - 9 * DAY, rung: 1, reason: 'down' },
        { ts: now - 6 * DAY, rung: 2, reason: 'up' },
        { ts: now - 2 * DAY, rung: 3, reason: 'up' },
      ],
    },
    'ladder',
  );
  for (const [i, wordId] of words.entries())
    tx.objectStore('leitner').put({ wordId, box: (i % 4) + 1, dueTs: now, correctDays: [] });
  await new Promise((done) => {
    tx.oncomplete = done;
  });
  db.close();
});
await page.reload();
await tid('pin-screen').waitFor();
for (const d of '4821') await page.locator(`[data-digit="${d}"]`).click();
await tid('reports-panel').waitFor();
await shot('parent-reports');
await page.locator('.panel__section').nth(0).scrollIntoViewIfNeeded();
await page.evaluate(() => document.querySelector('.parent__content').scrollTo(0, 330));
await shot('parent-reports-charts');

const section = async (id, name) => {
  await page.locator(`[data-section="${id}"]`).click();
  await shot(name);
};
await section('levels', 'parent-levels');
await page.locator('[data-level="3"]').getByRole('switch').click();
await shot('parent-levels-preview');
await page.getByRole('button', { name: 'Cancel' }).click();
await section('heart', 'parent-heart');
await tid('heart-word-input').fill('and');
await tid('heart-propose').click();
await shot('parent-heart-add');
await section('words', 'parent-words');
await page.locator('[data-section="passage"]').click();
await tid('passage-title').fill('Week 12: Pam and her cat');
await tid('passage-text').fill(
  'I see Pam. She has a cat. The cat sits on the mat. Pam can pat the cat. Pam and her friend go to the pond. They said yes.',
);
await tid('passage-check').click();
await shot('parent-passage');
await section('studio', 'parent-studio');
await section('settings', 'parent-settings');
await section('backup', 'parent-backup');
await section('about', 'parent-about');

await browser.close();
if (problems.length > 0) {
  console.error('Page errors:', problems);
  process.exit(1);
}
console.log(`Screenshots written to ${out}`);
