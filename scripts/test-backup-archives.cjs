const assert = require('node:assert/strict');
const path = require('node:path');
const { NextRequest, NextResponse } = require('next/server');
const { createTypeScriptLoader } = require('./lib/load-typescript.cjs');
async function main() {
  let denied = false; let requestInput;
  const load = createTypeScriptLoader(undefined, {
    '@/lib/backup/jobs': {
      authorizeBackupAdmin: async () => denied ? NextResponse.json({}, { status: 403 }) : { id: 1 },
      backupStore: () => ({ pool: { query: async () => ({ rowCount: 1 }) } }),
      backupUnavailable: () => NextResponse.json({}, { status: 503 }),
    },
    '../../../../../scripts/backup/storage.cjs': { storageConfig: () => ({ bucket: 'fixture-private', client: {
      send: async command => { requestInput = command.input; return { Contents: [{ Key: 'database/date/database.sql', Size: 123, LastModified: new Date() }], IsTruncated: true, NextContinuationToken: 'page2' }; },
      destroy() {},
    } }) },
    '@aws-sdk/s3-request-presigner': { getSignedUrl: async () => 'https://storage.example/signed' },
  });
  const route = load(path.join(__dirname, '../src/app/api/backup/archives/route.ts'));
  const req = suffix => new NextRequest('https://app.example/api/backup/archives' + suffix);
  denied = true; assert.equal((await route.GET(req(''))).status, 403);
  denied = false;
  assert.equal((await route.GET(req('?key=photos/private.jpg'))).status, 400);
  assert.equal((await route.GET(req('?key=database/../private'))).status, 400);
  const list = await (await route.GET(req('?cursor=page1'))).json();
  assert.equal(requestInput.Prefix, 'database/'); assert.equal(requestInput.ContinuationToken, 'page1');
  assert.equal(list.files.length, 1); assert.equal(list.nextCursor, 'page2');
  const download = await route.GET(req('?key=database/date/database.sql'));
  assert.equal(download.status, 303); assert.equal(download.headers.get('cache-control'), 'no-store');
  assert.equal((await route.GET(req('?key=database/manifest.json'))).status, 400);
  const badDelete = new NextRequest('https://app.example/api/backup/archives', { method: 'DELETE', body: JSON.stringify({ key: 'photos/test.sql' }) });
  assert.equal((await route.DELETE(badDelete)).status, 400);
  const validDelete = new NextRequest('https://app.example/api/backup/archives', { method: 'DELETE', body: JSON.stringify({ key: 'database/date/database.sql' }) });
  assert.equal((await route.DELETE(validDelete)).status, 200);
  console.log('PASS: admin-only archives, backup-prefix boundaries, pagination and private signed downloads.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
