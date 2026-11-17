import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PhotoHistoryProvider } from "@/components/photos/photo-history-provider";
import { PhotoHistoryButton } from "@/components/photos/photo-history-button";
import { RecordActions } from "@/components/ui/record-actions";
import { setBrowserPrincipal } from "@/lib/cache/principal";
setBrowserPrincipal("1_0_fixture");
const fixture = { mode: "normal", calls: [] as string[] };
Object.assign(window, { photoFixture: fixture });
const original = window.fetch.bind(window);
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#cbd5e1"/><rect x="120" y="120" width="960" height="520" rx="30" fill="#64748b"/><text x="180" y="400" font-size="60" fill="white">Material condition sample</text></svg>';
const summary = { availableCount: 3, expiredCount: 1, removedCount: 0 };
window.fetch = async (input, init) => {
  const url = String(input); fixture.calls.push(url);
  if (url.includes('/api/photos/view/')) return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } });
  if (!url.startsWith('/api/photos/')) return original(input, init);
  const request = JSON.parse(String(init?.body || '{}'));
  if (url.endsWith('/summary')) {
    if (fixture.mode === 'error') return Response.json({error:'Counts unavailable'}, {status:503});
    return Response.json({summaries: request.scopes.map((s: {kind:string;id:number;stageKey?:string})=>({key:`${s.kind}:${s.id}:${s.stageKey||''}`,summary:s.id===2?{availableCount:0,expiredCount:2,removedCount:0}:summary})),denied:[]});
  }
  const expired = request.scope.id === 2;
  return Response.json({ title: expired ? 'Expired receipt' : 'Purchase order · PO-001', summary: expired ? {availableCount:0,expiredCount:2,removedCount:0}:summary,
    nextGroupOffset:null, groups:[{id:'receipt:1',title:'Receipt SM/PR/005',eventDate:'2026-11-16',party:'Test Vendor',
      ...(expired?{availableCount:0,expiredCount:2,removedCount:0}:summary),nextPhotoOffset:null,
      photos: expired?[]:[1,2,3].map(id=>({id,original_filename:`Photo ${id}`,server_uploaded_at:'2026-11-16T10:15:12Z',uploader_name:'Test Uploader',width:1200,height:800}))}] });
};
const client = new QueryClient({defaultOptions:{queries:{retry:false}}});
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><PhotoHistoryProvider>
  <main className="min-h-[1800px] bg-slate-100 p-6 sm:p-12"><h1 className="mb-5 text-xl font-bold">Purchase inward history</h1><input aria-label="History search" defaultValue="PO-001" className="mb-6 rounded-lg border p-3" />
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-5"><div><strong>SM/PR/005</strong><p className="text-sm text-slate-500">Test Vendor · Received material</p></div><RecordActions><PhotoHistoryButton scope={{kind:'purchase_receipt',id:1}} /><button type="button" className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">Revert</button></RecordActions></div>
    <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border bg-white p-5"><span>Older receipt</span><PhotoHistoryButton scope={{kind:'purchase_receipt',id:2}} /></div>
    <section className="mt-4 rounded-xl border bg-white p-4"><h2 className="mb-3 text-sm font-semibold">Mobile purchase actions</h2><RecordActions layout="grid"><PhotoHistoryButton scope={{kind:'purchase_receipt',id:1}} /><button type="button" className="border border-emerald-200 text-emerald-700">Voucher</button><button type="button" className="border text-amber-700">Edit</button><button type="button" className="border text-blue-700">Items</button><button type="button" className="border text-rose-700">Delete</button></RecordActions></section>
    <section className="mt-4 rounded-xl border bg-white p-4"><h2 className="mb-3 text-sm font-semibold">Jobwork actions</h2><RecordActions layout="card"><button type="button" className="border text-emerald-700">Inward</button><PhotoHistoryButton scope={{kind:'purchase_receipt',id:1}} /><button type="button" className="border">Print</button><button type="button" className="border">View plates</button></RecordActions></section>
  </main>
</PhotoHistoryProvider></QueryClientProvider>);
