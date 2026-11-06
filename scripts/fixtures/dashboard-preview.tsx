import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MouldProjectsTable } from "../../src/components/dashboard/mould-projects-table";
import type { ScanProject } from "../../src/lib/supabase/types";

const plate = { id: 201, projectid: 20, platename: "Fixture plate", subprojectid: "0020_TEST_020_001", shape: "Plate", material: "MS-Bright", length: 100, width: 50, height: 20, unit: "mm", sqty: 1, weight: 0.781, location: "SM", po_inward_qty: 0 };
const records = Array.from({ length: 20 }, (_, index) => ({
  id: index + 1, projectid: `${String(index + 1).padStart(4, "0")}_TEST_${String(index + 1).padStart(3, "0")}`,
  cname: index % 2 ? "Fixture Beta" : "Fixture Alpha", customername: index % 2 ? "Fixture Beta" : "Fixture Alpha",
  customer_id: index % 2 ? 2 : 1, description: `Fixture mould ${index + 1}`, worktype: index % 2 ? "TF" : "Pulp Mould",
  rdate: `2026-10-${String(index + 1).padStart(2, "0")}`, cdate: "2026-12-01", status: "pending", total_plates: index === 19 ? 1 : 0,
  completed_plates: 0, amount: 100, payment: 0, subplates: index === 19 ? [plate] : [],
})) as unknown as ScanProject[];
const state = { user: { id: 1, name: "Fixture admin", role_id: 0, role: "Admin" }, denied: [] as string[], staff: [{ id: 1, name: "Fixture admin", status: 1, role_id: 0 }, { id: 2, name: "Fixture designer", status: 1, role_id: 3 }], events: [] as any[], requests: [] as any[], failures: {} as Record<string, boolean>, loading: false, records, bulkDelete: true, singleDelete: true, deleteResult: true, lazyPlates: [plate] };
(window as any).dashboardFixture = state;
window.fetch = async (input, init) => {
  const url = String(input);
  if (!url.startsWith('/api/')) throw new Error(`Unexpected fixture network call: ${url}`);
  const request = { url, method: init?.method || "GET", body: init?.body ? JSON.parse(String(init.body)) : null };
  state.requests.push(request); state.events.push({ type: "request", ...request });
  if (state.failures[url] || state.failures[request.method]) return Response.json({ error: "Fixture request failed" }, { status: 500 });
  if (url.includes("dependencies")) return Response.json({ blocked: false, dependencies: {}, hasDependencies: false });
  return Response.json({ subplates: state.lazyPlates, subplate: plate, success: true, dependencies: {}, blocked: false });
};
window.print = () => { state.events.push({ type: "print" }); };
const blobUrls = new Map<string, Blob>();
URL.createObjectURL = (blob) => { const url = `blob:fixture-${blobUrls.size}`; blobUrls.set(url, blob as Blob); return url; };
HTMLAnchorElement.prototype.click = function () { if (this.download) state.events.push({ type: "download", filename: this.download, text: blobUrls.get(this.href)?.text() }); };
const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
client.invalidateQueries = ((filters: unknown) => { state.events.push({ type: "invalidate", filters }); return Promise.resolve(); }) as typeof client.invalidateQueries;
function Preview() {
  const [, rerender] = useState(0);
  (window as any).dashboardTest = {
    configure: (patch: object) => { Object.assign(state, patch); rerender((n) => n + 1); },
    resetEvents: () => { state.events.length = 0; state.requests.length = 0; },
    downloadText: async () => { const event = state.events.findLast((e) => e.type === "download"); return event ? { filename: event.filename, text: await event.text } : null; },
  };
  return <QueryClientProvider client={client}><MouldProjectsTable initialData={state.records} isLoading={state.loading}
    onRefresh={() => { state.events.push({ type: "refresh" }); }}
    onDeleteProjects={state.bulkDelete ? async (ids, force) => { state.events.push({ type: "bulk-delete", ids, force }); return state.deleteResult; } : undefined}
    onDeleteProject={state.singleDelete ? async (id, force) => { state.events.push({ type: "single-delete", id, force }); return state.deleteResult; } : undefined}
  /></QueryClientProvider>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
