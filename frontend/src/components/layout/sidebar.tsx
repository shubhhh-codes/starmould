"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Layers,
  Scan,
  Printer,
  ShoppingCart,
  PackagePlus,
  ArrowUpRight,
  Truck,
  ArrowDownLeft,
  Briefcase,
  Receipt,
  Scale,
  ShieldCheck,
  BarChart3,
  FileDown,
  ChevronRight,
  Factory,
  RotateCcw,
  LogOut,
  User as UserIcon,
  X,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  allowedRoles: number[]; // 0: Admin, 1: Manager, 2: Supervisor, 3: Designer, 4: Worker
}

export const navigationItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    allowedRoles: [0, 1, 2, 3, 4],
  },
  {
    title: "Customer / Vendor",
    href: "/customer",
    icon: Users,
    allowedRoles: [0, 1],
  },
  {
    title: "Subplate Master",
    href: "/subplate",
    icon: Layers,
    allowedRoles: [0, 1, 2, 3],
  },
  {
    title: "Scanning / Moulds",
    href: "/scanning",
    icon: Scan,
    allowedRoles: [0, 1, 2, 3, 4],
  },
  {
    title: "Printing (Dispatch)",
    href: "/printing",
    icon: Printer,
    allowedRoles: [0, 1, 2],
  },
  {
    title: "Purchase Order",
    href: "/purchase",
    icon: ShoppingCart,
    allowedRoles: [0, 1],
  },
  {
    title: "Purchase Inward",
    href: "/purchase-inward",
    icon: PackagePlus,
    allowedRoles: [0, 1],
  },
  {
    title: "Challan (Outward)",
    href: "/challan",
    icon: ArrowUpRight,
    allowedRoles: [0, 1, 2],
  },
  {
    title: "Dispatch (Final)",
    href: "/dispatch",
    icon: Truck,
    allowedRoles: [0, 1, 2],
  },
  {
    title: "Inward (Return)",
    href: "/inward",
    icon: ArrowDownLeft,
    allowedRoles: [0, 1, 2],
  },
  {
    title: "Work / Worklog",
    href: "/work",
    icon: Briefcase,
    allowedRoles: [0, 1, 2, 3, 4],
  },
  {
    title: "Sample / Rework",
    href: "/sample",
    icon: RotateCcw,
    allowedRoles: [0, 1, 2, 3],
  },
  {
    title: "Expense & Finance",
    href: "/expense",
    icon: Receipt,
    allowedRoles: [0, 1],
  },
  {
    title: "Gram Master",
    href: "/gram",
    icon: Scale,
    allowedRoles: [0, 1],
  },
  {
    title: "User Management",
    href: "/user",
    icon: ShieldCheck,
    allowedRoles: [0], // Admin only
  },
  {
    title: "Reports & Downtime",
    href: "/report",
    icon: BarChart3,
    allowedRoles: [0, 1, 2],
  },
  {
    title: "Export Streams",
    href: "/export",
    icon: FileDown,
    allowedRoles: [0, 1],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  currentUser?: {
    id?: number;
    name?: string;
    username?: string;
    role_id?: number;
    role?: string;
  } | null;
}

export function Sidebar({
  collapsed = false,
  mobileOpen = false,
  onMobileClose,
  currentUser: propUser,
}: SidebarProps) {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<{
    id?: number;
    name?: string;
    username?: string;
    role_id?: number;
    role?: string;
  } | null>(propUser || null);

  useEffect(() => {
    if (propUser) {
      setCurrentUser(propUser);
      return;
    }
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch((err) => console.error("Error loading session:", err));
  }, [propUser]);

  // If user is loaded, use their role_id. If propUser is explicitly passed, use it.
  const activeUser = propUser || currentUser;
  const userRoleId = activeUser?.role_id ?? 0;

  // Filter menu items by user role
  const visibleItems = navigationItems.filter((item) =>
    item.allowedRoles.includes(userRoleId)
  );

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={onMobileClose}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs md:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-screen transition-all duration-300 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col ${
          collapsed ? "md:w-16" : "md:w-64"
        } ${
          mobileOpen
            ? "w-64 translate-x-0 shadow-2xl"
            : "w-64 -translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand Logo Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80 bg-slate-950/50">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20 flex-shrink-0">
              <Factory className="h-5 w-5" />
            </div>
            {(!collapsed || mobileOpen) && (
              <div className="flex flex-col overflow-hidden">
                <span className="font-bold text-white tracking-wide text-sm leading-tight truncate">
                  STAR MOULD
                </span>
                <span className="text-[10px] text-blue-400 font-medium tracking-wider uppercase">
                  ERP Manufacturing
                </span>
              </div>
            )}
          </div>

          {/* Close button for mobile drawer */}
          <button
            onClick={onMobileClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 md:hidden transition cursor-pointer"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links Scrollable Area */}
        <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1 scrollbar-thin">
          <div className="px-2 pb-2 flex items-center justify-between">
            {(!collapsed || mobileOpen) && (
              <>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Core Modules
                </p>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50">
                  {currentUser?.role || "Admin"}
                </span>
              </>
            )}
          </div>

          {visibleItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onMobileClose?.()}
                title={collapsed && !mobileOpen ? item.title : undefined}
                className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 relative ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/70"
                }`}
              >
                <Icon
                  className={`h-4 w-4 flex-shrink-0 transition-transform group-hover:scale-105 ${
                    isActive ? "text-white" : "text-slate-400 group-hover:text-blue-400"
                  }`}
                />
                {(!collapsed || mobileOpen) && (
                  <span className="truncate flex-1">{item.title}</span>
                )}
                {(!collapsed || mobileOpen) && isActive && (
                  <ChevronRight className="h-3 w-3 text-white/70" />
                )}
              </Link>
            );
          })}
        </div>

      {/* Sidebar Footer / User Profile & Logout */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 space-y-2">
        {!collapsed ? (
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-slate-800/50 text-xs">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="h-7 w-7 rounded-full bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300 flex-shrink-0">
                <UserIcon className="h-3.5 w-3.5" />
              </div>
              <div className="overflow-hidden">
                <p className="font-semibold text-white truncate text-[11px]">
                  {currentUser?.name || "Administrator"}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  Role {userRoleId}: {currentUser?.role || "Admin"}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition cursor-pointer"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-rose-400 rounded transition cursor-pointer"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
    </>
  );
}
