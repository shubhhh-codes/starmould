"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Settings,
  Search,
  RotateCcw,
  Check,
  X,
  LayoutDashboard,
  Building2,
  Truck,
  Layers,
  Scan,
  Printer,
  ShoppingCart,
  PackagePlus,
  ArrowUpRight,
  ArrowDownLeft,
  Briefcase,
  Receipt,
  Scale,
  BarChart3,
  FileDown,
  ChevronUp,
  ChevronDown,
  Sliders,
  Move,
  Plus,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Database,
  Clock,
  FileCode,
  Download,
  Lock,
  HardHat,
  Palette,
  Users,
  Cpu,
  BadgeCheck,
  Terminal,
  ChevronsUpDown,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useRolePermissions } from "@/components/providers/permissions-provider";
import {
  ERP_ROLES,
  PERMISSION_DEFINITIONS,
  PermissionDefinition,
  RoleInfo,
} from "@/lib/permissions/types";
import { DEFAULT_ROLE_PERMISSIONS, DEFAULT_ROLE_MENU_ORDERS } from "@/lib/permissions/defaults";
import { MotionButton } from "@/components/ui/motion-button";
import { useUsersQuery } from "@/lib/query/hooks";

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  Building2,
  Truck,
  Layers,
  Scan,
  Printer,
  ShoppingCart,
  PackagePlus,
  ArrowUpRight,
  ArrowDownLeft,
  Briefcase,
  RotateCcw,
  Receipt,
  Scale,
  ShieldCheck,
  BarChart3,
  FileDown,
  Settings,
};

const ROLE_ICONS: Record<number, React.ElementType> = {
  0: Lock,
  1: ShieldCheck,
  2: HardHat,
  3: Palette,
  4: Users,
  5: ShoppingCart,
  6: Cpu,
  7: BadgeCheck,
  9: Truck,
  10: Terminal,
};

const ROLE_ACCENT_STYLES: Record<number, { bg: string; text: string; border: string; badge: string; glow: string }> = {
  0: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", badge: "bg-purple-100 text-purple-700 border-purple-200", glow: "hover:border-purple-300" },
  1: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", badge: "bg-blue-100 text-blue-700 border-blue-200", glow: "hover:border-blue-300" },
  2: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200", badge: "bg-amber-100 text-amber-800 border-amber-200", glow: "hover:border-amber-300" },
  3: { bg: "bg-cyan-50", text: "text-cyan-800", border: "border-cyan-200", badge: "bg-cyan-100 text-cyan-800 border-cyan-200", glow: "hover:border-cyan-300" },
  4: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", badge: "bg-slate-100 text-slate-700 border-slate-200", glow: "hover:border-slate-300" },
  5: { bg: "bg-sky-50", text: "text-sky-800", border: "border-sky-200", badge: "bg-sky-100 text-sky-800 border-sky-200", glow: "hover:border-sky-300" },
  6: { bg: "bg-violet-50", text: "text-violet-800", border: "border-violet-200", badge: "bg-violet-100 text-violet-800 border-violet-200", glow: "hover:border-violet-300" },
  7: { bg: "bg-teal-50", text: "text-teal-800", border: "border-teal-200", badge: "bg-teal-100 text-teal-800 border-teal-200", glow: "hover:border-teal-300" },
  9: { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-800 border-emerald-200", glow: "hover:border-emerald-300" },
  10: { bg: "bg-indigo-50", text: "text-indigo-800", border: "border-indigo-200", badge: "bg-indigo-100 text-indigo-800 border-indigo-200", glow: "hover:border-indigo-300" },
};

// All available Navigation Menu Definitions (Role & Permissions is strictly Admin only and never configurable for other roles)
const ALL_NAV_PERMISSIONS = PERMISSION_DEFINITIONS.filter(
  (p) => p.category === "navigation" && p.key !== "nav_settings"
);

interface DragState {
  itemKey: string;
  sourceColumn: "active" | "inactive";
  sourceIndex: number;
}

export default function SettingsPage() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role_id === 0;
  const {
    matrix,
    menuOrders,
    isSaving,
    updateRoleConfig,
    resetRolePermissions,
  } = useRolePermissions();

  const usersQuery = useUsersQuery();
  const staffUsers: any[] = Array.isArray(usersQuery.data)
    ? usersQuery.data
    : (usersQuery.data as any)?.users || [];

  const [selectedRoleId, setSelectedRoleId] = useState<number>(1); // Default to Manager
  const [activeTab, setActiveTab] = useState<"menu_builder" | "actions" | "financials" | "backup">("menu_builder");
  const [mobileMenuColumn, setMobileMenuColumn] = useState<"active" | "hidden">("active");

  // Dropdown state
  const [isRoleComboboxOpen, setIsRoleComboboxOpen] = useState(false);
  const [roleSearchFilter, setRoleSearchFilter] = useState("");
  const comboboxRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [menuSearchQuery, setMenuSearchQuery] = useState<string>("");
  const [isDownloadingSql, setIsDownloadingSql] = useState(false);
  const [isDownloadingJson, setIsDownloadingJson] = useState(false);
  const [backupStatus, setBackupStatus] = useState<any>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setIsRoleComboboxOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsRoleComboboxOpen(false);
      }
    }
    if (isRoleComboboxOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isRoleComboboxOpen]);

  const fetchBackupStatus = useCallback(async () => {
    try {
      setIsLoadingStatus(true);
      const res = await fetch("/api/backup?action=status");
      if (res.ok) {
        const data = await res.json();
        setBackupStatus(data);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "backup") {
      fetchBackupStatus();
    }
  }, [activeTab, fetchBackupStatus]);

  const handleDownloadBackup = async (format: "sql" | "json") => {
    if (format === "sql") setIsDownloadingSql(true);
    else setIsDownloadingJson(true);

    try {
      const response = await fetch(`/api/backup?format=${format}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to generate backup");
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition");
      const istDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
      let filename = `starmould_backup_${istDateStr}_IST.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setNotification({
        type: "success",
        message: `Backup ${filename} downloaded successfully!`,
      });
      fetchBackupStatus();
    } catch (err: any) {
      setNotification({
        type: "error",
        message: err.message || "Backup download failed",
      });
    } finally {
      if (format === "sql") setIsDownloadingSql(false);
      else setIsDownloadingJson(false);
    }
  };

  // Local state for permissions and active menu order
  const [localPermissions, setLocalPermissions] = useState<Record<string, boolean>>({});
  const [localMenuOrder, setLocalMenuOrder] = useState<string[]>([]);

  // Drag and Drop state
  const [draggedItem, setDraggedItem] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<{ column: "active" | "inactive"; index?: number } | null>(null);

  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const activeRole: RoleInfo = useMemo(() => {
    return ERP_ROLES.find((r) => r.id === selectedRoleId) || ERP_ROLES[1];
  }, [selectedRoleId]);

  const isRoleAdmin = selectedRoleId === 0;

  // Initialize and sync local state when role or remote data changes
  useEffect(() => {
    if (matrix[selectedRoleId]) {
      setLocalPermissions({ ...matrix[selectedRoleId] });
    }
    const order = menuOrders[selectedRoleId] || DEFAULT_ROLE_MENU_ORDERS[selectedRoleId] || [];
    setLocalMenuOrder([...order]);
  }, [selectedRoleId, matrix, menuOrders]);

  // Calculate user counts per role
  const userCountPerRole = useMemo(() => {
    const counts: Record<number, number> = {};
    staffUsers.forEach((u: any) => {
      const rId = Number(u.role_id);
      counts[rId] = (counts[rId] || 0) + 1;
    });
    return counts;
  }, [staffUsers]);

  // Filtered roles for the dropdown search
  const filteredRoles = useMemo(() => {
    if (!roleSearchFilter.trim()) return ERP_ROLES;
    const q = roleSearchFilter.toLowerCase();
    return ERP_ROLES.filter(
      (r) =>
        r.display_name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        String(r.id).includes(q)
    );
  }, [roleSearchFilter]);

  // Split navigation items into Active and Inactive lists
  const { activeNavItems, inactiveNavItems } = useMemo(() => {
    const activeKeys = new Set(
      localMenuOrder.filter((key) => localPermissions[key] !== false)
    );

    // Active items in the custom configured order
    const activeList: PermissionDefinition[] = [];
    localMenuOrder.forEach((key) => {
      const def = ALL_NAV_PERMISSIONS.find((p) => p.key === key);
      if (def && localPermissions[key] !== false) {
        activeList.push(def);
      }
    });

    // Inactive items: all navigation items that are disabled or not in active order
    const inactiveList: PermissionDefinition[] = ALL_NAV_PERMISSIONS.filter(
      (p) => !activeKeys.has(p.key)
    );

    return { activeNavItems: activeList, inactiveNavItems: inactiveList };
  }, [localMenuOrder, localPermissions]);

  // Filtered lists based on menu search query
  const filteredActiveNavItems = useMemo(() => {
    if (!menuSearchQuery.trim()) return activeNavItems;
    const q = menuSearchQuery.toLowerCase();
    return activeNavItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.key.toLowerCase().includes(q) ||
        (item.route && item.route.toLowerCase().includes(q)) ||
        item.description.toLowerCase().includes(q)
    );
  }, [activeNavItems, menuSearchQuery]);

  const filteredInactiveNavItems = useMemo(() => {
    if (!menuSearchQuery.trim()) return inactiveNavItems;
    const q = menuSearchQuery.toLowerCase();
    return inactiveNavItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.key.toLowerCase().includes(q) ||
        (item.route && item.route.toLowerCase().includes(q)) ||
        item.description.toLowerCase().includes(q)
    );
  }, [inactiveNavItems, menuSearchQuery]);

  // Check if there are unsaved modifications
  const hasUnsavedChanges = useMemo(() => {
    if (isRoleAdmin) return false;
    const remotePerms = matrix[selectedRoleId];
    const remoteOrder = menuOrders[selectedRoleId] || DEFAULT_ROLE_MENU_ORDERS[selectedRoleId] || [];

    if (!remotePerms) return false;

    // Check permissions difference
    const hasPermDiff = Object.keys(localPermissions).some(
      (key) => localPermissions[key] !== remotePerms[key]
    );
    if (hasPermDiff) return true;

    // Check menu order difference
    if (localMenuOrder.length !== remoteOrder.length) return true;
    for (let i = 0; i < localMenuOrder.length; i++) {
      if (localMenuOrder[i] !== remoteOrder[i]) return true;
    }

    return false;
  }, [localPermissions, localMenuOrder, matrix, menuOrders, selectedRoleId, isRoleAdmin]);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  }, []);

  // Drag and Drop Event Handlers
  const handleDragStart = (e: React.DragEvent, itemKey: string, sourceColumn: "active" | "inactive", sourceIndex: number) => {
    if (isRoleAdmin) return;
    setDraggedItem({ itemKey, sourceColumn, sourceIndex });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", itemKey);
  };

  const handleDragOverColumn = (e: React.DragEvent, column: "active" | "inactive") => {
    if (isRoleAdmin || !draggedItem) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropTarget?.column !== column || dropTarget?.index !== undefined) {
      setDropTarget({ column });
    }
  };

  const handleDragOverItem = (e: React.DragEvent, column: "active" | "inactive", index: number) => {
    if (isRoleAdmin || !draggedItem) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDropTarget({ column, index });
  };

  const handleDrop = (targetColumn: "active" | "inactive", targetIndex?: number) => {
    if (isRoleAdmin || !draggedItem) {
      setDraggedItem(null);
      setDropTarget(null);
      return;
    }

    const { itemKey, sourceColumn, sourceIndex } = draggedItem;

    if (sourceColumn === "inactive" && targetColumn === "active") {
      setLocalPermissions((prev) => ({ ...prev, [itemKey]: true }));
      setLocalMenuOrder((prev) => {
        const next = prev.filter((k) => k !== itemKey);
        if (targetIndex !== undefined) {
          next.splice(targetIndex, 0, itemKey);
        } else {
          next.push(itemKey);
        }
        return next;
      });
    } else if (sourceColumn === "active" && targetColumn === "inactive") {
      setLocalPermissions((prev) => ({ ...prev, [itemKey]: false }));
      setLocalMenuOrder((prev) => prev.filter((k) => k !== itemKey));
    } else if (sourceColumn === "active" && targetColumn === "active" && targetIndex !== undefined) {
      if (sourceIndex !== targetIndex) {
        setLocalMenuOrder((prev) => {
          const next = [...prev];
          const [moved] = next.splice(sourceIndex, 1);
          if (moved) {
            next.splice(targetIndex, 0, moved);
          }
          return next;
        });
      }
    }

    setDraggedItem(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDropTarget(null);
  };

  // Quick Action Buttons
  const handleMoveToActive = (itemKey: string) => {
    if (isRoleAdmin) return;
    setLocalPermissions((prev) => ({ ...prev, [itemKey]: true }));
    setLocalMenuOrder((prev) => {
      if (prev.includes(itemKey)) return prev;
      return [...prev, itemKey];
    });
  };

  const handleMoveToInactive = (itemKey: string) => {
    if (isRoleAdmin) return;
    setLocalPermissions((prev) => ({ ...prev, [itemKey]: false }));
    setLocalMenuOrder((prev) => prev.filter((k) => k !== itemKey));
  };

  const handleMoveOrder = (index: number, direction: "up" | "down") => {
    if (isRoleAdmin) return;
    setLocalMenuOrder((prev) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  // Bulk Actions
  const handleActivateAll = () => {
    if (isRoleAdmin) return;
    const allActive = ALL_NAV_PERMISSIONS.map((p) => p.key);
    setLocalPermissions((prev) => {
      const next = { ...prev };
      allActive.forEach((k) => (next[k] = true));
      return next;
    });
    setLocalMenuOrder((prev) => {
      const existing = new Set(prev);
      const toAdd = allActive.filter((k) => !existing.has(k));
      return [...prev, ...toAdd];
    });
  };

  const handleDeactivateAll = () => {
    if (isRoleAdmin) return;
    setLocalPermissions((prev) => {
      const next = { ...prev };
      ALL_NAV_PERMISSIONS.forEach((p) => {
        if (p.key !== "nav_dashboard") next[p.key] = false;
      });
      next["nav_dashboard"] = true;
      return next;
    });
    setLocalMenuOrder(["nav_dashboard"]);
  };

  // Toggle for Action and Financial permissions
  const handleTogglePermission = (key: string) => {
    if (isRoleAdmin) return;
    setLocalPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleGrantAll = () => {
    if (isRoleAdmin) return;
    const allGranted: Record<string, boolean> = {};
    const allMenuKeys: string[] = [];
    PERMISSION_DEFINITIONS.forEach((p) => {
      if (p.key === "nav_settings") {
        allGranted[p.key] = false;
        return;
      }
      allGranted[p.key] = true;
      if (p.category === "navigation") {
        allMenuKeys.push(p.key);
      }
    });
    setLocalPermissions(allGranted);
    setLocalMenuOrder(allMenuKeys);
  };

  const handleRevokeAll = () => {
    if (isRoleAdmin) return;
    const allRevoked: Record<string, boolean> = {};
    PERMISSION_DEFINITIONS.forEach((p) => {
      allRevoked[p.key] = false;
    });
    allRevoked["nav_dashboard"] = true;
    setLocalPermissions(allRevoked);
    setLocalMenuOrder(["nav_dashboard"]);
  };

  const handleResetToDefaults = () => {
    if (isRoleAdmin) return;
    if (DEFAULT_ROLE_PERMISSIONS[selectedRoleId]) {
      setLocalPermissions({ ...DEFAULT_ROLE_PERMISSIONS[selectedRoleId] });
    }
    if (DEFAULT_ROLE_MENU_ORDERS[selectedRoleId]) {
      setLocalMenuOrder([...DEFAULT_ROLE_MENU_ORDERS[selectedRoleId]]);
    }
  };

  const handleDiscardChanges = () => {
    if (matrix[selectedRoleId]) {
      setLocalPermissions({ ...matrix[selectedRoleId] });
    }
    const order = menuOrders[selectedRoleId] || DEFAULT_ROLE_MENU_ORDERS[selectedRoleId] || [];
    setLocalMenuOrder([...order]);
  };

  const handleSaveChanges = async () => {
    if (isRoleAdmin) return;
    const res = await updateRoleConfig(selectedRoleId, localPermissions, localMenuOrder);
    if (res.success) {
      showToast("success", `Menu structure & permissions for ${activeRole.display_name} saved successfully.`);
    } else {
      showToast("error", `Failed to save changes for ${activeRole.display_name}: ${res.error || "Unknown error"}`);
    }
  };

  // Keyboard shortcut Ctrl+S or Cmd+S to save instantly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (hasUnsavedChanges && !isSaving && !isRoleAdmin) {
          handleSaveChanges();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasUnsavedChanges, isSaving, isRoleAdmin, handleSaveChanges]);

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
          <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-200">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Access Restricted</h2>
          <p className="text-xs text-slate-500 max-w-sm">
            Only System Administrators have authorization to modify Role Permissions and Navigation Menus.
          </p>
        </div>
      </AppLayout>
    );
  }

  const ActiveRoleIcon = ROLE_ICONS[selectedRoleId] || Shield;
  const activeRoleStyle = ROLE_ACCENT_STYLES[selectedRoleId] || ROLE_ACCENT_STYLES[1];

  return (
    <AppLayout>
      <div className="space-y-4 w-full pb-28">
        {/* Toast Notification */}
        {notification && (
          <div
            className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg transition-all animate-in fade-in slide-in-from-top-2 text-xs font-medium ${
              notification.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TOP COMMAND DECK: CLEAN LIGHT ROLE SELECTOR & ACTIONS */}
        {/* ========================================================================= */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            {/* Left: Role Trigger Combobox */}
            <div className="relative" ref={comboboxRef}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                <span>Target Role</span>
                <span className="text-slate-300">•</span>
                <span className="text-[11px] text-blue-600 font-semibold font-mono">
                  {userCountPerRole[selectedRoleId] || 0} active staff
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsRoleComboboxOpen((prev) => !prev);
                  setRoleSearchFilter("");
                }}
                className={`group flex items-center justify-between gap-3 px-3 py-2 rounded-xl border transition-all duration-150 cursor-pointer shadow-2xs min-w-[240px] sm:min-w-[280px] ${
                  isRoleComboboxOpen
                    ? "bg-blue-50/60 border-blue-500 text-slate-900 ring-2 ring-blue-500/20"
                    : "bg-slate-50 hover:bg-slate-100/80 border-slate-200 hover:border-slate-300 text-slate-800"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 border ${activeRoleStyle.badge}`}
                  >
                    <ActiveRoleIcon className="w-3.5 h-3.5" />
                  </div>

                  <span className="font-bold text-xs text-slate-900 truncate">
                    {activeRole.display_name}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${activeRoleStyle.badge}`}>
                    {isRoleAdmin ? "Admin" : `${userCountPerRole[selectedRoleId] || 0} staff`}
                  </span>

                  <ChevronsUpDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${isRoleComboboxOpen ? "rotate-180 text-blue-600" : "group-hover:text-slate-600"}`} />
                </div>
              </button>

              {/* DROPDOWN MENU - Sleek Shadcn-style dropdown anchored right under the button */}
              {isRoleComboboxOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-80 sm:w-96 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 animate-in fade-in-50 zoom-in-95 duration-150">
                  {/* Search inside dropdown */}
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={roleSearchFilter}
                      onChange={(e) => setRoleSearchFilter(e.target.value)}
                      placeholder="Search roles..."
                      className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    {roleSearchFilter && (
                      <button
                        type="button"
                        onClick={() => setRoleSearchFilter("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Scrollable Role List */}
                  <div className="max-h-72 overflow-y-auto space-y-1 pr-0.5">
                    {filteredRoles.length === 0 ? (
                      <div className="py-6 text-center text-slate-400 text-xs">
                        No matching roles found
                      </div>
                    ) : (
                      filteredRoles.map((role) => {
                        const isSelected = selectedRoleId === role.id;
                        const RoleIconComp = ROLE_ICONS[role.id] || Shield;
                        const roleStyle = ROLE_ACCENT_STYLES[role.id] || ROLE_ACCENT_STYLES[1];
                        const staffCount = userCountPerRole[role.id] || 0;

                        return (
                          <button
                            key={role.id}
                            type="button"
                            onClick={() => {
                              setSelectedRoleId(role.id);
                              setIsRoleComboboxOpen(false);
                            }}
                            className={`w-full flex items-center justify-between gap-2.5 p-2 rounded-xl border transition-all duration-100 text-left group cursor-pointer ${
                              isSelected
                                ? "bg-blue-50/80 border-blue-200 text-blue-950 font-semibold shadow-2xs"
                                : "border-transparent hover:bg-slate-50 hover:border-slate-200 text-slate-700"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 border ${roleStyle.badge} transition-transform group-hover:scale-105`}
                              >
                                <RoleIconComp className="w-3.5 h-3.5" />
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-xs truncate text-slate-800">
                                    {role.display_name}
                                  </span>
                                  {role.id === 0 && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-purple-100 text-purple-700 border border-purple-200 font-mono">
                                      Admin
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-500 truncate">
                                  {role.description}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-medium bg-slate-100 text-slate-600">
                                {staffCount} staff
                              </span>
                              {isSelected && (
                                <Check className="w-4 h-4 text-blue-600 shrink-0" />
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Center: Active Role Summary Info */}
            <div className="hidden xl:flex items-center gap-2.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 max-w-xl truncate">
              <span className="font-bold text-slate-900 shrink-0">{activeRole.display_name}</span>
              <span className="text-slate-300">•</span>
              <span className="text-[11px] text-slate-500 truncate">{activeRole.description}</span>
              <span className="text-slate-300">•</span>
              <span className="text-[11px] font-mono text-blue-600 font-semibold shrink-0">
                {activeNavItems.length} active menus
              </span>
            </div>

            {/* Right: Quick Action Presets */}
            {!isRoleAdmin && (
              <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={handleGrantAll}
                  className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition cursor-pointer"
                  title="Enable all menus for this role"
                >
                  Enable All
                </button>
                <button
                  type="button"
                  onClick={handleRevokeAll}
                  className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer"
                  title="Disable all menus except Dashboard"
                >
                  Disable All
                </button>
                <button
                  type="button"
                  onClick={handleResetToDefaults}
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition cursor-pointer flex items-center gap-1"
                  title="Reset to default preset"
                >
                  <RotateCcw className="w-3 h-3 text-slate-500" />
                  <span>Reset</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW TABS BAR & INLINE MENU SEARCH */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-2">
          {/* Main Category Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("menu_builder")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer shrink-0 ${
                activeTab === "menu_builder"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Menu Hierarchy</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 font-mono">
                {activeNavItems.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("actions")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer shrink-0 ${
                activeTab === "actions"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Actions</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("financials")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer shrink-0 ${
                activeTab === "financials"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Financial Rules</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("backup")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer shrink-0 ${
                activeTab === "backup"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <Database className="w-3.5 h-3.5 text-blue-500" />
              <span>Backup</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-600 font-mono">
                Auto
              </span>
            </button>
          </div>

          {/* Quick Menu Filter Search */}
          {activeTab === "menu_builder" && (
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={menuSearchQuery}
                onChange={(e) => setMenuSearchQuery(e.target.value)}
                placeholder="Search menus (e.g. PO, Scanning)..."
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder-slate-400"
              />
              {menuSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMenuSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Admin Safety Notice */}
        {isRoleAdmin && (
          <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-2.5 text-xs text-purple-900">
            <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
            <div>
              <strong className="font-bold">Administrator Role is Universally Unlocked: </strong>
              <span className="text-purple-800/90 text-[11px]">
                Full universal access across all modules is preserved to prevent lockout.
              </span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: MENU REORDERING & HIERARCHY (Desktop Two-Column & Mobile Tabs) */}
        {/* ========================================================================= */}
        {activeTab === "menu_builder" && (
          <div className="space-y-3">
            {/* Mobile View Toggle Switcher (Visible only on < lg screens to keep mobile view compact!) */}
            <div className="flex lg:hidden items-center justify-center p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setMobileMenuColumn("active")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                  mobileMenuColumn === "active"
                    ? "bg-white text-blue-700 shadow-xs border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Active Menus</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 font-mono">
                  {activeNavItems.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMobileMenuColumn("hidden")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                  mobileMenuColumn === "hidden"
                    ? "bg-white text-rose-700 shadow-xs border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Hidden Menus</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-mono">
                  {inactiveNavItems.length}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* ===================================================================== */}
              {/* LEFT COLUMN: HIDDEN MENUS (On mobile, displayed when mobileMenuColumn === "hidden") */}
              {/* ===================================================================== */}
              <div
                className={`lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-xs text-slate-700 min-h-[440px] flex flex-col transition-all duration-150 ${
                  mobileMenuColumn === "hidden" ? "block" : "hidden lg:flex"
                } ${
                  dropTarget?.column === "inactive"
                    ? "ring-2 ring-rose-400 bg-rose-50/40 border-rose-300"
                    : ""
                }`}
                onDragOver={(e) => handleDragOverColumn(e, "inactive")}
                onDrop={() => handleDrop("inactive")}
              >
                {/* Header */}
                <div className="pb-2.5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-xs font-bold text-slate-800 tracking-wide flex items-center gap-2">
                      <span>Hidden from Sidebar</span>
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200">
                        {inactiveNavItems.length}
                      </span>
                    </h2>
                  </div>

                  {!isRoleAdmin && inactiveNavItems.length > 0 && (
                    <button
                      type="button"
                      onClick={handleActivateAll}
                      className="px-2 py-0.5 text-[11px] font-bold text-blue-700 hover:text-white bg-blue-50 hover:bg-blue-600 border border-blue-200 rounded-md transition cursor-pointer"
                      title="Activate all hidden menus"
                    >
                      + Add All
                    </button>
                  )}
                </div>

                {/* Items List */}
                <div className="flex-1 py-2.5 space-y-1.5 overflow-y-auto">
                  {filteredInactiveNavItems.length === 0 ? (
                    <div className="h-36 border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-xl flex flex-col items-center justify-center p-3 text-center text-slate-400 space-y-1">
                      <Eye className="w-5 h-5 text-slate-400" />
                      <p className="text-xs font-medium text-slate-600">
                        {menuSearchQuery ? "No matching hidden menus found" : "All available menus are active"}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {menuSearchQuery
                          ? "Try another keyword"
                          : `Drag any menu here to hide it for ${activeRole.display_name}.`}
                      </p>
                    </div>
                  ) : (
                    filteredInactiveNavItems.map((item, idx) => {
                      const IconComp = item.iconName ? ICON_MAP[item.iconName] || Layers : Layers;
                      const isDraggingThis = draggedItem?.itemKey === item.key;

                      return (
                        <div
                          key={item.key}
                          draggable={!isRoleAdmin}
                          onDragStart={(e) => handleDragStart(e, item.key, "inactive", idx)}
                          onDragEnd={handleDragEnd}
                          className={`group bg-slate-50/80 hover:bg-slate-100 border border-slate-200/80 hover:border-slate-300 rounded-xl p-2 sm:p-2.5 flex items-center justify-between gap-2 transition-all duration-150 ${
                            isDraggingThis ? "opacity-30 scale-95 border-dashed" : "shadow-2xs"
                          } ${isRoleAdmin ? "cursor-not-allowed opacity-60" : "cursor-grab active:cursor-grabbing"}`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div
                              className="w-6 h-6 rounded-md bg-white border border-slate-200 text-slate-400 group-hover:text-slate-600 flex items-center justify-center shrink-0 transition-colors"
                              title="Drag to Active column"
                            >
                              <Move className="w-3 h-3" />
                            </div>

                            <div className="p-1 rounded-md bg-slate-200/70 border border-slate-300/40 text-slate-600 shrink-0">
                              <IconComp className="w-3.5 h-3.5" />
                            </div>

                            <div className="overflow-hidden">
                              <h4 className="font-semibold text-xs text-slate-800 truncate group-hover:text-slate-900">
                                {item.label}
                              </h4>
                              <p className="text-[10px] text-slate-400 truncate font-mono">
                                {item.route || item.key}
                              </p>
                            </div>
                          </div>

                          {!isRoleAdmin && (
                            <button
                              type="button"
                              onClick={() => handleMoveToActive(item.key)}
                              className="px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:text-white bg-white hover:bg-blue-600 border border-slate-200 hover:border-blue-600 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
                              title="Show in sidebar"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add</span>
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Hidden from sidebar</span>
                  <span className="text-slate-500 font-medium">Drag to Active →</span>
                </div>
              </div>

              {/* ===================================================================== */}
              {/* RIGHT COLUMN: ACTIVE SIDEBAR HIERARCHY (On mobile, displayed when mobileMenuColumn === "active") */}
              {/* ===================================================================== */}
              <div
                className={`lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-xs text-slate-700 min-h-[440px] flex flex-col transition-all duration-150 ${
                  mobileMenuColumn === "active" ? "block" : "hidden lg:flex"
                } ${
                  dropTarget?.column === "active" && dropTarget.index === undefined
                    ? "ring-2 ring-blue-500 bg-blue-50/40 border-blue-400"
                    : ""
                }`}
                onDragOver={(e) => handleDragOverColumn(e, "active")}
                onDrop={() => handleDrop("active")}
              >
                {/* Header */}
                <div className="pb-2.5 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-xs font-bold text-slate-800 tracking-wide flex items-center gap-2">
                      <span>Active Sidebar Order</span>
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {activeNavItems.length} Visible
                      </span>
                    </h2>
                  </div>

                  {!isRoleAdmin && activeNavItems.length > 1 && (
                    <button
                      type="button"
                      onClick={handleDeactivateAll}
                      className="px-2 py-0.5 text-[11px] font-bold text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 rounded-md transition cursor-pointer"
                      title="Hide all menus except Dashboard"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Items List */}
                <div className="flex-1 py-2.5 space-y-1.5 overflow-y-auto">
                  {filteredActiveNavItems.length === 0 ? (
                    <div className="h-36 border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-xl flex flex-col items-center justify-center p-3 text-center text-slate-400 space-y-1">
                      <EyeOff className="w-5 h-5 text-slate-400" />
                      <p className="text-xs font-medium text-slate-600">
                        {menuSearchQuery ? "No matching active menus found" : "No active menus configured"}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Drag menus from Hidden Menus to display them in {activeRole.display_name}&apos;s sidebar.
                      </p>
                    </div>
                  ) : (
                    filteredActiveNavItems.map((item, idx) => {
                      const IconComp = item.iconName ? ICON_MAP[item.iconName] || Layers : Layers;
                      const isDraggingThis = draggedItem?.itemKey === item.key;
                      const isTargetPosition = dropTarget?.column === "active" && dropTarget?.index === idx;

                      return (
                        <div
                          key={item.key}
                          draggable={!isRoleAdmin}
                          onDragStart={(e) => handleDragStart(e, item.key, "active", idx)}
                          onDragOver={(e) => handleDragOverItem(e, "active", idx)}
                          onDrop={(e) => {
                            e.stopPropagation();
                            handleDrop("active", idx);
                          }}
                          onDragEnd={handleDragEnd}
                          className={`group bg-white border rounded-xl p-2 sm:p-2.5 flex items-center justify-between gap-2 transition-all duration-150 ${
                            isTargetPosition
                              ? "border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/60"
                              : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/20"
                          } ${isDraggingThis ? "opacity-30 scale-95 border-dashed" : "shadow-2xs"} ${
                            isRoleAdmin ? "cursor-not-allowed opacity-90" : "cursor-grab active:cursor-grabbing"
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div
                              className="w-6 h-6 rounded-md bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform"
                              title="Drag up/down to reorder"
                            >
                              <Move className="w-3 h-3" />
                            </div>

                            <div className="p-1 rounded-md bg-blue-50 border border-blue-100 text-blue-600 shrink-0">
                              <IconComp className="w-3.5 h-3.5" />
                            </div>

                            <div className="overflow-hidden">
                              <div className="flex items-center gap-1.5">
                                <h4 className="font-semibold text-xs text-slate-800 truncate">
                                  {item.label}
                                </h4>
                                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                                  #{idx + 1}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 truncate">
                                {item.description}
                              </p>
                            </div>
                          </div>

                          {/* Reorder and Remove Controls */}
                          {!isRoleAdmin && (
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveOrder(idx, "up")}
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-md transition disabled:opacity-20 cursor-pointer"
                                title="Move Up"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>

                              <button
                                type="button"
                                disabled={idx === activeNavItems.length - 1}
                                onClick={() => handleMoveOrder(idx, "down")}
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-md transition disabled:opacity-20 cursor-pointer"
                                title="Move Down"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleMoveToInactive(item.key)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-md transition ml-1 cursor-pointer"
                                title="Hide from sidebar"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Appears directly in sidebar</span>
                  <span className="text-blue-600 font-medium">#1 is top of sidebar</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ACTION & CREATION CAPABILITIES */}
        {/* ========================================================================= */}
        {activeTab === "actions" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Action Capabilities for {activeRole.display_name}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Enable or restrict operational actions such as creating customers, suppliers, POs, or approving QC sign-offs.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {PERMISSION_DEFINITIONS.filter((p) => p.category === "actions").map((p) => {
                const isGranted = isRoleAdmin ? true : localPermissions[p.key] ?? false;

                return (
                  <div
                    key={p.key}
                    onClick={() => handleTogglePermission(p.key)}
                    className={`py-3 px-2 flex items-center justify-between gap-3 transition-colors rounded-xl ${
                      isRoleAdmin
                        ? "cursor-default"
                        : isGranted
                        ? "hover:bg-blue-50/40 cursor-pointer"
                        : "hover:bg-slate-50 cursor-pointer opacity-75"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`p-1.5 rounded-lg mt-0.5 shrink-0 transition-colors ${
                          isGranted
                            ? "bg-blue-50 text-blue-600 border border-blue-200/60"
                            : "bg-slate-100 text-slate-400 border border-slate-200"
                        }`}
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h4
                          className={`text-xs font-semibold ${
                            isGranted ? "text-slate-900" : "text-slate-600"
                          }`}
                        >
                          {p.label}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          {p.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isRoleAdmin}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePermission(p.key);
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-80 disabled:cursor-not-allowed ${
                        isGranted ? "bg-blue-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          isGranted ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: FINANCIAL & DATA VISIBILITY */}
        {/* ========================================================================= */}
        {activeTab === "financials" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Financial & Data Visibility Rules for {activeRole.display_name}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Control commercial visibility (₹ values), CSV export privileges, and soft-delete capabilities.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {PERMISSION_DEFINITIONS.filter((p) => p.category === "financials").map((p) => {
                const isGranted = isRoleAdmin ? true : localPermissions[p.key] ?? false;

                return (
                  <div
                    key={p.key}
                    onClick={() => handleTogglePermission(p.key)}
                    className={`py-3 px-2 flex items-center justify-between gap-3 transition-colors rounded-xl ${
                      isRoleAdmin
                        ? "cursor-default"
                        : isGranted
                        ? "hover:bg-blue-50/40 cursor-pointer"
                        : "hover:bg-slate-50 cursor-pointer opacity-75"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`p-1.5 rounded-lg mt-0.5 shrink-0 transition-colors ${
                          isGranted
                            ? "bg-amber-50 text-amber-600 border border-amber-200/60"
                            : "bg-slate-100 text-slate-400 border border-slate-200"
                        }`}
                      >
                        <Receipt className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h4
                          className={`text-xs font-semibold ${
                            isGranted ? "text-slate-900" : "text-slate-600"
                          }`}
                        >
                          {p.label}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          {p.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isRoleAdmin}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePermission(p.key);
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-80 disabled:cursor-not-allowed ${
                        isGranted ? "bg-blue-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          isGranted ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: DATABASE & AUTO-BACKUP MANAGEMENT */}
        {/* ========================================================================= */}
        {activeTab === "backup" && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Header Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 text-slate-800 relative overflow-hidden shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-2xs shrink-0">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 tracking-wide">
                        Supabase Database & Auto-Backup
                      </h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                        Active
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Automated 4-hour disaster recovery backups plus instant SQL & JSON downloads.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={fetchBackupStatus}
                  disabled={isLoadingStatus}
                  className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shrink-0 border border-slate-200"
                >
                  <Clock className={`w-3.5 h-3.5 ${isLoadingStatus ? "animate-spin" : ""}`} />
                  <span>Refresh Status</span>
                </button>
              </div>
            </div>

            {/* Instant Download Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option A: SQL Dump */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
                        <FileCode className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Supabase SQL Dump (.sql)
                      </h4>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                      Recommended
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Complete SQL dump of all active tables with idempotent <code className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded font-mono text-[11px]">ON CONFLICT DO UPDATE</code> logic.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400 font-mono">Format: .sql</span>
                  <MotionButton
                    type="button"
                    onClick={() => handleDownloadBackup("sql")}
                    loading={isDownloadingSql}
                    variant="primary"
                    size="sm"
                    className="shadow-sm cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Download SQL
                  </MotionButton>
                </div>
              </div>

              {/* Option B: JSON Snapshot */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                        <Database className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Structured JSON Snapshot (.json)
                      </h4>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-slate-100 text-slate-600 border border-slate-200">
                      Raw Data
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    All ERP table records serialized into structured JSON objects with row counts and metadata.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400 font-mono">Format: .json</span>
                  <MotionButton
                    type="button"
                    onClick={() => handleDownloadBackup("json")}
                    loading={isDownloadingJson}
                    variant="outline"
                    size="sm"
                    className="shadow-sm cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Download JSON
                  </MotionButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FLOATING "UNSAVED CHANGES" SAVE BAR (Mobile & Desktop Responsive) */}
        {/* ========================================================================= */}
        {hasUnsavedChanges && (
          <div className="fixed bottom-4 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:max-w-xl z-50 bg-slate-950 text-white border border-slate-700/80 rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-150">
            <div className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping shrink-0" />
              <span>
                Unsaved modifications for{" "}
                <strong className="text-blue-400 font-semibold">{activeRole.display_name}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleDiscardChanges}
                disabled={isSaving}
                className="px-3 py-1 text-xs text-slate-400 hover:text-white transition font-medium cursor-pointer"
              >
                Reset
              </button>
              <MotionButton
                type="button"
                onClick={handleSaveChanges}
                loading={isSaving}
                variant="primary"
                size="sm"
                className="shadow-lg shadow-blue-600/40 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                Save Changes
              </MotionButton>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
