// Isolated browser checks. No login or application records are used or changed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { webpack } = require('next/dist/compiled/webpack/webpack');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');
const puppeteer = require('puppeteer-core');

async function run() {
  const root = path.resolve(__dirname, '..');
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'starmould-drawers-'));
  const loader = path.join(output, 'typescript-loader.cjs');
  fs.writeFileSync(loader, `const ts=require(${JSON.stringify(require.resolve('typescript'))}); module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;};`);
  await new Promise((resolve, reject) => {
    const compiler = webpack({
      mode: 'development', devtool: false, context: root,
      entry: path.join(__dirname, 'fixtures/drawer-preview.tsx'),
      output: { path: output, filename: 'preview.js' },
      resolve: { extensions: ['.tsx', '.ts', '.js'], alias: { '@': path.join(root, 'src') } },
      module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: loader }] },
    });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  const css = (await postcss([tailwind({ base: root })]).process(fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8'), { from: path.join(root, 'src/app/globals.css') })).css;
  const bundle = fs.readFileSync(path.join(output, 'preview.js'));
  const server = http.createServer((req, res) => {
    if (req.url === '/preview.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle); }
    else if (req.url === '/preview.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/preview.css"></head><body><div id="root"></div><script src="/preview.js"></script></body></html>'); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForSelector('#open-right');
    const settled = async (title = 'Refine results') => page.waitForFunction((title) => {
      const panels = [...document.querySelectorAll('[data-drawer-root] [role="dialog"]')];
      const panel = panels.find((node) => node.textContent.includes(title));
      return panel && !panel.inert && Math.abs(new DOMMatrix(getComputedStyle(panel).transform).m41) < 0.5;
    }, {}, title);
    const closed = async () => page.waitForFunction(() => !document.querySelector('[data-drawer-root]'));
    const isAnimatingClosed = async (direction = 1) => {
      await page.waitForFunction((direction) => {
        const panel = document.querySelector('[data-drawer-root] [role="dialog"]');
        if (!panel) return false;
        const offset = new DOMMatrix(getComputedStyle(panel).transform).m41;
        return panel.inert && direction * offset > 2 && direction * offset < panel.clientWidth;
      }, { timeout: 2000, polling: 'raf' }, direction);
    };
    await page.click('#open-right');
    await page.waitForFunction(() => {
      const panel = document.querySelector('[data-drawer-root] [role="dialog"]');
      if (!panel) return false;
      const offset = new DOMMatrix(getComputedStyle(panel).transform).m41;
      return !panel.inert && offset > 2 && offset < panel.clientWidth;
    }, { polling: 'raf' });
    await settled();
    assert.equal(await page.$eval('#root', (node) => node.inert), true);
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
    assert.equal(await page.$eval('[data-drawer-scrim]', (node) => getComputedStyle(node).backdropFilter.includes('blur(4px)')), true);
    await page.screenshot({ path: path.join(output, 'desktop.png') });
    await page.focus('input[aria-label="Search results"]');
    await page.evaluate(() => window.drawerPreview.setCount(1));
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Search results');
    await page.focus('#show-results');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'header-action');
    await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'show-results');
    const before = await page.$eval('[data-drawer-root] header', (node) => node.getBoundingClientRect().top);
    await page.$eval('[data-drawer-body]', (node) => { node.scrollTop = 500; });
    assert.equal(await page.$eval('[data-drawer-root] header', (node) => node.getBoundingClientRect().top), before);

    await page.click('[aria-label="Close panel"]');
    await isAnimatingClosed();
    await closed();
    await page.waitForFunction(() => document.activeElement.id === 'open-right');
    assert.equal(await page.$eval('#root', (node) => node.inert), false);
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    console.log('PASS: right drawer, blur, focus, scrolling, close animation and cleanup');

    await page.click('#open-right'); await settled();
    await page.click('#open-nested'); await settled('Nested details');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelectorAll('[data-drawer-root]').length === 1);
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
    await page.click('#open-modal'); await page.waitForSelector('#confirm-action');
    assert.equal(await page.$eval('[data-drawer-root]', (node) => node.inert), true);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#confirm-action'));
    assert.equal(await page.$eval('[data-drawer-root]', (node) => node.inert), false);
    await page.keyboard.press('Escape'); await isAnimatingClosed(); await closed();
    console.log('PASS: nested drawers and confirmation, Escape closes only the top panel');

    await page.click('#open-left'); await settled();
    await page.click('#show-results'); await isAnimatingClosed(-1); await closed();
    await page.click('#open-right'); await settled();
    await page.mouse.click(10, 300); await isAnimatingClosed(); await closed();
    await page.click('#open-right'); await settled();
    const grip = await page.$eval('[data-drawer-root] header', (node) => { const r = node.getBoundingClientRect(); return { x: r.x + 30, y: r.y + 15 }; });
    await page.mouse.move(grip.x, grip.y); await page.mouse.down(); await page.mouse.move(grip.x + 230, grip.y, { steps: 15 }); await page.mouse.up();
    await closed();
    console.log('PASS: left close, footer close, outside click and drag dismissal');

    await page.setViewport({ width: 375, height: 812 });
    await page.click('#open-right'); await settled();
    assert.equal(await page.$eval('[data-drawer-root] [role="dialog"]', (node) => node.getBoundingClientRect().width <= window.innerWidth - 40), true);
    await page.screenshot({ path: path.join(output, 'mobile.png') });
    await page.evaluate(() => window.drawerPreview.setOpen(false)); await isAnimatingClosed();
    await page.evaluate(() => window.drawerPreview.setOpen(true)); await settled();
    await page.evaluate(() => window.drawerPreview.setMounted(false)); await closed();
    assert.equal(await page.$eval('#root', (node) => node.inert), false);
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    console.log('PASS: mobile bounds, rapid reopen and unmount cleanup');

    await page.evaluate(() => window.drawerPreview.setMounted(true));
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.reload(); await page.click('#open-right'); await settled();
    await page.keyboard.press('Escape'); await closed();
    await page.click('#open-parent'); await page.waitForSelector('#parent-close');
    assert.equal(await page.evaluate(() => document.body.style.overflow), '');
    assert.equal(await page.$eval('#root', (node) => node.inert), false);
    await page.click('#parent-close'); await closed();
    assert.deepEqual(errors, []);
    console.log('PASS: reduced motion and contained drawers; no browser errors');
    console.log(`Screenshots: ${output}`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
