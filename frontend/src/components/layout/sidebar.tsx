"use client";

import React from "react";
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
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  roles?: string[];
}

export const navigationItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Customer / Vendor",
    href: "/customer",
    icon: Users,
  },
  {
    title: "Subplate",
    href: "/subplate",
    icon: Layers,
  },
  {
    title: "Scanning",
    href: "/scanning",
    icon: Scan,
  },
  {
    title: "Printing",
    href: "/printing",
    icon: Printer,
  },
  {
    title: "Purchase",
    href: "/purchase",
    icon: ShoppingCart,
  },
  {
    title: "Purchase Inward",
    href: "/purchase-inward",
    icon: PackagePlus,
  },
  {
    title: "Challan (Outward)",
    href: "/challan",
    icon: ArrowUpRight,
  },
  {
    title: "Dispatch",
    href: "/dispatch",
    icon: Truck,
  },
  {
    title: "Inward (Return)",
    href: "/inward",
    icon: ArrowDownLeft,
  },
  {
    title: "Work / Worklog",
    href: "/work",
    icon: Briefcase,
  },
  {
    title: "Expense",
    href: "/expense",
    icon: Receipt,
  },
  {
    title: "Gram Master",
    href: "/gram",
    icon: Scale,
  },
  {
    title: "User Management",
    href: "/user",
    icon: ShieldCheck,
  },
  {
    title: "Reports",
    href: "/report",
    icon: BarChart3,
  },
  {
    title: "Export",
    href: "/export",
    icon: FileDown,
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed top-0 left-0 z-40 h-screen transition-all duration-300 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Brand Logo Header */}
      <div className="h-16 flex items-center px-4 gap-3 border-b border-slate-800/80 bg-slate-950/50">
        <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20 flex-shrink-0">
          <Factory className="h-5 w-5" />
        </div>
        {!collapsed && (
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

      {/* Navigation Links Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1 scrollbar-thin">
        <div className="px-2 pb-2">
          {!collapsed && (
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Core Modules
            </p>
          )}
        </div>

        {navigationItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.title : undefined}
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
              {!collapsed && (
                <span className="truncate flex-1">{item.title}</span>
              )}
              {!collapsed && isActive && (
                <ChevronRight className="h-3 w-3 text-white/70" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Sidebar Footer / System Badge */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
        {!collapsed ? (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-slate-800/50 text-[11px] text-slate-400">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="truncate">Production Live</span>
            <span className="ml-auto text-[10px] text-slate-400">v2.0</span>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" title="System Live" />
          </div>
        )}
      </div>
    </aside>
  );
}
