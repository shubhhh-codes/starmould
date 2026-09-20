"use client";

import React, { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  ShieldCheck,
  Plus,
  Search,
  User,
  Key,
  Mail,
  Hash,
  Pencil,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Printer,
  Shield,
  Briefcase,
  ToggleLeft,
  ToggleRight,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";
import rawUsers from "@/lib/mock-users.json";
import {
  ROLES_TABLE,
  ALL_ROLES,
  USER_TYPES,
  USER_SUBTYPES,
  getRoleForUserType,
  getRoleById,
  getAutoUserSubtype,
  type RoleDefinition,
  type UserType,
  type UserSubtype,
} from "@/lib/roles";

export interface UserRecord {
  id: number;
  name: string;
  username: string;
  initials: string;
  email: string;
  usertype: UserType | string;
  usersubtype: UserSubtype | string;
  role_id: number; // Foreign key referencing public.roles(id)
  status: number; // 1: Active, 0: Inactive
  created_at?: string;
  updated_at?: string;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserRecord[]>(rawUsers as UserRecord[]);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);

  // Form states
  const [formData, setFormData] = useState<{
    id?: number;
    name: string;
    username: string;
    initials: string;
    email: string;
    password: string; // Strictly write-only!
    usertype: UserType;
    usersubtype: UserSubtype;
    status: number;
  }>({
    name: "",
    username: "",
    initials: "",
    email: "",
    password: "",
    usertype: "User",
    usersubtype: "Skilled MP",
    status: 1,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);

  // Filter and search
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Role filter
      if (selectedRoleFilter !== "All" && u.usertype !== selectedRoleFilter) {
        return false;
      }
      // Status filter
      if (statusFilter === "Active" && u.status !== 1) return false;
      if (statusFilter === "Inactive" && u.status !== 0) return false;

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.initials.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    });
  }, [users, selectedRoleFilter, statusFilter, searchQuery]);

  // Counts by Role
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { All: users.length };
    USER_TYPES.forEach((t) => (counts[t] = 0));
    users.forEach((u) => {
      if (counts[u.usertype] !== undefined) {
        counts[u.usertype]++;
      }
    });
    return counts;
  }, [users]);

  // Pagination slice
  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  // Open Add modal
  const handleOpenAdd = () => {
    setModalMode("add");
    setSelectedUser(null);
    setFormData({
      name: "",
      username: "",
      initials: "",
      email: "",
      password: "",
      usertype: "User",
      usersubtype: "Skilled MP",
      status: 1,
    });
    setShowPassword(false);
    setInitialError(null);
    setUsernameError(null);
    setIsModalOpen(true);
  };

  // Open Edit modal (Notice: password is empty string, never pre-populated or shown!)
  const handleOpenEdit = (user: UserRecord) => {
    setModalMode("edit");
    setSelectedUser(user);
    setFormData({
      id: user.id,
      name: user.name,
      username: user.username,
      initials: user.initials,
      email: user.email,
      password: "", // Write-only! Never populated from db or password2
      usertype: (user.usertype as UserType) || "User",
      usersubtype: (user.usersubtype as UserSubtype) || "Skilled MP",
      status: user.status,
    });
    setShowPassword(false);
    setInitialError(null);
    setUsernameError(null);
    setIsModalOpen(true);
  };

  // Legacy validation: checkinitial
  // Source: UserController.php lines 256-262: UserModel::where('initials', $initials)->exists()
  const validateInitials = (val: string) => {
    const clean = val.replace(/\s+/g, "").toUpperCase().slice(0, 3);
    setFormData((prev) => ({ ...prev, initials: clean }));
    if (!clean) {
      setInitialError("Initials are required (max 3 letters).");
      return false;
    }
    const currentId = selectedUser?.id;
    const exists = users.some(
      (u) => u.initials.toUpperCase() === clean && u.id !== currentId
    );
    if (exists) {
      setInitialError("Initial already exists!");
      return false;
    }
    setInitialError(null);
    return true;
  };

  // Validation: username uniqueness
  const validateUsername = (val: string) => {
    const clean = val.trim();
    if (!clean) {
      setUsernameError("Username is required.");
      return false;
    }
    const currentId = selectedUser?.id;
    const exists = users.some(
      (u) =>
        u.username.trim().toLowerCase() === clean.toLowerCase() &&
        u.id !== currentId
    );
    if (exists) {
      setUsernameError("Username already exists.");
      return false;
    }
    setUsernameError(null);
    return true;
  };

  // Usertype change handler with auto-subtype rule
  // Source: UserController.php lines 75-80:
  // "if ($request->usertype == 'Admin' || $request->usertype == 'Manager' ||
  //      $request->usertype == 'Supervisor' || $request->usertype == 'Designer') {
  //     $model->usersubtype = 'Skilled MP';
  //  }"
  const handleUsertypeChange = (newUsertype: UserType) => {
    const autoSubtype = getAutoUserSubtype(newUsertype);
    setFormData((prev) => ({
      ...prev,
      usertype: newUsertype,
      usersubtype: autoSubtype || prev.usersubtype,
    }));
  };

  // Toggle user status (Active/Inactive)
  const handleToggleStatus = (user: UserRecord) => {
    const newStatus = user.status === 1 ? 0 : 1;
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u))
    );
  };

  // Submit form
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInitials(formData.initials)) return;
    if (!validateUsername(formData.username)) return;

    // Role assignment using Phase 1 roles table definition via getRoleForUserType
    // Source: UserController.php store() lines 81-95 mapped cleanly to roles table
    const assignedRole = getRoleForUserType(formData.usertype);

    // Auto-set usersubtype check
    const finalSubtype =
      getAutoUserSubtype(formData.usertype) || formData.usersubtype;

    if (modalMode === "add") {
      const newUser: UserRecord = {
        id: Math.max(...users.map((u) => u.id), 0) + 1,
        name: formData.name.trim(),
        username: formData.username.trim(),
        initials: formData.initials.trim().toUpperCase(),
        email: formData.email.trim(),
        usertype: formData.usertype,
        usersubtype: finalSubtype,
        role_id: assignedRole.id, // Using roles table foreign key
        status: formData.status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setUsers([newUser, ...users]);
    } else if (modalMode === "edit" && selectedUser) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id
            ? {
                ...u,
                name: formData.name.trim(),
                username: formData.username.trim(),
                initials: formData.initials.trim().toUpperCase(),
                email: formData.email.trim(),
                usertype: formData.usertype,
                usersubtype: finalSubtype,
                role_id: assignedRole.id,
                status: formData.status,
                updated_at: new Date().toISOString(),
              }
            : u
        )
      );
    }
    setIsModalOpen(false);
  };

  // Soft delete user
  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  // Export CSV (Never includes passwords!)
  const handleExportCSV = () => {
    const headers = [
      "ID",
      "Name",
      "Username",
      "Initials",
      "User Type",
      "User Subtype",
      "Email",
      "Role (Roles Table)",
      "Status",
    ];
    const rows = filteredUsers.map((u) => {
      const roleDef = getRoleById(u.role_id);
      return [
        u.id,
        `"${u.name.replace(/"/g, '""')}"`,
        `"${u.username.replace(/"/g, '""')}"`,
        `"${u.initials}"`,
        `"${u.usertype}"`,
        `"${u.usersubtype}"`,
        `"${u.email}"`,
        `"${roleDef.display_name} (id:${roleDef.id})"`,
        u.status === 1 ? "Active" : "Inactive",
      ];
    });
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `starmould_users_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isAutoSubtypeLocked = Boolean(getAutoUserSubtype(formData.usertype));

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Module Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
              <span>Administration</span>
              <span>/</span>
              <span className="text-slate-600 dark:text-slate-300">Staff & Access Control</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              User Management
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300">
                `users` & `roles` Tables
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Role-based access control, operator profiles & credentials (Write-only passwords, Zero plaintext `password2`)
            </p>
          </div>
        </div>
        {/* Top Control Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* User Type / Role Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
            {(["All", ...USER_TYPES] as const).map((tab) => {
              const isActive = selectedRoleFilter === tab;
              const count = roleCounts[tab] || 0;
              return (
                <button
                  key={tab}
                  onClick={() => {
                    setSelectedRoleFilter(tab);
                    setCurrentPage(1);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold border border-slate-200/80 dark:border-slate-700"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>{tab}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                      isActive
                        ? "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                        : "bg-slate-200/60 dark:bg-slate-800 text-slate-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm"
              title="Export filtered users (strictly without credentials)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Print</span>
            </button>
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add User</span>
            </button>
          </div>
        </div>

        {/* Toolbar: Search, Status Filter & Page Size */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by name, username, initials, email..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Status Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Status:</span>
                {(["All", "Active", "Inactive"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      setStatusFilter(st);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded text-xs transition ${
                      statusFilter === st
                        ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 font-medium"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {/* Rows Per Page */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Rows:
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none dark:text-white"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* User Table (Replicates legacy datatable-buttons5 without plaintext passwords) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4 w-[22%]">Name</th>
                  <th className="py-3 px-3 w-[14%]">User Name</th>
                  <th className="py-3 px-3 w-[8%] text-center">Initials</th>
                  <th className="py-3 px-3 w-[12%]">User Type</th>
                  <th className="py-3 px-3 w-[12%]">User Subtype</th>
                  <th className="py-3 px-4 w-[16%]">Email</th>
                  <th className="py-3 px-3 w-[10%] text-center">Status</th>
                  <th className="py-3 px-4 w-[10%] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>No user records found matching criteria.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((u) => {
                    const roleDef = getRoleById(u.role_id);
                    const isActive = u.status === 1;

                    return (
                      <tr
                        key={u.id}
                        className={`transition-colors ${
                          isActive
                            ? "bg-emerald-50/25 dark:bg-emerald-950/10 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/40 opacity-75"
                        }`}
                      >
                        {/* Name & Role Badge from roles table */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-[11px] shrink-0 border border-blue-200/60 dark:border-blue-900">
                              {u.initials.slice(0, 2) || "U"}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <span>{u.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium border ${roleDef.badge_color}`}
                                  title={`Roles table id:${roleDef.id} - ${roleDef.description}`}
                                >
                                  {roleDef.display_name}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Username */}
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                          @{u.username}
                        </td>

                        {/* Initials */}
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {u.initials}
                          </span>
                        </td>

                        {/* Usertype */}
                        <td className="py-3 px-3">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {u.usertype}
                          </span>
                        </td>

                        {/* Usersubtype */}
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">
                            {u.usersubtype}
                          </span>
                        </td>

                        {/* Email */}
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 truncate max-w-[190px]">
                          <div className="flex items-center gap-1.5" title={u.email}>
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{u.email}</span>
                          </div>
                        </td>

                        {/* Status (Toggle switch replicating legacy on/off status) */}
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition cursor-pointer border ${
                              isActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                                : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                            }`}
                            title="Click to toggle Active / Inactive status"
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isActive ? "bg-emerald-500" : "bg-slate-400"
                              }`}
                            />
                            <span>{isActive ? "Active" : "Inactive"}</span>
                          </button>
                        </td>

                        {/* Action buttons */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(u)}
                              className="px-2.5 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900 rounded hover:bg-blue-50 dark:hover:bg-blue-950/60 transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteTarget(u)}
                              className="px-2 py-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded hover:bg-rose-50 dark:hover:bg-rose-950/60 transition"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            <div>
              Showing{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {filteredUsers.length === 0
                  ? 0
                  : (currentPage - 1) * pageSize + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {Math.min(currentPage * pageSize, filteredUsers.length)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {filteredUsers.length}
              </span>{" "}
              users
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
              >
                Previous
              </button>
              <span className="px-3 py-1 font-mono text-xs">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* ADD / EDIT USER MODAL (Strictly NO password2 column; write-only password) */}
        {/* ========================================================================= */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    {modalMode === "add" ? "Add New User" : "Edit User Profile"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Source: user.store / user.updatedata
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitForm} className="p-6 space-y-4 text-xs">
                {/* Full Name */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="Full legal or employee name"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                  />
                </div>

                {/* User Name & Initials */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      User Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.username}
                      onChange={(e) => {
                        setFormData((p) => ({ ...p, username: e.target.value }));
                        if (usernameError) validateUsername(e.target.value);
                      }}
                      onBlur={(e) => validateUsername(e.target.value)}
                      placeholder="e.g. shivani, akshay"
                      className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border rounded-lg focus:outline-none focus:ring-2 dark:text-white ${
                        usernameError
                          ? "border-rose-300 focus:ring-rose-500/20 focus:border-rose-500"
                          : "border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 focus:border-blue-500"
                      }`}
                    />
                    {usernameError && (
                      <p className="flex items-center gap-1 text-[11px] text-rose-500 mt-1 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{usernameError}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Initials <span className="text-rose-500">*</span>{" "}
                      <span className="text-[11px] text-slate-400 font-normal">
                        (Max 3 letters)
                      </span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={3}
                      value={formData.initials}
                      onChange={(e) => {
                        const clean = e.target.value
                          .replace(/\s+/g, "")
                          .toUpperCase();
                        setFormData((p) => ({ ...p, initials: clean }));
                        if (initialError) validateInitials(clean);
                      }}
                      onBlur={(e) => validateInitials(e.target.value)}
                      placeholder="e.g. SHP, AKS, BGR"
                      className={`w-full px-3 py-2 font-mono uppercase bg-slate-50 dark:bg-slate-950 border rounded-lg focus:outline-none focus:ring-2 dark:text-white ${
                        initialError
                          ? "border-rose-300 focus:ring-rose-500/20 focus:border-rose-500"
                          : "border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 focus:border-blue-500"
                      }`}
                    />
                    {initialError && (
                      <p className="flex items-center gap-1 text-[11px] text-rose-500 mt-1 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{initialError}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, email: e.target.value }))
                    }
                    placeholder="operator@star.in"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                  />
                </div>

                {/* Password: WRITE-ONLY. Replaces the old plaintext password2 security flaw! */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {modalMode === "add" ? "Password" : "New Password"}
                      </span>
                      {modalMode === "add" ? (
                        <span className="text-rose-500">*</span>
                      ) : (
                        <span className="text-slate-400 font-normal">
                          (Leave blank to keep existing password)
                        </span>
                      )}
                    </label>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Write-only / Supabase Auth Hashed
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required={modalMode === "add"}
                      value={formData.password}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, password: e.target.value }))
                      }
                      placeholder={
                        modalMode === "add"
                          ? "Enter secure password for operator"
                          : "••••••••••••"
                      }
                      className="w-full pl-3 pr-10 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* User Type & Assigned Roles Table Role */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-medium text-slate-700 dark:text-slate-300">
                      User Type <span className="text-rose-500">*</span>
                    </label>
                    {/* Role mapping badge using Phase 1 roles table */}
                    {(() => {
                      const assigned = getRoleForUserType(formData.usertype);
                      return (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${assigned.badge_color}`}
                        >
                          <Shield className="w-3 h-3" />
                          <span>
                            Mapped to Roles Table: {assigned.display_name} (id:
                            {assigned.id})
                          </span>
                        </span>
                      );
                    })()}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {USER_TYPES.map((t) => {
                      const isChecked = formData.usertype === t;
                      return (
                        <label
                          key={t}
                          className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition text-xs ${
                            isChecked
                              ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-800 dark:text-blue-300 font-semibold"
                              : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                          }`}
                        >
                          <input
                            type="radio"
                            name="usertype"
                            value={t}
                            checked={isChecked}
                            onChange={() => handleUsertypeChange(t)}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <span>{t}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* User Subtype (Auto-forced to 'Skilled MP' when usertype is Admin/Manager/Supervisor/Designer) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-medium text-slate-700 dark:text-slate-300">
                      User Subtype <span className="text-rose-500">*</span>
                    </label>
                    {isAutoSubtypeLocked && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                        Auto-forced to "Skilled MP" for {formData.usertype}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {USER_SUBTYPES.map((sub) => {
                      const isChecked = formData.usersubtype === sub;
                      const isDisabled = isAutoSubtypeLocked && sub !== "Skilled MP";
                      return (
                        <label
                          key={sub}
                          className={`flex items-center gap-2 p-2.5 rounded-lg border transition text-xs ${
                            isDisabled
                              ? "opacity-30 cursor-not-allowed bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                              : isChecked
                              ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-800 dark:text-blue-300 font-semibold cursor-pointer"
                              : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                          }`}
                        >
                          <input
                            type="radio"
                            name="usersubtype"
                            value={sub}
                            disabled={isDisabled}
                            checked={isChecked}
                            onChange={() =>
                              setFormData((p) => ({ ...p, usersubtype: sub }))
                            }
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <span>{sub}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Status Switch (Active / Inactive) */}
                <div className="flex items-center justify-between pt-2 pb-1 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <label className="font-medium text-slate-700 dark:text-slate-300 block">
                      Account Status
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Inactive accounts cannot authenticate into ERP modules
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((p) => ({
                        ...p,
                        status: p.status === 1 ? 0 : 1,
                      }))
                    }
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                      formData.status === 1
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                        : "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                    }`}
                  >
                    {formData.status === 1 ? (
                      <>
                        <ToggleRight className="w-4 h-4 text-emerald-600" />
                        <span>Active (1)</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-4 h-4 text-slate-400" />
                        <span>Inactive (0)</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm"
                  >
                    {modalMode === "add" ? "Create User" : "Update Profile"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DELETE CONFIRMATION MODAL */}
        {/* ========================================================================= */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 text-xs">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Confirm Soft Deletion
                  </h4>
                  <p className="text-slate-500">
                    Source: UserController.php destroy()
                  </p>
                </div>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                Do you really want to delete user{" "}
                <span className="font-semibold text-slate-900 dark:text-white">
                  "{deleteTarget.name}"
                </span>{" "}
                (@{deleteTarget.username})? This user will be soft deleted and
                marked with a timestamp.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg shadow-sm"
                >
                  Yes, Delete User
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
