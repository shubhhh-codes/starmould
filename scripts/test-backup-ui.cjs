const assert = require('node:assert/strict');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { browserPreview } = require('./lib/browser-preview.cjs');
async function main() {
  const preview = await browserPreview(path.join(__dirname, 'fixtures/backup-preview.tsx'));
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const click = text => page.evaluate(text => {
      const button = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === text);
      if (!button) throw new Error('Missing button ' + text); button.click();
    }, text);
    await page.setViewport({ width: 1280, height: 800 }); await page.goto(preview.url);
    await page.waitForFunction(() => document.body.textContent.includes('Background backup service is responding.'));
    assert.equal(await page.$$eval('a', nodes => nodes.length), 0, 'unfinished jobs have no downloads');
    await click('Backup Now');
    await page.waitForFunction(() => document.body.textContent.includes('Backup queued.'));
    assert.match(await page.evaluate(() => window.backupFixture.posts[0]), /^[a-f0-9-]{36}$/);
    await page.evaluate(() => { window.backupFixture.complete = true; }); await click('Refresh');
    await page.waitForSelector('a[href*="format=sql"]');
    assert.equal(await page.$$eval('a', nodes => nodes.length), 1);
    await click('Pause backups');
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(node => node.textContent === 'Backup Now' && node.disabled));
    await click('Resume backups');
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(node => node.textContent === 'Backup Now' && !node.disabled));
    await page.screenshot({ path: path.join(preview.output, 'backup-desktop.png') });
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(preview.output, 'backup-mobile.png') });
    await page.evaluate(() => { window.backupFixture.mode = 'offline'; }); await click('Refresh');
    await page.waitForFunction(() => document.body.textContent.includes('not responding'));
    assert.equal(await page.$$eval('button', nodes => nodes.find(node => node.textContent === 'Backup Now').disabled), true);
    await page.evaluate(() => { window.backupFixture.mode = 'unconfigured'; }); await click('Refresh');
    await page.waitForFunction(() => document.body.textContent.includes('one-time service setup'));
    assert.deepEqual(errors, []);
    console.log('PASS: real browser manual enqueue, progress, SQL downloads, pause/resume, offline/setup gating and mobile layout.');
    console.log('Screenshots:', preview.output);
  } finally { await browser.close(); await preview.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
