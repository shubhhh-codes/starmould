const assert=require('node:assert/strict'),path=require('node:path'),puppeteer=require('puppeteer-core');
const {browserPreview}=require('./lib/browser-preview.cjs');
(async()=>{
 const preview=await browserPreview(path.join(__dirname,'fixtures/backup-preview.tsx'));
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const click=text=>page.evaluate(text=>[...document.querySelectorAll('button')].find(n=>n.textContent.trim()===text).click(),text);
  await page.setViewport({width:1280,height:800});await page.goto(preview.url);
  await page.waitForFunction(()=>document.body.textContent.includes('Scheduler checks do not create extra backups.'));
  assert.equal(await page.$eval('a[href="/export"]',n=>n.textContent),'Generate & download SQL');
  assert.equal(await page.$$eval('a[href*="format=sql"]',n=>n.length),0);
  await page.evaluate(()=>{window.backupFixture.complete=true;});await click('Refresh');
  await page.waitForSelector('a[href*="format=sql"]');
  await click('Pause backups');await page.waitForFunction(()=>document.body.textContent.includes('Automatic backups are paused.'));
  await click('Resume backups');await page.waitForFunction(()=>document.body.textContent.includes('Scheduler checks do not create extra backups.'));
  await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.evaluate(()=>{window.backupFixture.mode='unconfigured';});await click('Refresh');
  await page.waitForFunction(()=>document.body.textContent.includes('Automatic backup tracking is not configured'));
  assert.deepEqual(errors,[]);console.log('PASS: server-only backup navigation, SQL downloads, automatic pause/resume and mobile layout.');
 }finally{await browser.close();await preview.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
