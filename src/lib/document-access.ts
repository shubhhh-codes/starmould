import { NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifySecurePrintToken } from "@/lib/print-token";

const documents = {
  purchase: { permission: "nav_purchase", table: "purchase" },
  quotation: { permission: "nav_quotation", table: "quotations" },
  challan: { permission: "nav_challan", table: "challan" },
  dispatch: { permission: "nav_dispatch", table: "dispatch" },
  inward: { permission: "nav_inward", table: "inward" },
  work: { permission: "nav_work", table: "worklog" },
  sample: { permission: "nav_scanning", table: "scan" },
  subplate: { permission: "nav_subplate", table: "subplate" },
} as const;

export type DocumentType = keyof typeof documents;
type Denial = { error: string; status: number };

/** Print links identify a document; they never replace current authorization. */
export async function authorizeDocumentRead(
  req: NextRequest, type: unknown, id: unknown,
): Promise<{ type: DocumentType; id: string } | Denial> {
  if (typeof type !== "string" || !Object.hasOwn(documents, type) ||
      !["string", "number"].includes(typeof id) || !/^[1-9]\d*$/.test(String(id)) ||
      !Number.isSafeInteger(Number(id))) {
    return { error: "Invalid document type or ID", status: 400 };
  }
  const documentType = type as DocumentType;
  const definition = documents[documentType];
  const auth = await authenticateRequest(req, undefined, definition.permission);
  if ("error" in auth) return auth;
  const { data, error } = await supabaseAdmin.from(definition.table)
    .select("*").eq("id", String(id)).maybeSingle();
  if (error) return { error: "Document verification temporarily unavailable", status: 503 };
  if (!data || data.deleted_at) return { error: "Document not found", status: 404 };
  if (documentType === "work" && auth.user.role_id > 1 && Number(data.userid) !== auth.user.id) {
    return { error: "Access denied: worklog belongs to another user", status: 403 };
  }
  return { type: documentType, id: String(id) };
}

export async function resolveDocumentRequest(req: NextRequest, expectedType?: DocumentType) {
  const params = req.nextUrl.searchParams;
  let type = params.get("type") || expectedType;
  let id = params.get("id");
  const token = params.get("token") || (id?.includes(".") ? id : null);
  if (!token) {
    return { error: "Access denied: Document must be accessed using a secure encrypted link.", status: 403 };
  }
  const decoded = verifySecurePrintToken(token);
  if (!decoded || (type && decoded.type !== type) ||
      (params.has("token") && id && id !== decoded.id)) {
    return { error: "Invalid or mismatched print token", status: 400 };
  }
  type = decoded.type;
  id = decoded.id;
  if (expectedType && type !== expectedType) {
    return { error: "Incorrect document type", status: 400 };
  }
  return authorizeDocumentRead(req, type, id);
}
