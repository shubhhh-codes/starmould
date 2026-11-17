import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authorizePhotoHistory } from "./history-access";
import { parsePhotoHistoryScope, photoHistoryKey } from "./history-types";

export class PhotoHistoryError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function historyScopes(req: NextRequest, values: unknown) {
  if (!Array.isArray(values) || values.length < 1 || values.length > 100) throw new PhotoHistoryError("Request 1 to 100 photo scopes", 400);
  const scopes = [...new Map(values.map(value => {
    const scope = parsePhotoHistoryScope(value);
    return [photoHistoryKey(scope), scope] as const;
  })).values()];
  const authorized = [];
  const denied: string[] = [];
  // Bound access verification rather than issuing hundreds of parallel queries.
  for (let start = 0; start < scopes.length; start += 10) {
    const results = await Promise.all(scopes.slice(start, start + 10).map(async scope => ({ scope, access: await authorizePhotoHistory(req, scope) })));
    for (const { scope, access } of results) {
      if ("error" in access) {
        if (access.status === 403 || access.status === 404) { denied.push(photoHistoryKey(scope)); continue; }
        throw new PhotoHistoryError(access.error!, access.status!);
      }
      authorized.push({ key: photoHistoryKey(scope), scope, includeChildren: access.includeChildren });
    }
  }
  return { authorized, denied };
}
export function historyFailure(error: unknown) {
  if (error instanceof PhotoHistoryError) return { error: error.message, status: error.status };
  if (error instanceof SyntaxError || (error instanceof Error && /scope/.test(error.message))) return { error: "Invalid photo history request", status: 400 };
  console.error("Photo history request failed", error instanceof Error ? error.message : "Unknown error");
  return { error: "Photo history is temporarily unavailable. Please retry.", status: 503 };
}
export async function readHistoryPage(req: NextRequest, body: Record<string, unknown>) {
  const { authorized, denied } = await historyScopes(req, [body.scope]);
  if (denied.length) throw new PhotoHistoryError("Photo history access denied or record unavailable", 403);
  const offset = (v: unknown) => { if (v === undefined) return 0; if (!Number.isSafeInteger(v) || Number(v) < 0) throw new PhotoHistoryError("Invalid photo history offset", 400); return Number(v); };
  if (body.groupId !== undefined && (typeof body.groupId !== "string" || body.groupId.length > 160)) throw new PhotoHistoryError("Invalid group identifier", 400);
  const { data, error } = await supabaseAdmin.rpc("photo_history_page", {
    p_scope: authorized[0].scope, p_children: authorized[0].includeChildren,
    p_group_offset: offset(body.groupOffset), p_group_id: body.groupId || null, p_photo_offset: offset(body.photoOffset),
  });
  if (error) throw new PhotoHistoryError("Photo history unavailable. Check that the gallery migration is applied.", 503);
  return data;
}
