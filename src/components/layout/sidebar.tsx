"use client";

import Image from "next/image";

import React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Layers,
  Scan,
  ShoppingCart,
  PackagePlus,
  ArrowUpRight,
  Truck,
  ArrowDownLeft,
  Briefcase,
  Receipt,
  ShieldCheck,
  BarChart3,
  FileDown,
  ChevronRight,
  Factory,
  LogOut,
  User as UserIcon,
  X,
  Building2,
  Settings,
  FileText,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  allowedRoles: number[]; // 0: Admin, 1: Manager, 2: Supervisor, 3: Designer, 4: Worker, 5: Purchase Incharge, 6: VMC, 7: QC, 9: Dispatch, 10: Programmer
  permKey?: string;
}

export const navigationItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    allowedRoles: [0, 1, 2, 3, 4, 5, 6, 7, 9, 10],
    permKey: "nav_dashboard",
  },
  {
    title: "Customer Creator",
    href: "/customers",
    icon: Building2,
    badge: "Admin",
    allowedRoles: [0], // Admin only
    permKey: "nav_customer_creator",
  },
  {
    title: "Vendor / Transport",
    href: "/vendors",
    icon: Truck,
    allowedRoles: [0, 1, 5, 9], // Admin, Manager, Purchase Incharge, Dispatch
    permKey: "nav_vendor_transport",
  },
  {
    title: "Subplate Master",
    href: "/subplate",
    icon: Layers,
    allowedRoles: [0, 1, 2, 3, 6, 7, 9, 10],
    permKey: "nav_subplate",
  },
  {
    title: "Add new mould",
    href: "/scanning",
    icon: Scan,
    allowedRoles: [0, 1, 2, 3, 4, 6, 7, 9, 10],
    permKey: "nav_scanning",
  },
  {
    title: "Quotations",
    href: "/quotation",
    icon: FileText,
    allowedRoles: [0, 1, 5],
    permKey: "nav_quotation",
  },
  {
    title: "Purchase Order",
    href: "/purchase",
    icon: ShoppingCart,
    allowedRoles: [0, 1, 5],
    permKey: "nav_purchase",
  },
  {
    title: "Purchase Inward",
    href: "/purchase-inward",
    icon: PackagePlus,
    allowedRoles: [0, 1, 5],
    permKey: "nav_purchase_inward",
  },
  {
    title: "Outward Jobwork",
    href: "/challan",
    icon: ArrowUpRight,
    allowedRoles: [0, 1, 2, 9],
    permKey: "nav_challan",
  },
  {
    title: "Dispatch (Final)",
    href: "/dispatch",
    icon: Truck,
    allowedRoles: [0, 1, 2, 9],
    permKey: "nav_dispatch",
  },
  {
    title: "Inward Jobwork",
    href: "/inward",
    icon: ArrowDownLeft,
    allowedRoles: [0, 1, 2, 5, 7, 9],
    permKey: "nav_inward",
  },
  {
    title: "Work / Worklog",
    href: "/work",
    icon: Briefcase,
    allowedRoles: [0, 1, 2, 3, 4, 6, 7, 10],
    permKey: "nav_work",
  },
  {
    title: "Expense & Finance",
    href: "/expense",
    icon: Receipt,
    allowedRoles: [0, 1],
    permKey: "nav_expense",
  },
  {
    title: "User Management",
    href: "/user",
    icon: ShieldCheck,
    allowedRoles: [0], // Admin only
    permKey: "nav_user_mgmt",
  },
  {
    title: "Role & Permissions",
    href: "/settings",
    icon: Settings,
    badge: "Admin",
    allowedRoles: [0], // Admin only
    permKey: "nav_settings",
  },
  {
    title: "Reports & Downtime",
    href: "/report",
    icon: BarChart3,
    allowedRoles: [0, 1, 2, 5, 7, 9],
    permKey: "nav_reports",
  },
  {
    title: "Export Streams",
    href: "/export",
    icon: FileDown,
    allowedRoles: [0, 1, 5, 9],
    permKey: "nav_export",
  },
];

import { useAuth, getCachedSession } from "@/components/providers/auth-provider";
import { useRolePermissions } from "@/components/providers/permissions-provider";
import { useSmartPrefetch, useBackgroundPrefetchWarmup } from "@/lib/query/prefetch";
import { overlayStack } from "@/lib/overlay-stack";
import { DEFAULT_ROLE_MENU_ORDERS } from "@/lib/permissions/defaults";

export interface SidebarProps {
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
  const searchParams = useSearchParams();
  const { currentUser: authUser, logout } = useAuth();
  const { hasPermission, getRoleMenuOrder } = useRolePermissions();
  const { prefetchRoute } = useSmartPrefetch();
  useBackgroundPrefetchWarmup();
  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    setIsMounted(true);
  }, []);
  const cachedUser = isMounted && typeof window !== "undefined" ? getCachedSession() : null;
  const activeUser = propUser !== undefined ? (propUser || cachedUser) : (authUser || cachedUser);
  const userRoleId = activeUser?.role_id;

  const isItemActive = React.useCallback(
    (itemHref: string) => {
      if (itemHref === "/") {
        return pathname === "/";
      }
      if (pathname === itemHref) {
        return true;
      }
      const baseHref = itemHref.split("?")[0];
      return pathname.startsWith(`${baseHref}/`);
    },
    [pathname]
  );

  // ESC stack integration for mobile drawer
  React.useEffect(() => {
    if (mobileOpen && onMobileClose) {
      overlayStack.push("mobile-sidebar-drawer", () => {
        onMobileClose();
      });
    } else {
      overlayStack.pop("mobile-sidebar-drawer");
    }
    return () => {
      overlayStack.pop("mobile-sidebar-drawer");
    };
  }, [mobileOpen, onMobileClose]);

  // Filter and sort menu items strictly by user role and active permission matrix & menu order
  const visibleItems = React.useMemo(() => {
    // Before mounting (SSR & initial client hydration), render baseline order to guarantee 100% hydration match
    if (!isMounted) {
      const defaultAllowed = navigationItems.filter(() => true);
      const defaultOrder = DEFAULT_ROLE_MENU_ORDERS[0] || [];
      if (defaultOrder.length === 0) return defaultAllowed;
      return [...defaultAllowed].sort((a, b) => {
        const aKey = a.permKey || a.href;
        const bKey = b.permKey || b.href;
        const aIndex = defaultOrder.indexOf(aKey);
        const bIndex = defaultOrder.indexOf(bKey);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return 0;
      });
    }

    let effectiveRoleId = userRoleId;
    if (effectiveRoleId === undefined && typeof window !== "undefined") {
      const cached = getCachedSession();
      if (cached && cached.role_id !== undefined) {
        effectiveRoleId = cached.role_id;
      }
    }
    const roleId = Number(effectiveRoleId ?? (activeUser ? 4 : 0));
    
    // First, filter items that the role has permission to view
    const allowed = navigationItems.filter((item) => {
      // Role & Permissions (/settings) is strictly Admin only
      if (item.href === "/settings" || item.permKey === "nav_settings") {
        return roleId === 0;
      }
      if (roleId === 0) return true; // Admin has universal access
      if (item.permKey) {
        return hasPermission(item.permKey, roleId);
      }
      return item.allowedRoles.includes(roleId);
    });

    // Next, sort allowed items based on the role's configured menu order
    const configuredOrder = getRoleMenuOrder(roleId);
    if (!configuredOrder || configuredOrder.length === 0) {
      return allowed;
    }

    return [...allowed].sort((a, b) => {
      const aKey = a.permKey || a.href;
      const bKey = b.permKey || b.href;
      const aIndex = configuredOrder.indexOf(aKey);
      const bIndex = configuredOrder.indexOf(bKey);

      // If both are in the configured order, use that order
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      // If only one is in the configured order, prioritize the configured one
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return 0;
    });
  }, [isMounted, userRoleId, hasPermission, getRoleMenuOrder]);

  const handleLogout = async () => {
    await logout();
  };

  const handlePrefetch = (href: string) => {
    prefetchRoute(href);
  };

  return (
    <>
      {/* Mobile Backdrop Overlay with physics fade */}
      {mobileOpen && (
        <div
          onClick={onMobileClose}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs md:hidden animate-backdrop-fade"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-screen transition-all duration-300 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col ${
          collapsed ? "md:w-16" : "md:w-64"
        } ${
          mobileOpen
            ? "w-64 translate-x-0 shadow-2xl animate-drawer-left"
            : "w-64 -translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand Logo Header */}
        <div className="relative h-16 flex items-center justify-center px-3 border-b border-slate-800/80 bg-slate-950/50 select-none">
          <div className="flex items-center justify-center overflow-hidden py-1 pointer-events-none w-full">
            {collapsed && !mobileOpen ? (
              <div className="h-10 w-10 flex items-center justify-center flex-shrink-0">
                <Image
                  src="/images/star-mould-logo.webp?v=1"
                  alt="Star Mould"
                  width={36}
                  height={36}
                  unoptimized
                  className="h-8 w-8 object-contain"
                  priority
                />
              </div>
            ) : (
              <div className="flex items-center justify-center overflow-hidden w-full px-2">
                <Image
                  src="/images/star-mould-logo.webp?v=1"
                  alt="Star Mould"
                  width={190}
                  height={50}
                  unoptimized
                  className="h-10 w-auto max-w-[190px] object-contain"
                  priority
                />
              </div>
            )}
          </div>

          {/* Close button for mobile drawer */}
          <button
            onClick={onMobileClose}
            className="btn-interactive absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 md:hidden transition cursor-pointer"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links Scrollable Area */}
        <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1 sidebar-nav-scroll">
          <div className="px-2 pb-2 flex items-center justify-between">
            {(!collapsed || mobileOpen) && (
              <>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Core Modules
                </p>
                {isMounted && activeUser?.role && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50" suppressHydrationWarning>
                    {activeUser.role}
                  </span>
                )}
              </>
            )}
          </div>

          {visibleItems.map((item) => {
            const isActive = isItemActive(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onMobileClose?.()}
                onMouseEnter={() => handlePrefetch(item.href)}
                onFocus={() => handlePrefetch(item.href)}
                title={collapsed && !mobileOpen ? item.title : undefined}
                className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium relative select-none ${
                  isActive
                    ? "text-white"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors duration-100"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-sidebar-pill"
                    transition={{
                      duration: 0.18,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="absolute inset-0 bg-blue-600 rounded-lg shadow-sm shadow-blue-600/30 z-0 pointer-events-none"
                  />
                )}
                <Icon
                  className={`h-4 w-4 flex-shrink-0 relative z-10 transition-colors duration-100 ${
                    isActive ? "text-white" : "text-slate-400 group-hover:text-blue-400"
                  }`}
                />
                {(!collapsed || mobileOpen) && (
                  <span className="truncate flex-1 relative z-10">{item.title}</span>
                )}
                {(!collapsed || mobileOpen) && isActive && (
                  <ChevronRight className="h-3 w-3 text-white/80 relative z-10 shrink-0" />
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
                  <p className="font-semibold text-white truncate text-[11px]" suppressHydrationWarning>
                    {activeUser?.name || "User"}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate" suppressHydrationWarning>
                    {activeUser?.role || "Staff"}
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
