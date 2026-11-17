const assert = require('node:assert/strict');
const path = require('node:path');
const {createTypeScriptLoader} = require('./lib/load-typescript.cjs');
const model = createTypeScriptLoader()(path.resolve(__dirname,'../src/lib/photos/storage-layout.ts'));
const photo = {id:42,r2_key:'photos/old.webp',movement_type:'purchase_inward',stage_key:null,subplate_id:null,server_uploaded_at:'2026-11-16T20:15:12Z'};
const context = {moulds:['0002_TESTC_002'],documents:[{id:5,number:'SM/PR/005'}]};
assert.equal(model.istFileTime(photo.server_uploaded_at),'2026-11-17_01-45-12_IST');
assert.equal(model.photoObjectKey(photo,context),'0002_TESTC_002/purchase_inward/SM-PR-005__5/2026-11-17_01-45-12_IST_p42.webp');
const shared = {...context,moulds:['A','B','A']};
assert.match(model.photoObjectKey(photo,shared),/^shared\/purchase_inward\//);
assert.match(model.photoObjectKey(photo,shared,'B'),/^B\/purchase_inward\//);
assert.match(model.photoObjectKey({...photo,claim_batch_id:'batch_123'}, {...context,documents:[]}),/^_pending\/batch_123\//);
assert.equal(model.photoObjectKey(photo,{...context,documents:[]}), '0002_TESTC_002/purchase_inward/2026-11-17_01-45-12_IST_p42.webp');
assert.equal(model.photoObjectKey(photo,{moulds:['A','B'],documents:[]}), 'shared/purchase_inward/2026-11-17_01-45-12_IST_p42.webp');
assert.equal(model.photoObjectKey(photo,{moulds:[],documents:[]}), '_unlinked/purchase_inward/2026-11-17_01-45-12_IST_p42.webp');
assert.match(model.photoObjectKey(photo,{moulds:[],documents:[]}),/^_unlinked\//);
for (const [movement_type,stage_key,category] of [['jobwork_outward',null,'outward_jobwork'],['jobwork_inward',null,'inward_jobwork'],['dispatch',null,'dispatch'],['subplate_qc','vmc_qcby','vmc_qc'],['subplate_qc','final_qcby','final_qc'],['packing','packing_workby','packing']]) {
  const p={...photo,movement_type,stage_key,subplate_id:7};
  const key=model.photoObjectKey(p,{...context,subplateCode:'SP/007',eventId:'qc-event-1',eventTime:'2026-11-16T10:00:00Z'});
  assert.ok(key.includes('/'+category+'/'));
  if(stage_key){assert.ok(key.includes('/SP-007__7/2026-11-16_15-30-00_IST_'));assert.notEqual(key,model.photoObjectKey(p,{...context,eventId:'qc-event-2'}));}
}
const newKey='A/purchase_inward/x/2026-11-17_01-45-12_IST_abcdef123456.webp';
assert.equal(model.photoFilename({...photo,r2_key:newKey}),newKey.split('/').pop());
for(const unsafe of ['..','../../x','a\\b','a/b','\u0000','a?b','a'.repeat(200)]) {
  const segment=model.folderSegment(unsafe);assert.ok(!/[\\/\x00]/.test(segment));assert.notEqual(segment,'..');assert.ok(segment.length<=100);
}
assert.throws(()=>model.istFileTime('bad'));
console.log('PASS: mould/category/document paths, shared export expansion, pending/unlinked separation, QC event folders, IST rollover, filename stability and safe segments.');
