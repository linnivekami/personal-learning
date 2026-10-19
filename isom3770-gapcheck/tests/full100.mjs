import fs from 'node:fs';
import { chromium, assert, url } from './harness.mjs';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.click('#countInput');
await page.fill('#countInput', '100');
await page.click('#startBtn');
await page.waitForSelector('#qtext');
assert(await page.locator('#palette .pnum').count() === 100, 'palette 100');
for (let i = 0; i < 100; i++) {
  await page.keyboard.press('e');
  if (i < 99) await page.keyboard.press('ArrowRight');
}
assert((await page.textContent('#headProgressText')).includes('100 / 100'), '100 answered');
await page.click('#submitSide');
await page.waitForSelector('dialog[open]');
await page.getByRole('button', { name: '确认交卷并诊断' }).click();
await page.waitForSelector('#exportBtn');
assert((await page.textContent('.stat-card.unknown b')).trim() === '100', '100 unknown');
assert(await page.locator('.review-item').count() === 100, '100 review items');
const [download] = await Promise.all([page.waitForEvent('download'), page.click('#exportBtn')]);
const p = await download.path();
const data = JSON.parse(fs.readFileSync(p, 'utf8'));
assert(data.summary.total === 100 && data.summary.unknown === 100, '100 export');
assert(data.sections.length === 12, '12 sections');
assert(data.topics.length > 60, 'topics');
assert(data.answers.length === 100, 'answers 100');
console.log(JSON.stringify({
  height: await page.evaluate(() => document.body.scrollHeight),
  topics: data.topics.length,
  sections: data.sections.map((s) => s.id),
  size: fs.statSync(p).size,
  errors,
}, null, 2));
await browser.close();
if (errors.length) process.exit(1);
