const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises');
const {NextRequest,NextResponse}=require('next/server'),{createTypeScriptLoader}=require('./lib/load-typescript.cjs');
(async()=>{
 let admin=true,afterTask,saved=0,directory,large=false;
 const sql='-- PostgreSQL database dump\nCREATE TABLE public.fixture(id bigint);';
 const route=createTypeScriptLoader(undefined,{
  'next/server':{NextRequest,NextResponse,after:task=>{afterTask=task;}},
  '@/lib/backup/jobs':{authorizeBackupAdmin:async()=>admin?{id:7}:NextResponse.json({error:'Unauthorized'},{status:401}),backupStore:()=>({enqueueManual:async()=>({id:'manual-web/7/test'})}),backupUnavailable:()=>NextResponse.json({error:'Unavailable'},{status:503})},
  '../../../../../scripts/backup/app-capture.cjs':{captureApplicationBackup:async dir=>{directory=dir;const file=path.join(dir,'database.sql');await fs.writeFile(file,large?'x'.repeat(4*1024*1024+1):sql);return{capturedAt:'2026-11-17T07:00:00Z',files:[{path:file}]};}},
  '../../../../../scripts/backup/storage.cjs':{Storage:class {client={destroy(){}}}},
  '../../../../../scripts/backup/runner.cjs':{executeJob:async(_s,_r,_id,source,options)=>{assert.equal(source,'web');const result=await options.capture();assert.ok((await fs.stat(result.files[0].path)).size>0);saved++;}},
 })(path.join(__dirname,'../src/app/api/backup/generate/route.ts'));
 const req=()=>new NextRequest('https://erp.example/api/backup/generate',{method:'POST'});
 admin=false;assert.equal((await route.POST(req())).status,401);admin=true;
 const response=await route.POST(req());assert.equal(response.status,200);assert.equal(await response.text(),sql);assert.equal(response.headers.get('x-backup-scope'),'schema-and-data');
 assert.equal(saved,0,'SQL response never waits for R2');await afterTask();assert.equal(saved,1);await assert.rejects(fs.stat(directory));
 large=true;const largeResponse=await route.POST(req());assert.equal(largeResponse.status,200);assert.match((await largeResponse.json()).downloadUrl,/jobs\/download/);assert.equal(saved,2);await assert.rejects(fs.stat(directory));
 console.log('PASS: independent complete SQL capture, immediate response, deferred R2 copy, safe cleanup and large-download hosting limit handling.');
})().catch(e=>{console.error(e);process.exitCode=1;});
