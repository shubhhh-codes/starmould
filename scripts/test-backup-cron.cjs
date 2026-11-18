const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {NextRequest}=require('next/server'),{createTypeScriptLoader}=require('./lib/load-typescript.cjs');
(async()=>{
 let enabled=true,paused=false,ensured=0,dispatched=0,claims=0;
 const callbacks=[];
 const store={settings:async()=>({paused}),heartbeat:async()=>{},expireMissed:async()=>{},claim:async()=>++claims===1?{id:'2026-11-17/morning'}:null,pool:{query:async()=>({rows:[]})},ensureScheduled:async()=>{ensured++;},pending:async()=>[{id:'2026-11-17/morning'}]};
 const load=createTypeScriptLoader(undefined,{
  'next/server':{...require('next/server'),after:callback=>callbacks.push(callback)},
  '@/lib/backup/jobs':{jobsEnabled:()=>enabled,backupStore:()=>store},
  '../../../../../scripts/backup/storage.cjs':{Storage:class {client={destroy(){}}}},
  '../../../../../scripts/backup/app-capture.cjs':{captureApplicationBackup:async()=>{}},
  '../../../../../scripts/backup/runner.cjs':{retention:async()=>{},executeJob:async(_s,_r,id,source,options)=>{assert.equal(id,'2026-11-17/morning');assert.equal(source,'server-cron');assert.equal(typeof options.capture,'function');dispatched++;return{status:'completed'};}},
 });
 const route=load(path.join(__dirname,'../src/app/api/backup/cron/route.ts')),slots=load(path.join(__dirname,'../src/app/api/backup/cron/[slot]/route.ts'));
 const old=process.env.CRON_SECRET;process.env.CRON_SECRET='test-only-random-secret-0123456789';
 const req=token=>new NextRequest('https://erp.example/api/backup/cron/morning',{headers:token?{authorization:'Bearer '+token}:{}});
 try{
 assert.equal((await route.GET(req())).status,401);assert.equal((await route.GET(req('wrong'))).status,401);assert.equal(ensured,0);
 const valid=()=>req(process.env.CRON_SECRET);
 enabled=false;assert.equal((await route.GET(valid())).status,503);assert.equal(ensured,0);enabled=true;
 paused=true;assert.equal((await (await route.GET(valid())).json()).paused,true);assert.equal(ensured,0);paused=false;
 assert.equal(JSON.parse(fs.readFileSync(path.join(__dirname,'../vercel.json'),'utf8')).crons,undefined);
 assert.equal((await route.GET(valid())).status,202);assert.equal(dispatched,0,'HTTP admission must not wait for capture');
 assert.equal((await route.GET(valid())).status,200);assert.equal(callbacks.length,1,'duplicate cannot schedule another capture');
 await callbacks.shift()();assert.equal(dispatched,1);
 assert.equal((await slots.GET(valid(),{params:Promise.resolve({slot:'invalid'})})).status,400);
 console.log('PASS: four daily independent full-SQL cron routes; bearer and pause gating without GitHub or tokens.');
 }finally{if(old===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=old;}
})().catch(e=>{console.error(e);process.exitCode=1;});
