import { supabaseAdmin } from "@/lib/supabase/admin";
import { ExportDatasetResult, ExportColumn } from "../contracts";

interface BuildUsersOptions {
  filters?: Record<string, any>;
  search?: string;
  scope?: "filtered" | "selected";
  selectedIds?: (string | number)[];
  hasFinancialAccess: boolean;
  format: "xlsx" | "pdf" | "csv";
}

export async function buildUsersDataset(
  options: BuildUsersOptions
): Promise<ExportDatasetResult> {
  const { search, scope, selectedIds, format } = options;

  const maxRows = format === "pdf" ? 500 : 5000;

  const columns: ExportColumn[] = [
    { key: "sr_no",       header: "Sr. No",       type: "number", width: 8,  center: true },
    { key: "name",        header: "Full Name",    type: "string", width: 24, center: true },
    { key: "username",    header: "Username",     type: "string", width: 18, center: true },
    { key: "initials",    header: "Initials",     type: "string", width: 12, center: true },
    { key: "role",        header: "Role",         type: "string", width: 18, center: true },
    { key: "usertype",    header: "User Type",    type: "string", width: 16, center: true },
    { key: "usersubtype", header: "User Subtype", type: "string", width: 18, center: true },
    { key: "email",       header: "Email",        type: "string", width: 28, center: true },
    { key: "status",      header: "Status",       type: "string", width: 14, center: true },
  ];

  // Strictly select safe fields only - NEVER password_hash or remember_token
  let query = supabaseAdmin
    .from("users")
    .select("id, username, name, initials, usertype, usersubtype, role_id, email, status, created_at")
    .is("deleted_at", null)
    .order("id", { ascending: true })
    .limit(maxRows + 1);

  if (scope === "selected" && Array.isArray(selectedIds) && selectedIds.length > 0) {
    query = query.in("id", selectedIds);
  }

  const [usersRes, rolesRes] = await Promise.all([
    query,
    supabaseAdmin.from("roles").select("id, name, display_name"),
  ]);

  if (usersRes.error) throw new Error(`Failed to query users: ${usersRes.error.message}`);

  const roleMap = new Map<number, string>();
  for (const r of rolesRes.data || []) {
    roleMap.set(r.id, r.display_name || r.name);
  }

  const allUsers = usersRes.data || [];
  const queryStr = (search || "").trim().toLowerCase();

  const formatted = allUsers.map((u) => ({
    id:          u.id,
    name:        u.name || "",
    username:    u.username || "",
    initials:    u.initials || "",
    role:        roleMap.get(u.role_id) || `Role ${u.role_id}`,
    usertype:    u.usertype || "",
    usersubtype: u.usersubtype || "",
    email:       u.email || "",
    status:      Number(u.status) === 1 ? "Active" : "Inactive",
  }));

  const filtered = formatted.filter((u) => {
    if (!queryStr) return true;
    return (
      u.name.toLowerCase().includes(queryStr) ||
      u.username.toLowerCase().includes(queryStr) ||
      u.initials.toLowerCase().includes(queryStr) ||
      u.role.toLowerCase().includes(queryStr) ||
      u.usertype.toLowerCase().includes(queryStr) ||
      u.email.toLowerCase().includes(queryStr)
    );
  });

  const rows = filtered.map((u, idx) => ({
    sr_no: idx + 1,
    ...u,
  }));

  const filtersApplied: Record<string, string> = {};
  if (search) filtersApplied["Search Query"] = search;

  return {
    title: "System User Directory",
    subtitle: "Authorized internal system user accounts, roles, and departmental designations",
    columns,
    rows,
    totalCount: rows.length,
    generatedAt: new Date().toISOString(),
    filtersApplied,
  };
}
