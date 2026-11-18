const assert = require('node:assert/strict');
const path = require('node:path');
const { NextRequest, NextResponse } = require('next/server');
const { createTypeScriptLoader } = require('./lib/load-typescript.cjs');
async function main() {
  let auth = { user: { id: 7, role_id: 0 } };
  const helper = createTypeScriptLoader(undefined, { '@/lib/auth': { authenticateRequest: async () => auth } })(path.join(__dirname, '../src/lib/backup/jobs.ts'));
  const jobs = new Map(); let admissions = 0; let paused = false;
  const store = {
    get: async id => jobs.get(id),
    status: async () => ({ jobs: [...jobs.values()].map(helper.publicJob), workers: [], paused }),
    enqueueManual: async (id, key) => {
      admissions++;
      if (paused) throw new Error('BACKUPS_PAUSED');
      const jobId = `manual/${id}/${key}`;
      if (!jobs.has(jobId)) jobs.set(jobId, { id: jobId, kind: 'manual', status: 'queued', manifest: { secret: 'server-only' } });
      return jobs.get(jobId);
    },
    pause: async value => { paused = value; },
  };
  let enabled = true;
  const mocks = { '@/lib/backup/jobs': { ...helper, jobsEnabled: () => enabled, backupStore: () => store },
    '../../../../../../scripts/backup/storage.cjs': { storageConfig: () => ({ bucket: 'private', client: { destroy() {} } }) },
    '@aws-sdk/s3-request-presigner': { getSignedUrl: async () => 'https://private.example/short-lived-download' } };
  const load = createTypeScriptLoader(undefined, mocks);
  const route = load(path.join(__dirname, '../src/app/api/backup/jobs/route.ts'));
  const download = load(path.join(__dirname, '../src/app/api/backup/jobs/download/route.ts'));
  const request = (method = 'GET', suffix = '', headers = {}, body) => new NextRequest(`https://erp.example/api/backup/jobs${suffix}`, {
    method, headers: { origin: 'https://erp.example', ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  auth = { error: 'Unauthorized', status: 401 };
  assert.equal((await route.GET(request())).status, 401);
  assert.equal((await download.GET(request('GET', '?id=x'))).status, 401);
  auth = { user: { id: 8, role_id: 1 } };
  assert.equal((await route.PATCH(request('PATCH'))).status, 403);
  assert.equal((await download.GET(request('GET', '?id=x'))).status, 403);
  auth = { user: { id: 7, role_id: 0 } };
  assert.equal((await route.PATCH(request('PATCH', '', { origin: 'https://attacker.example' }))).status, 403);
  assert.equal(admissions, 0);
  enabled = false;
  assert.equal((await route.GET(request())).status, 200);
  enabled = true;
  const id='manual-web/7/test';
  jobs.set(id, {id,status:'completed',completed_at:new Date().toISOString(),manifest:{files:[{format:'sql',key:'private/database.sql'}]}});
  const publicStatus = await (await route.GET(request('GET', '?id='+encodeURIComponent(id)))).json();
  assert.equal('manifest' in publicStatus.job,false);
  assert.equal((await download.GET(request('GET','?id=x&format=json'))).status,400);
  const redirect=await download.GET(request('GET','?id='+encodeURIComponent(id)));
  assert.equal(redirect.status,303); assert.match(redirect.headers.get('location'),/short-lived-download/);
  assert.equal((await route.PATCH(request('PATCH', '', {}, { paused: 'yes' }))).status, 400);
  assert.equal((await route.PATCH(request('PATCH', '', {}, { paused: true }))).status, 200);

  console.log('PASS: admin authorization, same-origin mutations, private metadata, pause and signed downloads.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
