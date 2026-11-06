import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SubplatePage } from "@/views/subplate-page";

const scans = [{ id: 42, projectid: "0042_KEEP_003", description: "Fixture mould", cname: "Fixture customer", worktype: "Pulp Mould", status: "pending" }];
const base = { projectid: "42", mold_id: 42, mold_code: "0042_KEEP_003", material: "MS-Bright", shape: "Plate", unit: "mm", length: 100, width: 50, height: 20, weight: 0.781, sqty: 4, location: "SM", plate_category: "General Component" };
const plates = [
  { ...base, id: 7, platename: "Fixture cavity", subprojectid: "0042_KEEP_003_001", design_by: 2, order_by: 1, ordered_qty: 2, remaining_qty: 2, po_status: "PARTIAL", inward_qty: 1, remaining_inward_qty: 3, dispatched_qty: 1, remaining_dispatch_qty: 3, dispatch_status: "partial", linked_pos: [{ po_id: 1, po_srno: "FIXPO1", qty: 2 }], linked_dispatches: [{ dispatch_id: 1, challanno: "FIXDC1", qty: 1, created_by: "Fixture admin" }] },
  { ...base, id: 8, platename: "Fixture base", subprojectid: "0042_KEEP_003_002" },
  { ...base, id: 9, platename: "Fixture completed", subprojectid: "0042_KEEP_003_003", order_by: 1, ordered_qty: 4, po_status: "FULLY_ORDERED", inward_qty: 4, inward_status: "FULLY_INWARDED", dispatched_qty: 4, location: "Customer", linked_pos: [{ po_id: 1, po_srno: "FIXPO1", qty: 2 }, { po_id: 2, po_srno: "FIXPO2", qty: 2 }], linked_dispatches: [{ dispatch_id: 1, challanno: "FIXDC1", qty: 2 }, { dispatch_id: 2, challanno: "FIXDC2", qty: 2 }] },
];
const state = { scans, plates, user: { id: 1, name: "Fixture admin", role_id: 0, role: "Admin" }, staff: [{ id: 1, name: "Fixture admin", status: 1, role_id: 0 }, { id: 2, name: "Fixture designer", status: 1, role_id: 3 }], denied: [] as string[], events: [] as any[], loading: false, failSave: false };
(window as any).subplateFixture = state;
window.fetch = async (url, init) => { state.events.push({ type: "request", url: String(url), method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : null }); return Response.json({ success: true }); };
window.confirm = () => { state.events.push({ type: "confirm" }); return true; };
window.alert = (message) => { state.events.push({ type: "alert", message }); };
const client = new QueryClient();
function Preview() {
  const [, rerender] = useState(0);
  (window as any).subplateTest = { configure: (patch: object) => { Object.assign(state, patch); rerender((n) => n + 1); } };
  return <QueryClientProvider client={client}><SubplatePage /></QueryClientProvider>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
