import { NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { authorizeDocumentRead } from "@/lib/document-access";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const ATTACHMENT_BUCKETS = new Set(["subplate-photos", "mould-attachments", "general-attachments"]);
const actions: Record<string, string> = {
  subplate: "action_edit_subplate", sample: "action_edit_mould", purchase: "action_edit_purchase",
  quotation: "action_edit_quotation", challan: "action_create_challan", dispatch: "action_create_dispatch",
  inward: "action_create_inward", work: "action_edit_worklog", expense: "action_manage_expenses",
};

export async function authorizeAttachment(req: NextRequest, type: string, id: string, write = false) {
  if (!Object.hasOwn(actions, type) || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return { error: "Valid attachment document required", status: 400 };
  const auth = await authenticateRequest(req, undefined, write ? actions[type] : type === "expense" ? "nav_expense" : undefined);
  if ("error" in auth) return auth;
  if (type !== "expense") {
    const read = await authorizeDocumentRead(req, type, id);
    if ("error" in read) return read;
  } else {
    const { data, error } = await supabaseAdmin.from("expense").select("id").eq("id", Number(id)).maybeSingle();
    if (error) return { error: "Attachment authorization temporarily unavailable", status: 503 };
    if (!data) return { error: "Document not found", status: 404 };
  }
  return { user: auth.user };
}
