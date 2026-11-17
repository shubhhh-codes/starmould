const assert=require('node:assert/strict');
const path=require('node:path');
const JSZip=require('jszip');
const {createTypeScriptLoader}=require('./lib/load-typescript.cjs');
let missing=false;
const photo={id:42,r2_key:'shared/file.webp',movement_type:'purchase_inward',subplate_id:null,stage_key:null,server_uploaded_at:'2026-11-16T10:00:00Z',deleted_at:null,users:{name:'Uploader'},party_name:'=unsafe-formula'};
const data=['MOULD-A','MOULD-B','MOULD-A'].map(project_code=>({project_code,mould_code:project_code,movement_photos:photo}));
data.push({project_code:'MOULD-A',mould_code:'MOULD-A',movement_photos:[{...photo,id:99,deleted_at:'2026-11-16'}]});
const db={from(){const q=new Proxy({}, {get:(_,key)=>key==='then'?resolve=>Promise.resolve({data,error:null}).then(resolve):()=>q});return q;}};
const bytes=Buffer.from('original compressed watermarked bytes');
const load=createTypeScriptLoader(path.resolve(__dirname,'..'),{
  '@/lib/supabase/admin':{supabaseAdmin:db},
  './client':{getR2BucketName:()=> 'starmould',getFromR2Buffer:async()=>missing?null:bytes},
  './watermark':{formatServerTimeToIST:()=> '16/11/2026 03:30:00 PM IST'},
  '@/lib/photos/storage-moves':{photoLayoutContext:async()=>({moulds:['MOULD-A','MOULD-B'],documents:[{id:5,number:'SM/PR/005'}]})},
});
(async()=>{
  const {generatePhotoBackupZip}=load(path.resolve(__dirname,'../src/lib/r2/export-zip.ts'));
  const result=await generatePhotoBackupZip({scope:'bulk',projectCodes:['MOULD-A','MOULD-B'],userId:1});
  const zip=await JSZip.loadAsync(result.zipBuffer);
  const files=Object.keys(zip.files).filter(f=>f.endsWith('.webp')).sort();
  assert.deepEqual(files,['MOULD-A','MOULD-B'].map(m=>`starmould/${m}/purchase_inward/SM-PR-005__5/2026-11-16_15-30-00_IST_p42.webp`));
  for(const f of files)assert.deepEqual(await zip.file(f).async('nodebuffer'),bytes);
  assert.equal(result.totalPhotos,2);assert.ok(zip.file('starmould/Photo-Index.csv'));
  const index=await zip.file('starmould/Photo-Index.csv').async('string');assert.ok(index.includes("'=unsafe-formula"));
  assert.ok(index.includes('MOULD-A/purchase_inward/SM-PR-005__5/'));assert.ok(!index.includes('99.webp'));
  missing=true;await assert.rejects(()=>generatePhotoBackupZip({scope:'project',projectCodes:['MOULD-A'],userId:1}),/missing from storage/);
  console.log('PASS: real ZIP structure, shared evidence in each mould, deduplication, exact image bytes, deleted-photo exclusion, Excel index, CSV safety and complete-backup failure on missing objects.');
})().catch(e=>{console.error(e);process.exitCode=1;});
