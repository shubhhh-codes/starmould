import React from 'react';
import {createRoot} from 'react-dom/client';
import {ExportPage} from '@/views/export-page';
const filename='starmould_backup_2026-11-17_12-50-22_IST.sql';
let files=[{key:'database/2026-11-17/midday/attempt/'+filename,filename,size:421775,modified:'2026-11-17T07:20:22Z'}];
const fixture={fail:false,posts:0,polls:0};Object.assign(window,{backupGenerationFixture:fixture});
window.fetch=async (_input,init)=>{
 const url=String(_input);
 if(url==='/api/backup/jobs') return Response.json({configured:true,paused:false,workerHealthy:true,jobs:[]});
 if(url==='/api/backup/generate'&&init?.method==='POST'){
  fixture.posts++;await new Promise(resolve=>setTimeout(resolve,600));
  if(fixture.fail)return Response.json({error:'Generation unavailable'},{status:503});
  return new Response('-- PostgreSQL database dump\nCREATE TABLE public.fixture(id bigint);',{headers:{'Content-Type':'application/sql','Content-Disposition':`attachment; filename="${filename}"`}});
 }
 if(url.startsWith('/api/backup/jobs?id=')){fixture.polls++;return Response.json({job:{id:'manual/7/fixture',status:fixture.polls>1?'completed':'running',attempts:1}});}
 if(init?.method==='DELETE'){files=[];return Response.json({deleted:true,metadataUpdated:true});}
 return Response.json({bucket:'test-private',files,nextCursor:null});
};
createRoot(document.getElementById('root')!).render(<ExportPage/>);
