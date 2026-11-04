import crypto from "crypto";
import { DEFAULT_ROLE_PERMISSIONS } from "./defaults";
import { loadEffectivePermissions } from "./loader";

export async function rolePermissionVersion(role: number): Promise<string> {
  const permissions = role === 0 ? DEFAULT_ROLE_PERMISSIONS[0] : (await loadEffectivePermissions())[role] || {};
  const normalized = Object.fromEntries(Object.entries(permissions).sort(([a], [b]) => a.localeCompare(b)));
  return crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex").slice(0, 24);
}
