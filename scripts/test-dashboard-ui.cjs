const assert = require('node:assert/strict');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const { browserPreview } = require('./lib/browser-preview.cjs');

async function run() {
  const mocks = path.join(__dirname, 'fixtures/dashboard-mocks.tsx');
  const paths = ['next/navigation', '@/components/providers/auth-provider', '@/components/providers/permissions-provider', '@/lib/query/hooks', '@/lib/query/principal-fetch', '@/lib/query/prefetch', '@/lib/query/realtime', '@/lib/state/store', '@/components/purchase/create-purchase-order-modal', '@/components/mould/mould-timeline-drawer', '@/components/mould/move-to-register-modal', '@/components/subplate/assign-staff-modal'];
  const preview = await browserPreview(path.join(__dirname, 'fixtures/dashboard-preview.tsx'), Object.fromEntries(paths.map((name) => [`${name}$`, mocks])));
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(preview.url);
    await page.waitForSelector('tbody tr');
    const rows = () => page.$$eval('tbody > tr', (nodes) => nodes.map((node) => node.textContent));
    const clickText = (text) => page.evaluate((text) => {
      const button = [...document.querySelectorAll('button')].find((node) => (node.textContent.trim() === text || node.querySelector("span")?.textContent.trim() === text) && node.getClientRects().length);
      if (!button) throw new Error(`Missing button: ${text}`);
      button.click();
    }, text);
    const configure = (patch) => page.evaluate((patch) => window.dashboardTest.configure(patch), patch);
    const clear = () => page.evaluate(() => window.dashboardTest.resetEvents());
    const events = () => page.evaluate(() => window.dashboardFixture.events.map(({ text, ...rest }) => rest));
    assert.equal((await rows()).length, 15);
    assert.ok((await rows())[0].includes('0020_TEST_020'));
    await page.keyboard.press('/');
    assert.equal(await page.evaluate(() => document.activeElement.tagName), 'INPUT');
    await page.keyboard.type('Fixture mould 20');
    await page.waitForFunction(() => document.querySelectorAll('tbody > tr').length === 1);
    await clear(); await clickText('Excel');
    const download = await page.evaluate(() => window.dashboardTest.downloadText());
    assert.ok(download.filename.endsWith('.csv'));
    assert.equal(download.text.split('\n').length, 21, 'Characterize current raw-data export; fix in a separate phase');
    await clickText('PDF');
    assert.ok((await events()).some((event) => event.type === 'print'));
    await page.focus('input[placeholder="Search in table..."]');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelectorAll('tbody > tr').length === 15);
    console.log('PASS: descending sort, 15 rows, search and unchanged CSV/print behavior');

    const chooseCustomer = async (label) => {
      await page.click('input[placeholder="All Customers"]');
      await page.waitForFunction((label) => [...document.querySelectorAll('div.cursor-pointer')].some((node) => node.textContent.trim() === label && node.getClientRects().length), {}, label);
      await page.evaluate((label) => {
        const candidates = [...document.querySelectorAll('div')].filter((node) => node.textContent.trim() === label && node.getClientRects().length);
        const option = candidates.find((node) => node.className.includes('cursor-pointer'));
        if (!option) throw new Error(`Missing customer option ${label}`);
        option.click();
      }, label);
    };
    await chooseCustomer('Fixture Alpha');
    await page.waitForFunction(() => document.querySelectorAll('tbody > tr').length === 10);
    assert.ok((await rows())[0].includes('0019_TEST_019'));
    await chooseCustomer('All Customers (2)');
    await page.waitForFunction(() => document.querySelectorAll('tbody > tr').length === 15);
    await page.click('thead input[type="checkbox"]');
    assert.ok(await page.evaluate(() => document.body.textContent.includes('15 selected')));
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
    assert.ok(await page.evaluate(() => document.body.textContent.includes('20 selected')));
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.body.textContent.includes('20 selected')), false);
    await clear();
    await page.click('tbody > tr');
    await page.waitForFunction(() => document.body.textContent.includes('Fixture plate'));
    assert.equal((await page.evaluate(() => window.dashboardFixture.requests)).length, 0, 'Preloaded nonempty subplates must suppress lazy fetch');
    await page.click('tbody > tr');
    await page.click('tbody > tr button[title="Add Subplate"]');
    await page.waitForSelector('form input[placeholder="e.g. Cavity Plate A"]');
    assert.equal(await page.$eval('form input[placeholder="e.g. Cavity Plate A"]', (input) => input.value), 'Plate 2');
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('form input')].some((input) => input.value === '0020_TEST_020_002')));
    assert.equal(await page.$eval('form button[type="submit"]', (button) => button.disabled), false, 'Current defaults allow blank dimensions');
    const readCounter = () => page.$eval('form [role="spinbutton"]', (counter) => ({
      value: Number(counter.getAttribute('aria-valuenow')),
      minimum: Number(counter.getAttribute('aria-valuemin')),
      offset: new DOMMatrixReadOnly(getComputedStyle(counter.querySelector('.rct-col[data-on] .rct-strip')).transform).m42,
    }));
    assert.deepEqual(await readCounter(), { value: 1, minimum: 1, offset: -40 }, 'Default quantity must visibly show 1');
    assert.equal(await page.$eval('form button[aria-label="Decrease value"]', (button) => button.disabled), true);
    await page.click('form button[aria-label="Increase value"]');
    await page.waitForFunction(() => {
      const counter = document.querySelector('form [role="spinbutton"]');
      const offset = new DOMMatrixReadOnly(getComputedStyle(counter.querySelector('.rct-col[data-on] .rct-strip')).transform).m42;
      return counter.getAttribute('aria-valuenow') === '2' && Math.abs(offset + 80) < 0.02;
    });
    await page.click('form button[aria-label="Decrease value"]');
    await page.waitForFunction(() => document.querySelector('form [role="spinbutton"]').getAttribute('aria-valuenow') === '1');
    await page.focus('form [role="spinbutton"]');
    await page.keyboard.press('ArrowDown');
    assert.equal((await readCounter()).value, 1, 'Keyboard decrement cannot take quantity below 1');
    await configure({ denied: ['action_create_subplate'] });
    await page.waitForFunction(() => !document.querySelector('form'));
    assert.equal(await page.$('tbody > tr button[title="Add Subplate"]'), null);
    await configure({ denied: [] });
    console.log('PASS: customer filter, page/all selection, preloaded details, form defaults and permission revocation');

    // Dependency precheck and parent callbacks use fixture records only.
    await page.click('tbody > tr button[title="Delete Mould"]');
    await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] button')].some((button) => button.querySelector('span')?.textContent.trim() === 'Delete Mould' && !button.disabled));
    await clickText('Cancel');
    await clear();
    await page.click('tbody > tr button[title="Delete Mould"]');
    await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] button')].some((button) => button.querySelector('span')?.textContent.trim() === 'Delete Mould' && !button.disabled));
    await clickText('Delete Mould');
    await page.waitForFunction(() => window.dashboardFixture.events.some((event) => event.type === 'bulk-delete'));
    const deletion = (await events()).find((event) => event.type === 'bulk-delete');
    assert.deepEqual(deletion, { type: 'bulk-delete', ids: [20], force: true });
    assert.equal((await events()).some((event) => event.type === 'single-delete'), false);
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
    console.log('PASS: delete cancellation and bulk callback preference with force=true');

    await configure({ records: [] });
    await page.waitForFunction(() => document.body.textContent.includes('No moulds or projects match the selected filter.'));
    await page.reload(); await page.waitForSelector('tbody tr');
    await page.setViewport({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('button[title="View Subplates"]')].some((button) => button.getClientRects().length)));
    console.log('PASS: empty state and mobile actions');
    await page.screenshot({ path: path.join(preview.output, 'dashboard-mobile.png') });
    await page.evaluate(() => {
      window.dashboardTest.configure({ lazyPlates: [{ ...window.dashboardFixture.lazyPlates[0],
        platename: 'Long mould cavity plate name with enough words to check wrapping',
        subprojectid: '0042_VERYLONGCUSTOMER_003_001_WITH_LONG_UNBROKEN_SUFFIX',
      }] });
    });
    await clickText('View Subplates');
    await page.waitForSelector('[role="dialog"] [title^="Right-click for options"]');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewport({ width, height: 900 });
      const layout = await page.$eval('[role="dialog"] [title^="Right-click for options"]', (card) => {
        const name = card.firstElementChild.firstElementChild;
        return { cardWidth: card.clientWidth, contentWidth: card.scrollWidth, nameWidth: name.getBoundingClientRect().width,
          dialogOverflow: card.closest('[role="dialog"]').scrollWidth - card.closest('[role="dialog"]').clientWidth };
      });
      assert.ok(layout.contentWidth <= layout.cardWidth + 1, `Card overflow at ${width}px`);
      assert.ok(layout.nameWidth > layout.cardWidth * 0.75, `Plate name is squeezed at ${width}px`);
      assert.ok(layout.dialogOverflow <= 1, `Drawer overflow at ${width}px`);
    }
    await page.setViewport({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(preview.output, 'subplate-drawer-mobile.png') });
    await page.click('[aria-label="Close panel"]');
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
    await clickText('History');
    await page.waitForSelector('[role="dialog"][aria-label="Mould history integration"]');
    await clickText('Close integration');
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
    await configure({ user: { id: 2, name: 'Fixture designer', role_id: 3, role: 'Designer' } });
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].some((button) => button.textContent.trim() === 'History' && button.getClientRects().length));
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('button[title="View Subplates"]')].some((button) => button.getClientRects().length)), false);
    await configure({ user: { id: 1, name: 'Fixture admin', role_id: 0, role: 'Admin' } });
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((button) => button.textContent.trim() === 'History' && button.getClientRects().length));
    console.log('PASS: visible mobile drawer/history buttons and long drawer text at 320/390/768/1440px');
    console.log('PASS: mobile drawer/history options are hidden for staff and restored for admin');
    assert.deepEqual(errors, []);
    console.log(`Dashboard screenshots: ${preview.output}`);
  } finally {
    await browser.close(); await preview.close();
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
