"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
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
  Lock,
  Sparkles,
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
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Sliders,
  Move,
  GripVertical,
  Plus,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useRolePermissions } from "@/components/providers/permissions-provider";
import {
  ERP_ROLES,
  PERMISSION_DEFINITIONS,
  PermissionDefinition,
  PermissionCategory,
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
  const [activeTab, setActiveTab] = useState<"menu_builder" | "actions" | "financials">("menu_builder");
  
  // Local state for permissions and active menu order
  const [localPermissions, setLocalPermissions] = useState<Record<string, boolean>>({});
  const [localMenuOrder, setLocalMenuOrder] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  
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
    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    staffUsers.forEach((u: any) => {
      const rId = Number(u.role_id);
      if (counts[rId] !== undefined) {
        counts[rId]++;
      }
    });
    return counts;
  }, [staffUsers]);

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

    // Case 1: Moving from Inactive to Active
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
    }
    // Case 2: Moving from Active to Inactive
    else if (sourceColumn === "active" && targetColumn === "inactive") {
      setLocalPermissions((prev) => ({ ...prev, [itemKey]: false }));
      setLocalMenuOrder((prev) => prev.filter((k) => k !== itemKey));
    }
    // Case 3: Reordering within Active column
    else if (sourceColumn === "active" && targetColumn === "active" && targetIndex !== undefined) {
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
      // nav_settings is strictly Admin only
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
    // Keep Dashboard active
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

  const handleFactoryResetRole = async () => {
    const res = await resetRolePermissions(selectedRoleId);
    if (res.success) {
      showToast("success", `${activeRole.display_name} reset to factory defaults.`);
    } else {
      showToast("error", `Failed to reset ${activeRole.display_name}: ${res.error || "Unknown error"}`);
    }
  };

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

  return (
    <AppLayout>
      <div className="space-y-6 w-full pb-28">
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

        {/* Page Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
              <Settings className="h-3.5 w-3.5 text-blue-600" />
              <span>Admin System</span>
              <span>/</span>
              <span className="text-slate-600">Menus & Role Permissions</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Role-Based Menu & Permission Management
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-blue-600" />
                Drag & Drop Studio
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize which sidebar menus are visible or hidden for each employee role, and drag to reorder their sidebar hierarchy.
            </p>
          </div>

          {/* Quick Preset Actions for Current Role */}
          {!isRoleAdmin && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleGrantAll}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition cursor-pointer"
              >
                Enable All Menus
              </button>
              <button
                type="button"
                onClick={handleRevokeAll}
                className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer"
              >
                Disable All
              </button>
              <button
                type="button"
                onClick={handleResetToDefaults}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Defaults
              </button>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* ROLE SELECTOR CARDS / TABS (Sidebar Theme Style) */}
        {/* ========================================================================= */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl text-slate-300">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Select Target Role to Configure
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Click a role below to manage its custom sidebar menus & permissions
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {ERP_ROLES.map((role) => {
              const isSelected = selectedRoleId === role.id;
              const userCount = userCountPerRole[role.id] || 0;
              const isRoleAdmin = role.id === 0;

              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`text-left p-3.5 rounded-xl transition-all flex flex-col justify-between group cursor-pointer border ${
                    isSelected
                      ? "bg-slate-800 border-blue-500/80 shadow-lg text-white ring-2 ring-blue-500/40"
                      : "bg-slate-950/60 border-slate-800 hover:bg-slate-800/60 hover:border-slate-700 text-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2 w-full">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border ${role.color.badge}`}
                    >
                      {isRoleAdmin ? (
                        <Lock className="w-3.5 h-3.5 text-purple-400" />
                      ) : (
                        <Shield className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                        isSelected
                          ? "bg-blue-600/40 text-blue-200 border border-blue-500/50"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {userCount} {userCount === 1 ? "staff" : "staff"}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs tracking-wide">{role.display_name}</span>
                      {isRoleAdmin && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800 font-mono">
                          Full Access
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                      {role.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW TABS BAR (Menu Builder vs Action Privileges vs Financials) */}
        {/* ========================================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab("menu_builder")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                activeTab === "menu_builder"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Menu Structure (Drag & Drop)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-mono">
                {activeNavItems.length} Active
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("actions")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                activeTab === "actions"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Action Capabilities</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("financials")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                activeTab === "financials"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Financial & Data Rules</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Configuring Role:</span>
            <span className="font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
              {activeRole.display_name} (ID: {activeRole.id})
            </span>
          </div>
        </div>

        {/* Admin Safety Notice */}
        {isRoleAdmin && (
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl flex items-center gap-3 text-xs text-purple-900 shadow-2xs">
            <ShieldCheck className="w-5 h-5 text-purple-600 shrink-0" />
            <div>
              <strong className="font-bold">Administrator Role is Universally Unlocked</strong>
              <p className="text-[11px] text-purple-800/80 mt-0.5">
                The Administrator account has full universal access to all sidebar modules and operational functions to prevent system lockout.
              </p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: DRAG & DROP MENU BUILDER (Matches user screenshot) */}
        {/* ========================================================================= */}
        {activeTab === "menu_builder" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ===================================================================== */}
            {/* LEFT COLUMN: INACTIVE MENUS */}
            {/* ===================================================================== */}
            <div
              className={`lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl text-slate-300 min-h-[500px] flex flex-col transition-all ${
                dropTarget?.column === "inactive"
                  ? "ring-2 ring-rose-500/80 bg-slate-900/90 border-rose-500"
                  : ""
              }`}
              onDragOver={(e) => handleDragOverColumn(e, "inactive")}
              onDrop={() => handleDrop("inactive")}
            >
              {/* Column Header */}
              <div className="pb-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white tracking-wide">Inactive Menus</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Drag and Drop to Inactive Menus (Hidden from sidebar)
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800/60">
                  {inactiveNavItems.length} Inactive
                </span>
              </div>

              {/* Inactive Items Drop List */}
              <div className="flex-1 py-4 space-y-2.5 overflow-y-auto">
                {inactiveNavItems.length === 0 ? (
                  <div className="h-44 border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center p-4 text-center text-slate-500 space-y-2">
                    <Eye className="w-6 h-6 text-slate-600" />
                    <p className="text-xs font-medium text-slate-400">All available menus are active</p>
                    <p className="text-[11px] text-slate-600">
                      Drag any menu from the right column here to hide it for {activeRole.display_name}.
                    </p>
                  </div>
                ) : (
                  inactiveNavItems.map((item, idx) => {
                    const IconComp = item.iconName ? ICON_MAP[item.iconName] || Layers : Layers;
                    const isDraggingThis = draggedItem?.itemKey === item.key;

                    return (
                      <div
                        key={item.key}
                        draggable={!isRoleAdmin}
                        onDragStart={(e) => handleDragStart(e, item.key, "inactive", idx)}
                        onDragEnd={handleDragEnd}
                        className={`group bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3 flex items-center justify-between gap-3 transition-all ${
                          isDraggingThis ? "opacity-30 scale-95 border-dashed" : "shadow-sm"
                        } ${isRoleAdmin ? "cursor-not-allowed opacity-60" : "cursor-grab active:cursor-grabbing"}`}
                      >
                        {/* Drag Handle & Info */}
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div
                            className="w-8 h-8 rounded-lg bg-rose-950/80 border border-rose-800/80 text-rose-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform"
                            title="Drag to move"
                          >
                            <Move className="w-4 h-4" />
                          </div>

                          <div className="p-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-400 shrink-0">
                            <IconComp className="w-4 h-4" />
                          </div>

                          <div className="overflow-hidden">
                            <h4 className="font-semibold text-xs text-slate-200 truncate group-hover:text-white">
                              {item.label}
                            </h4>
                            <p className="text-[10px] text-slate-500 truncate font-mono">
                              {item.route || item.key}
                            </p>
                          </div>
                        </div>

                        {/* Action Tools */}
                        {!isRoleAdmin && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMoveToActive(item.key)}
                              className="px-2.5 py-1 text-[11px] font-bold text-blue-300 hover:text-white bg-blue-950/60 hover:bg-blue-600 border border-blue-800/80 hover:border-blue-500 rounded-lg transition flex items-center gap-1 cursor-pointer"
                              title="Activate this menu"
                            >
                              <Plus className="w-3 h-3" />
                              <span className="hidden sm:inline">Add</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Column Footer */}
              <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Hidden from sidebar navigation</span>
                <span className="text-[10px] text-slate-600">Drag to Active →</span>
              </div>
            </div>

            {/* ===================================================================== */}
            {/* RIGHT COLUMN: ACTIVE MENU STRUCTURE */}
            {/* ===================================================================== */}
            <div
              className={`lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl text-slate-300 min-h-[500px] flex flex-col transition-all ${
                dropTarget?.column === "active" && dropTarget.index === undefined
                  ? "ring-2 ring-blue-500 bg-slate-900/90 border-blue-500"
                  : ""
              }`}
              onDragOver={(e) => handleDragOverColumn(e, "active")}
              onDrop={() => handleDrop("active")}
            >
              {/* Column Header */}
              <div className="pb-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white tracking-wide">Active Menu Structure</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Drag and Drop to Reorder (Visible in {activeRole.display_name}&apos;s sidebar in this order)
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800/60">
                  {activeNavItems.length} Menus Visible
                </span>
              </div>

              {/* Active Items Drop List */}
              <div className="flex-1 py-4 space-y-2.5 overflow-y-auto">
                {activeNavItems.length === 0 ? (
                  <div className="h-44 border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center p-4 text-center text-slate-500 space-y-2">
                    <EyeOff className="w-6 h-6 text-slate-600" />
                    <p className="text-xs font-medium text-slate-400">No active menus configured</p>
                    <p className="text-[11px] text-slate-600">
                      Drag menus from the Inactive Menus column on the left to show them in the sidebar.
                    </p>
                  </div>
                ) : (
                  activeNavItems.map((item, idx) => {
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
                        className={`group bg-slate-950 border rounded-xl p-3.5 flex items-center justify-between gap-3 transition-all ${
                          isTargetPosition
                            ? "border-blue-500 ring-2 ring-blue-500/40 bg-blue-950/30"
                            : "border-slate-800 hover:border-slate-700 hover:bg-slate-800/60"
                        } ${isDraggingThis ? "opacity-30 scale-95 border-dashed" : "shadow-md"} ${
                          isRoleAdmin ? "cursor-not-allowed opacity-90" : "cursor-grab active:cursor-grabbing"
                        }`}
                      >
                        {/* Drag Handle & Info */}
                        <div className="flex items-center gap-3 overflow-hidden">
                          {/* 4-way arrow handle box matching screenshot */}
                          <div
                            className="w-8 h-8 rounded-lg bg-blue-950/90 border border-blue-700/80 text-blue-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform"
                            title="Drag to reorder"
                          >
                            <Move className="w-4 h-4" />
                          </div>

                          <div className="p-2 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 shrink-0">
                            <IconComp className="w-4 h-4" />
                          </div>

                          <div className="overflow-hidden">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-xs text-white truncate">
                                {item.label}
                              </h4>
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                #{idx + 1}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              {item.description}
                            </p>
                          </div>
                        </div>

                        {/* Quick Controls */}
                        {!isRoleAdmin && (
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Move Up Button */}
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveOrder(idx, "up")}
                              className="p-1.5 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition disabled:opacity-30 disabled:hover:text-slate-400 cursor-pointer"
                              title="Move Up"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>

                            {/* Move Down Button */}
                            <button
                              type="button"
                              disabled={idx === activeNavItems.length - 1}
                              onClick={() => handleMoveOrder(idx, "down")}
                              className="p-1.5 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition disabled:opacity-30 disabled:hover:text-slate-400 cursor-pointer"
                              title="Move Down"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>

                            {/* Deactivate Button */}
                            <button
                              type="button"
                              onClick={() => handleMoveToInactive(item.key)}
                              className="p-1.5 text-rose-400 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/60 rounded-lg transition ml-1 cursor-pointer"
                              title="Hide menu (Move to Inactive)"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Column Footer */}
              <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Appears directly in the sidebar for {activeRole.display_name}</span>
                <span className="text-[10px] text-blue-400">Order from Top to Bottom</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ACTION & CREATION CAPABILITIES */}
        {/* ========================================================================= */}
        {activeTab === "actions" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Operational & Creation Capabilities for {activeRole.display_name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Authorize or restrict specific operational actions like creating customers, suppliers, POs, or approving QC checks.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {PERMISSION_DEFINITIONS.filter((p) => p.category === "actions").map((p) => {
                const isGranted = isRoleAdmin ? true : localPermissions[p.key] ?? false;

                return (
                  <div
                    key={p.key}
                    onClick={() => handleTogglePermission(p.key)}
                    className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                      isRoleAdmin
                        ? "bg-slate-50/40 cursor-default"
                        : isGranted
                        ? "hover:bg-blue-50/30 cursor-pointer"
                        : "hover:bg-slate-50/70 cursor-pointer opacity-80"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-xl mt-0.5 shrink-0 transition-colors ${
                          isGranted
                            ? "bg-blue-50 text-blue-600 border border-blue-200/60"
                            : "bg-slate-100 text-slate-400 border border-slate-200"
                        }`}
                      >
                        <Sliders className="w-4 h-4" />
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
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-80 disabled:cursor-not-allowed ${
                        isGranted ? "bg-blue-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          isGranted ? "translate-x-5" : "translate-x-0"
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
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Financial & Data Visibility Rules for {activeRole.display_name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Control whether this role can see commercial amounts (₹), download CSV exports, or perform record deletion.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {PERMISSION_DEFINITIONS.filter((p) => p.category === "financials").map((p) => {
                const isGranted = isRoleAdmin ? true : localPermissions[p.key] ?? false;

                return (
                  <div
                    key={p.key}
                    onClick={() => handleTogglePermission(p.key)}
                    className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                      isRoleAdmin
                        ? "bg-slate-50/40 cursor-default"
                        : isGranted
                        ? "hover:bg-blue-50/30 cursor-pointer"
                        : "hover:bg-slate-50/70 cursor-pointer opacity-80"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-xl mt-0.5 shrink-0 transition-colors ${
                          isGranted
                            ? "bg-amber-50 text-amber-600 border border-amber-200/60"
                            : "bg-slate-100 text-slate-400 border border-slate-200"
                        }`}
                      >
                        <Receipt className="w-4 h-4" />
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
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-80 disabled:cursor-not-allowed ${
                        isGranted ? "bg-blue-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          isGranted ? "translate-x-5" : "translate-x-0"
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
        {/* DISCORD-STYLE FLOATING "UNSAVED CHANGES" SAVE BAR */}
        {/* ========================================================================= */}
        {hasUnsavedChanges && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-2xl bg-slate-950 text-white border border-slate-700/80 rounded-2xl p-4 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center gap-2.5 text-xs">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping" />
              <span>
                Careful — you have unsaved menu/permission modifications for{" "}
                <strong className="text-blue-400 font-semibold">{activeRole.display_name}</strong>!
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDiscardChanges}
                disabled={isSaving}
                className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white transition font-medium cursor-pointer"
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
                Save Menu Structure
              </MotionButton>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
