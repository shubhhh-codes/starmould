const assert = require('node:assert/strict');
const path = require('node:path');
const { createTypeScriptLoader } = require('./lib/load-typescript.cjs');
const root = path.resolve(__dirname, '..');
const denied = new Set();
const calls = [];
let missing = false;
let dbError = false;
let links = [];
const user = { id: 7, role_id: 5, role: 'Purchase Incharge' };
const database = {
  from(table) {
    const query = new Proxy({}, { get(_target, key) {
      if (key === 'then') return resolve => Promise.resolve({ data: dbError ? null : table === 'photo_event_associations' ? links : missing ? null : { id: 1 }, error: dbError ? { message: 'offline failure' } : null }).then(resolve);
      return () => query;
    } });
    return query;
  },
  async rpc(name, args) { calls.push({name,args}); return { data: {groups:[]}, error: null }; },
};
const load = createTypeScriptLoader(root, {
  '@/lib/auth': { authenticateRequest: async (_req, _roles, permission) => denied.has(permission) ? { error:'Denied',status:403 } : {user} },
  '@/lib/supabase/admin': {supabaseAdmin:database},
});
const model = load(path.join(root,'src/lib/photos/history-types.ts'));
const access = load(path.join(root,'src/lib/photos/history-access.ts'));
const history = load(path.join(root,'src/lib/photos/history.ts'));
const evidence = load(path.join(root,'src/lib/photos/movement-evidence.ts'));
(async()=>{
  for (const scope of [null,{}, {kind:'all',id:1}, {kind:'dispatch',id:0}, {kind:'dispatch',id:'1'}, {kind:'stage',id:1,stageKey:'design_by'}]) assert.throws(()=>model.parsePhotoHistoryScope(scope));
  assert.equal(model.photoHistoryKey(model.parsePhotoHistoryScope({kind:'purchase_receipt',id:12,unexpected:'ignored'})),'purchase_receipt:12:');
  assert.equal(model.photoHistoryLabel({availableCount:3,expiredCount:2,removedCount:0}),'Images (3)');
  assert.equal(model.photoHistoryLabel({availableCount:0,expiredCount:2,removedCount:0}),'Photos expired');
  assert.equal(model.photoHistoryLabel({availableCount:0,expiredCount:0,removedCount:2}),'Photos removed');
  assert.equal(model.photoHistoryLabel({availableCount:0,expiredCount:0,removedCount:0}),'Images (0)');
  assert.match(model.formatPhotoUploadTime('2026-11-16T10:15:12Z'),/3:45:12 pm IST/i);
  assert.throws(()=>evidence.movementEvidence([]));
  assert.throws(()=>evidence.movementEvidence([{id:1,photo_batch_id:'batchA'},{id:2,photo_batch_id:'batchB'}]));
  assert.deepEqual(evidence.movementEvidence([{id:2,photo_batch_id:'batchA'},{id:1,photo_batch_id:'batchA'},{id:1,photo_batch_id:'batchA'}]),{photoIds:[1,2],photoBatchId:'batchA'});
  const req = {};
  denied.add('nav_purchase_inward');
  const parent = await access.authorizePhotoHistory(req,{kind:'purchase_order',id:1});
  assert.equal(parent.includeChildren,false,'parent permission does not grant child photo access');
  assert.equal((await access.authorizePhotoHistory(req,{kind:'purchase_receipt',id:1})).status,403);
  const batch = await history.historyScopes(req,[{kind:'purchase_order',id:1},{kind:'purchase_order',id:1},{kind:'purchase_receipt',id:1}]);
  assert.equal(batch.authorized.length,1); assert.equal(batch.denied.length,1);
  await assert.rejects(history.historyScopes(req,Array.from({length:101},()=>({kind:'dispatch',id:1}))),/1 to 100/);
  denied.clear(); dbError=true;
  assert.equal((await access.authorizePhotoHistory(req,{kind:'dispatch',id:1})).status,503);
  await assert.rejects(history.historyScopes(req,[{kind:'dispatch',id:1}]),/unavailable/);
  dbError=false; missing=true;
  assert.equal((await access.authorizePhotoHistory(req,{kind:'dispatch',id:1})).status,404);
  missing=false;
  links=[{movement_type:'purchase_inward',document_id:1}]; denied.add('nav_purchase_inward');
  const photo={id:9,movement_type:'purchase_inward',movement_id:1,subplate_id:null,stage_key:null,uploaded_by:7};
  assert.equal((await access.authorizeHistoryPhoto(req,photo)).status,403,'uploader ownership cannot bypass committed record permissions');
  links=[]; denied.clear();
  assert.equal((await access.authorizeHistoryPhoto(req,{...photo,uploaded_by:8})).status,403,'uncommitted upload is owner-only');
  assert.equal((await access.authorizeHistoryPhoto(req,photo)).user.id,7);
  denied.add('action_create_purchase_inward'); assert.equal((await access.authorizeHistoryPhoto(req,photo)).status,403);
  denied.clear();
  await history.readHistoryPage(req,{scope:{kind:'purchase_receipt',id:1},groupId:'purchase_inward:1',photoOffset:24});
  assert.equal(calls.at(-1).args.p_photo_offset,24);
  await assert.rejects(history.readHistoryPage(req,{scope:{kind:'purchase_receipt',id:1},photoOffset:-1}),/Invalid/);
  console.log('PASS: photo history scope validation, distinct evidence, IST, status labels, child authorization, access failures, uploader isolation and pagination arguments.');
})().catch(e=>{console.error(e);process.exitCode=1;});
