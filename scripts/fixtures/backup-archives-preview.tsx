import React from 'react';
import {createRoot} from 'react-dom/client';
import {ExportPage} from '@/views/export-page';
const filename='starmould_backup_2026-11-17_12-50-22_IST.sql';
let files=[{key:'database/2026-11-17/midday/attempt/'+filename,filename,size:421775,modified:'2026-11-17T07:20:22Z'}];
window.fetch=async (_input,init)=>{
 if(init?.method==='DELETE'){files=[];return Response.json({deleted:true,metadataUpdated:true});}
 return Response.json({bucket:'test-private',files,nextCursor:null});
};
createRoot(document.getElementById('root')!).render(<ExportPage/>);
