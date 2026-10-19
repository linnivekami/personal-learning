import { chromium, assert, url } from './harness.mjs';
const browser = await chromium.launch({ headless: true });
const errors = [];
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(url);
await page.click('.preset[data-count="20"]');
await page.click('#startBtn');
for (let i = 0; i < 20; i++) {
  await page.click('#options [data-opt="4"]');
  if (i < 19) await page.click('#nextBtn');
}
await page.click('#submitSide');
await page.waitForSelector('dialog[open]');
await page.getByRole('button', { name: '确认交卷并诊断' }).click();
await page.waitForSelector('#exportBtn');
assert((await page.textContent('.stat-card.unknown b')).trim() === '20', '20 unknown');

// Section practice from report.
await page.click('[data-practice-section="S6"]');
await page.waitForSelector('#qtext');
const sectionExamText = await page.textContent('#headProgressText');
assert(sectionExamText.includes('/ 10'), `S6 practice is 10 questions, got ${sectionExamText}`);
assert((await page.textContent('.q-meta')).includes('S6'), 'S6 question');
await page.click('#exitBtn');
await page.waitForSelector('dialog[open]');
await page.locator('dialog').getByRole('button', { name: '保存并退出' }).click();
await page.waitForSelector('#startBtn');
assert((await page.textContent('.resume-banner')).includes('已答 0 / 10'), 'resume banner after section exit');

// Resume it.
await page.click('#resumeBtn');
await page.waitForSelector('#qtext');
assert((await page.textContent('#headProgressText')).includes('0 / 10'), 'resume section exam');

// Back to setup via exit, then start weak mode using the history entry.
await page.click('#exitBtn');
await page.waitForSelector('dialog[open]');
await page.locator('dialog').getByRole('button', { name: '保存并退出' }).click();
await page.waitForSelector('#startBtn');
assert(await page.locator('.mode-option[data-mode="weak"]').isEnabled(), 'weak mode enabled');
await page.click('.mode-option[data-mode="weak"]');
await page.click('#startBtn');
await page.waitForSelector('dialog[open]');
await page.locator('dialog').getByRole('button', { name: '覆盖并开始' }).click();
await page.waitForSelector('#qtext');
assert((await page.textContent('#headProgressText')).includes('/ 20'), 'weak exam 20');

// Reload still resumes the unsubmitted weak exam.
await page.reload();
await page.waitForSelector('#qtext');
assert((await page.textContent('#headProgressText')).includes('0 / 20'), 'weak resume');

await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('PASS advanced');
