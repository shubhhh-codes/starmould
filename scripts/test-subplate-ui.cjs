const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { browserPreview } = require('./lib/browser-preview.cjs');

async function run() {
  const mocks = path.join(__dirname, 'fixtures/subplate-mocks.tsx');
  const aliases = Object.fromEntries([
    'next/navigation', '@/components/providers/auth-provider', '@/components/providers/permissions-provider',
    '@/lib/query/hooks', '@/lib/query/principal-fetch', '@/lib/query/realtime', '@/lib/state/store',
    '@/components/layout/app-layout', '@/lib/hooks/use-table-highlight', '@/lib/plate-recommender',
    '@/components/purchase/create-purchase-order-modal', '@/components/subplate/assign-staff-modal',
  ].map((name) => [`${name}$`, mocks]));
  if (process.env.SUBPLATE_PAGE_SOURCE) aliases['@/views/subplate-page$'] = path.resolve(process.env.SUBPLATE_PAGE_SOURCE);
  const preview = await browserPreview(path.join(__dirname, 'fixtures/subplate-preview.tsx'), aliases);
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewport({ width: 1440, height: 1100 });
    await page.goto(preview.url);
    await page.waitForSelector('#row-7');
    const checkpoints = {};
    const snapshot = async (name) => { checkpoints[name] = await page.evaluate(() => ({
      text: document.querySelector('main').textContent.replace(/\s+/g, ' ').trim(),
      inputs: [...document.querySelectorAll('input')].map((input) => ({ value: input.value, disabled: input.disabled, placeholder: input.placeholder })),
    })); };
    const configure = (patch) => page.evaluate((patch) => window.subplateTest.configure(patch), patch);
    const clickText = (text) => page.evaluate((text) => {
      const button = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === text && button.getClientRects().length);
      if (!button) throw new Error(`Missing button ${text}`);
      button.click();
    }, text);
    await snapshot('desktop');
    for (const id of [7, 8, 9]) await page.click(`#row-${id} button[title="Expand stage studio"]`);
    await snapshot('expanded-stages');
    assert.ok(checkpoints['expanded-stages'].text.includes('FIXPO2'));
    await page.screenshot({ path: path.join(preview.output, 'subplates-desktop.png'), fullPage: true });
    await page.click('#row-7 button[title="Edit subplate"]');
    await page.waitForSelector('form input[placeholder="e.g. Cavity Plate A-Side"]');
    const nameSelector = 'form input[placeholder="e.g. Cavity Plate A-Side"]';
    assert.equal(await page.$eval(nameSelector, (input) => input.value), 'Fixture cavity');
    await snapshot('edit-form');
    await page.$eval(nameSelector, (input) => input.focus());
    await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
    await page.keyboard.type('Changed fixture');
    await page.click('form button[type="submit"]');
    await page.waitForFunction(() => !document.querySelector('form'));
    const update = await page.evaluate(() => window.subplateFixture.events.find((event) => event.type === 'mutation' && event.method === 'PUT'));
    assert.deepEqual(update.body, { id: 7, updates: { platename: 'Changed fixture', projectid: 42, subprojectid: '0042_KEEP_003_001', shape: 'Plate', material: 'MS-Bright', length: 100, width: 50, height: 20, weight: 0.781, unit: 'mm', sqty: 4, location: 'SM' } });
    await page.click('#row-7 button[title="Edit subplate"]');
    await page.waitForSelector('form');
    await configure({ failSave: true });
    await page.click('form button[type="submit"]');
    await page.waitForFunction(() => window.subplateFixture.events.some((event) => event.type === 'toast'));
    assert.ok(await page.$('form'), 'Failed save must leave the form open');
    await configure({ denied: ['action_edit_subplate'] });
    await page.waitForFunction(() => !document.querySelector('form'));
    await configure({ denied: [], failSave: false });
    await clickText('Collapse All');
    await page.waitForFunction(() => !document.querySelector('#row-7'));
    await snapshot('collapsed');
    await clickText('Expand All');
    await page.waitForSelector('#row-7');
    await page.setViewport({ width: 390, height: 844 });
    await page.waitForSelector('#m-row-7');
    await page.click('#m-row-7');
    await snapshot('mobile');
    await page.screenshot({ path: path.join(preview.output, 'subplates-mobile.png'), fullPage: true });
    await configure({ user: { id: 2, name: 'Fixture designer', role_id: 3, role: 'Designer' } });
    await snapshot('designer');
    await page.focus('input[placeholder^="Universal Search"]');
    await page.keyboard.type('does-not-exist');
    await page.waitForFunction(() => document.body.textContent.includes('No Moulds or Subplates Found'));
    await snapshot('empty');
    assert.deepEqual(errors, []);
    if (process.env.SUBPLATE_SNAPSHOT) fs.writeFileSync(process.env.SUBPLATE_SNAPSHOT, JSON.stringify(checkpoints, null, 2));
    console.log('PASS: subplate desktop/mobile, expanded stages, exact edit payload, failed save, permission revocation, group controls, role view and empty search');
    console.log(`Subplate screenshots: ${preview.output}`);
  } finally {
    await browser.close(); await preview.close();
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
