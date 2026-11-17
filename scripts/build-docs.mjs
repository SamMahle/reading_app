/**
 * Renders the PDFs in docs/ from the HTML sources in docs/src.
 * Screenshots come from `npm run screenshots` (docs/img).
 *
 *   npm run docs
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const docs = resolve(import.meta.dirname, '..', 'docs');
const targets = [
  {
    source: 'executive-summary.html',
    pdf: 'Reading-App-Executive-Summary.pdf',
    title: 'Reading App · Executive summary',
  },
  {
    source: 'manual.html',
    pdf: 'Reading-App-Manual.pdf',
    title: 'Reading App · Instruction manual',
  },
];
const footer = (title) => `
  <div style="width:100%;font:8pt Helvetica,Arial,sans-serif;color:#667;padding:0 0.85in;display:flex;justify-content:space-between">
    <span>${title}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>`;

const browser = await chromium.launch();
for (const { source, pdf, title } of targets) {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(resolve(docs, 'src', source)).toString(), {
    waitUntil: 'networkidle',
  });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: resolve(docs, pdf),
    format: 'Letter',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: footer(title),
  });
  await page.close();
  console.log(`wrote docs/${pdf}`);
}
await browser.close();
