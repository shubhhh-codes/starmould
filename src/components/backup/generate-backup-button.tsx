"use client";
import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { principalFetch as fetch } from '@/lib/query/principal-fetch';

type Props = { disabled?: boolean; onMessage: (message: string) => void; onError: (message: string) => void;
  onDownload: (url: string, filename: string) => void; onComplete: () => void };
export function GenerateBackupButton({disabled,onMessage,onError,onDownload,onComplete}: Props) {
  const [generating,setGenerating]=useState(false);
  const lock=useRef(false),controller=useRef<AbortController | null>(null),objectUrl=useRef('');
  useEffect(()=>()=>{controller.current?.abort();if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);},[]);
  async function generate(){
    if(lock.current)return;
    lock.current=true;setGenerating(true);onError('');onDownload('','');
    onMessage('Creating your complete SQL backup on the server…');
    const abort=new AbortController();controller.current=abort;
    try{
      const response=await fetch('/api/backup/generate',{method:'POST',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(300000)])});
      if(!response.ok){const body=await response.json();throw Error(body.error||'Could not create backup');}
      let url:string,filename:string;
      if(response.headers.get('content-type')?.includes('application/json')){
        const body=await response.json();url=body.downloadUrl;filename=body.filename;
        if(typeof url!=='string'||!url.startsWith('/api/backup/jobs/download?'))throw Error('Invalid backup download');
        onMessage('Complete SQL backup saved and verified. Download requested.');
      }else{
        filename=response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1]||'starmould_backup.sql';
        if(objectUrl.current)URL.revokeObjectURL(objectUrl.current);
        url=URL.createObjectURL(await response.blob());objectUrl.current=url;
        onMessage('Complete SQL download requested. A copy is being saved on the server.');
      }
      onDownload(url,filename);
      const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
      onComplete();
    }catch(error){
      if(!abort.signal.aborted){onMessage('');onError(error instanceof Error&&error.name==='TimeoutError'?'Backup generation timed out. Please retry.':error instanceof Error?error.message:'Could not create backup');}
    }finally{lock.current=false;setGenerating(false);}
  }
  return <button type="button" disabled={disabled||generating} onClick={()=>void generate()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"><Download className="h-4 w-4" />{generating?'Generating backup…':'Generate & download'}</button>;
}
