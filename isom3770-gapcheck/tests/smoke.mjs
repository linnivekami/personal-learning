import fs from 'node:fs';
import path from 'node:path';
import { chromium, assert, root, url, out } from './harness.mjs';

fs.mkdirSync(out, { recursive: true });
const bank = JSON.parse(fs.readFileSync(path.join(root, 'isom3770-gapcheck', 'src', 'bank.json'), 'utf8'));

const browser = await chromium.launch({ headless: true });
const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

await page.goto(url);
await page.waitForSelector('#heroStart');
assert((await page.title()).includes('ISOM 3770'), 'title');
assert(await page.locator('.preset.on').textContent() === '100', 'default 100');
await page.screenshot({ path: path.join(out, '01-setup.png'), fullPage: true });

// Count selection.
await page.click('.preset[data-count="20"]');
assert((await page.textContent('#startBtn')).includes('20'), 'start button count');
await page.click('#startBtn');
await page.waitForSelector('#qtext');
assert((await page.textContent('#headProgressText')).includes('/ 20'), '20-question exam');
assert(await page.locator('#submitTop').isDisabled(), 'submit disabled before answers');
await page.screenshot({ path: path.join(out, '02-exam.png'), fullPage: true });

const plan = [];
for (let i = 0; i < 20; i++) {
  const text = await page.textContent('#qtext');
  const question = bank.find((item) => item.question === text);
  assert(question, `question ${i + 1} in bank`);
  let choice;
  if (i < 6) choice = question.answer;
  else if (i < 10) choice = (question.answer + 1) % 4;
  else choice = 4;
  plan.push({ id: question.id, choice });
  await page.click(`#options [data-opt="${choice}"]`);
  if (i < 19) await page.click('#nextBtn');
}

assert((await page.textContent('#headProgressText')).includes('20 / 20'), 'all answered');
assert(await page.textContent('#pUnknown') === '10', 'unknown count 10');
assert(!(await page.locator('#submitSide').isDisabled()), 'submit enabled');

await page.click('#submitSide');
await page.waitForSelector('dialog[open]');
await page.getByRole('button', { name: '确认交卷并诊断' }).click();
await page.waitForSelector('#exportBtn');
await page.screenshot({ path: path.join(out, '03-report.png'), fullPage: true });

const stat = async (cls) => (await page.textContent(`.stat-card.${cls} b`)).trim();
assert(await stat('correct') === '6', `correct 6, got ${await stat('correct')}`);
assert(await stat('wrong') === '4', `wrong 4, got ${await stat('wrong')}`);
assert(await stat('unknown') === '10', `unknown 10, got ${await stat('unknown')}`);
assert((await page.textContent('.report-hero .score-num')).trim() === '30', 'score 30%');

// Filters.
await page.click('[data-filter="gaps"]');
assert(await page.locator('.review-item').count() === 14, 'gap review count 14');
await page.click('[data-filter="unknown"]');
assert(await page.locator('.review-item').count() === 10, 'unknown review count 10');

// Export.
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.click('#exportBtn'),
]);
const downloadPath = await download.path();
const payload = JSON.parse(fs.readFileSync(downloadPath, 'utf8'));
assert(payload.summary.total === 20, 'export total');
assert(payload.summary.correct === 6 && payload.summary.wrong === 4 && payload.summary.unknown === 10, 'export summary');
assert(payload.answers.length === 20, 'export answers length');
assert(payload.answers.filter((item) => item.status === 'unknown').length === 10, 'export unknown');
assert(payload.answers.filter((item) => item.status === 'unknown').every((item) => item.selectedText === "不知道 / I don't know"), 'export E text');
assert(payload.answers.every((item) => typeof item.reviewTip === 'string' && item.reviewTip.length > 0), 'export review tips');
assert(payload.sections.length > 0 && payload.types.length > 0 && payload.topics.length > 0, 'export diagnostics');
fs.writeFileSync(path.join(out, 'export-sample.json'), JSON.stringify(payload, null, 2));

// Retry gaps.
await page.click('#retryBtn');
await page.waitForSelector('#qtext');
assert((await page.textContent('#headProgressText')).includes('/ 14'), 'retry has 14 questions');
assert(await page.locator('#palette .pnum').count() === 14, 'retry palette 14');

// Resume after reload.
await page.click('#options [data-opt="4"]');
await page.click('#nextBtn');
await page.click('#options [data-opt="4"]');
await page.reload();
await page.waitForSelector('#qtext');
assert((await page.textContent('#headProgressText')).includes('2 / 14'), 'resume progress');
assert((await page.textContent('#qtext')).length > 0, 'resume question');

// New context: count 100 and mobile screenshots.
const context2 = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
const page2 = await context2.newPage();
page2.on('pageerror', (error) => errors.push(`pageerror-mobile: ${error.message}`));
await page2.goto(url);
await page2.waitForSelector('#heroStart');
await page2.screenshot({ path: path.join(out, '04-mobile-setup.png'), fullPage: true });
await page2.fill('#countInput', '100');
await page2.click('#startBtn');
await page2.waitForSelector('#qtext');
assert((await page2.textContent('#headProgressText')).includes('/ 100'), '100-question exam');
assert(await page2.locator('#palette .pnum').count() === 100, '100 palette');
await page2.screenshot({ path: path.join(out, '05-mobile-exam.png'), fullPage: true });

await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('PASS');
console.log(JSON.stringify({
  exportSummary: payload.summary,
  sections: payload.sections.map((s) => `${s.id}:${s.n}/${s.gap}`),
  outputs: fs.readdirSync(out),
}, null, 2));
