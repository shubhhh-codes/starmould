const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');
const {browserPreview} = require('./lib/browser-preview.cjs');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
async function run() {
  const preview = await browserPreview(path.join(__dirname,'fixtures/http-photo-upload-preview.tsx'));
  const browser = await puppeteer.launch({executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--host-resolver-rules=MAP starmould-http.test 127.0.0.1','--no-proxy-server']});
  try {
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.setViewport({width:1024,height:768,isMobile:true,hasTouch:true});
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64');
    await page.setRequestInterception(true);page.on('request',request=>request.url().includes('/api/photos/view/') ? request.respond({status:200,contentType:'image/png',body:png}):request.continue());
    await page.goto(preview.url.replace('127.0.0.1','starmould-http.test'));
    await page.waitForSelector('input[type="file"][multiple]');
    const surface=await page.evaluate(()=>({secure:window.isSecureContext,uuid:typeof crypto.randomUUID,subtle:typeof crypto.subtle,entropy:typeof crypto.getRandomValues}));
    assert.deepEqual(surface,{secure:false,uuid:'undefined',subtle:'undefined',entropy:'function'},'Test must use a genuine non-secure HTTP origin');
    const file=path.join(preview.output,'http-test.png');fs.writeFileSync(file,png);
    const input=await page.$('input[type="file"][multiple]');await input.uploadFile(file);
    await page.waitForFunction(()=>document.getElementById('uploaded-count').textContent==='Uploaded: 1');
    const uploads=await page.evaluate(()=>window.httpUploadFixture.uploads);
    assert.equal(uploads.length,1);for(const value of Object.values(uploads[0]))assert.match(value,uuid);
    await page.click('#test-retry');await page.waitForFunction(()=>document.getElementById('retry-key').textContent.length===36);
    const first=await page.$eval('#retry-key',n=>n.textContent);assert.match(first,uuid);
    await page.click('#test-retry');assert.equal(await page.$eval('#retry-key',n=>n.textContent),first);
    await page.reload();await page.waitForSelector('#test-retry');await page.click('#test-retry');await page.waitForFunction(()=>document.getElementById('retry-key').textContent.length===36);
    assert.equal(await page.$eval('#retry-key',n=>n.textContent),first,'HTTP save retry identity survives reload');
    assert.deepEqual(errors,[]);
    console.log('PASS: actual non-secure HTTP/tablet origin without randomUUID or subtle; uploader mounts, photo uploads, draft/event/file IDs and save retry survive reload.');
  } finally {await browser.close();await preview.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
