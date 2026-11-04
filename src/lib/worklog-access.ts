import type { NextRequest } from "next/server";
import { authenticateRequest, type SessionUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function authorizeWorklogOwner(req: NextRequest, user: SessionUser, ownerId: number, operation: "edit" | "delete") {
  if (ownerId === user.id) return null;
  if (user.role_id > 1) return { error: "You can only modify your own worklogs", status: 403 };
  const auth = await authenticateRequest(req, undefined, operation === "edit" ? "action_edit_all_worklog" : "action_delete_all_worklog");
  return "error" in auth ? auth : null;
}

export async function authorizeWorklogMutation(req: NextRequest, user: SessionUser, id: unknown, operation: "edit" | "delete") {
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) return { error: "Invalid worklog ID", status: 400 };
  const { data, error } = await supabaseAdmin.from("worklog").select("userid").eq("id", Number(id)).maybeSingle();
  if (error) return { error: "Worklog verification temporarily unavailable", status: 503 };
  if (!data) return { error: "Worklog not found", status: 404 };
  const denial = await authorizeWorklogOwner(req, user, Number(data.userid), operation);
  return denial || { ownerId: Number(data.userid) };
}
