import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { invalidateCache } from "@/lib/cache";
import { readBoundedBody, RequestBodyTooLarge } from "@/lib/bounded-body";

const operations = {
  purchase: { permission: "action_create_purchase", result: "purchase" },
  "purchase-receipt": { permission: "action_create_purchase_inward", result: "receipt" },
  challan: { permission: "action_create_challan", result: "challan" },
  "jobwork-receipt": { permission: "action_create_inward", result: "inward" },
  dispatch: { permission: "action_create_dispatch", result: "dispatch" },
} as const;

export async function createInventoryDocument(req: NextRequest, operation: keyof typeof operations) {
  const definition = operations[operation];
  const auth = await authenticateRequest(req, undefined, definition.permission);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const key = req.headers.get("Idempotency-Key");
  if (!key || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) {
    return NextResponse.json({ error: "A valid Idempotency-Key header is required" }, { status: 400 });
  }
  let body: unknown;
  try { body = JSON.parse(new TextDecoder().decode(await readBoundedBody(req, 1024 * 1024))); } catch (error) {
    if (error instanceof RequestBodyTooLarge) return NextResponse.json({ error: "Document request exceeds 1 MiB" }, { status: 413 });
    return NextResponse.json({ error: "Invalid JSON request" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Document body required" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin.rpc("create_inventory_document", {
    p_operation: operation, p_actor: auth.user.id, p_key: key, p_body: body,
  });
  if (error) {
    console.error("create_inventory_document RPC error:", error);
    const invalid = ["22023", "22P02", "22003", "22007", "22008", "23503", "23502"].includes(error.code);
    const conflict = ["P0001", "23505", "23514"].includes(error.code);
    return NextResponse.json({ error: invalid ? "Invalid document, source line, quantity or party relationship" :
      conflict ? error.message : "Document creation temporarily unavailable; retry with the same Idempotency-Key" },
      { status: invalid ? 400 : conflict ? 409 : 503 });
  }
  if (!data) return NextResponse.json({ error: "Document result unavailable; retry with the same Idempotency-Key" }, { status: 503 });
  for (const prefix of ["api_counts_all", "api_pipeline_stage_counts", "scanning_default_", "subplate_default_",
    "shared_scans_lookup", "scanning_kpi_metrics_v2", "subplates_worklog_lookup"]) invalidateCache(prefix);
  const message = operation === "challan" ? "Outward Challan created successfully" :
    operation === "jobwork-receipt" ? "Job Work Inward recorded successfully" : undefined;
  return NextResponse.json({ [definition.result]: data, ...(message ? { message } : {}) },
    { status: 201, headers: { "Cache-Control": "no-store" } });
}
