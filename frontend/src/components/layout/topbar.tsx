"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Menu,
  Search,
  Bell,
  LogOut,
  KeyRound,
  Shield,
  Clock,
  Sparkles,
  ChevronDown,
  Command,
  Layers,
  Scan,
  Printer,
  ShoppingCart,
  ArrowUpRight,
  Truck,
  ArrowDownLeft,
  Users,
  LayoutDashboard,
  Receipt,
  FileDown,
  Settings,
  PackagePlus,
  Compass,
  Building2,
} from "lucide-react";
import { CommandPalette } from "@/components/ui/command-palette";
import { Modal } from "@/components/ui/dialog";
import { MotionButton } from "@/components/ui/motion-button";

interface TopbarProps {
  onToggleSidebar?: () => void;
  onToggleMobileMenu?: () => void;
  currentUser?: {
    name: string;
    email: string;
    role: string;
    initials: string;
    role_id?: number;
    username?: string;
  } | null;
}

// Map pathnames to clean page titles & icons
const PAGE_INFO: Record<string, { title: string; category?: string; icon: React.ElementType }> = {
  "/": { title: "Production Dashboard", category: "Overview", icon: LayoutDashboard },
  "/subplate": { title: "Subplate Master & Pipeline", category: "Manufacturing", icon: Layers },
  "/scanning": { title: "Scanning & Moulds", category: "Operations", icon: Scan },
  "/printing": { title: "3D Printing Studio", category: "Operations", icon: Printer },
  "/purchase": { title: "Purchase Orders", category: "Procurement", icon: ShoppingCart },
  "/purchase-inward": { title: "Purchase Inward", category: "Procurement", icon: PackagePlus },
  "/challan": { title: "Outward Challans", category: "Logistics", icon: ArrowUpRight },
  "/dispatch": { title: "Goods Dispatch", category: "Logistics", icon: Truck },
  "/customers": { title: "Customer Creator", category: "Master Data", icon: Building2 },
  "/vendors": { title: "Vendor & Transport Management", category: "Master Data", icon: Truck },
  "/sample": { title: "Sample & Rework Orders", category: "Production", icon: Sparkles },
  "/user": { title: "Staff & User Management", category: "Admin", icon: Shield },
  "/expense": { title: "Expense Ledger", category: "Finance", icon: Receipt },
  "/report": { title: "Production & Financial Reports", category: "Analytics", icon: Compass },
  "/export": { title: "Master CSV Exports", category: "Exports", icon: FileDown },
  "/settings": { title: "System & Permissions Settings", category: "Settings", icon: Settings },
};

export function Topbar({
  onToggleSidebar,
  onToggleMobileMenu,
  currentUser,
}: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Global keyboard shortcut listener for Ctrl + K / Cmd + K
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        setShowCommandPalette((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown, true);
    };
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    if (showUserDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showUserDropdown]);

  const searchParams = useSearchParams();
  const currentPage = PAGE_INFO[pathname] || {
    title: "StarMould ERP",
    category: "Workspace",
    icon: Layers,
  };
  const PageIcon = currentPage.icon;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long");
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update password");
      }

      setPasswordSuccess(true);
      setTimeout(() => {
        setPasswordSuccess(false);
        setShowPasswordModal(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPasswordError(null);
      }, 1200);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to change password";
      setPasswordError(message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <>
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
      />

      <header className="sticky top-0 z-30 h-16 bg-slate-900 border-b border-slate-800 text-slate-200 px-3 sm:px-4 md:px-6 flex items-center justify-between gap-3 sm:gap-6 shadow-sm">
        
        {/* Left Section: Menu Toggle & Dynamic Breadcrumb / Page Title */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            onClick={() => {
              if (typeof window !== "undefined" && window.innerWidth < 768) {
                if (onToggleMobileMenu) onToggleMobileMenu();
                else if (onToggleSidebar) onToggleSidebar();
              } else {
                onToggleSidebar?.();
              }
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none min-w-[38px] min-h-[38px] flex items-center justify-center cursor-pointer border border-slate-800 hover:border-slate-700 shadow-2xs"
            aria-label="Toggle Navigation Sidebar"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>

          {/* Current Page Context Badge */}
          <div className="hidden sm:flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <PageIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  {currentPage.category}
                </span>
              </div>
              <h2 className="text-sm font-bold text-white tracking-tight truncate mt-0.5">
                {currentPage.title}
              </h2>
            </div>
          </div>
        </div>

        {/* Center: Global Fast Search & Command Palette Trigger */}
        <div className="flex-1 max-w-md mx-auto min-w-[160px]">
          <button
            type="button"
            onClick={() => setShowCommandPalette(true)}
            className="w-full group flex items-center justify-between pl-3.5 pr-2.5 py-2 text-xs rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 text-slate-400 hover:text-slate-200 transition-all cursor-pointer shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <div className="flex items-center gap-2.5 min-w-0 truncate">
              <Search className="h-4 w-4 text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" />
              <span className="truncate text-slate-400 group-hover:text-slate-200 text-xs">
                Search order ID, mould, subplate…
              </span>
            </div>
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-slate-900/90 rounded-md border border-slate-700/90 group-hover:border-slate-600 shadow-2xs shrink-0 ml-2">
              <Command className="w-3 h-3 text-slate-400" /> K
            </kbd>
          </button>
        </div>

        {/* Right Section: Shift Status, Notifications & User Profile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          
          {/* Shift / Work Time indicator */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 text-[11px] font-medium text-slate-300 border border-slate-700/60 shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-slate-200">Production Active</span>
          </div>

          {/* Quick Notifications Button */}
          <button
            type="button"
            title="System Alerts & Activity"
            onClick={() => setShowCommandPalette(true)}
            className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700 cursor-pointer"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-slate-900" />
          </button>

          {/* User Profile Menu with Popover */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2.5 p-1 pl-2 rounded-xl hover:bg-slate-800 transition-colors text-left cursor-pointer border border-transparent hover:border-slate-700"
            >
              <div className="flex flex-col text-right hidden sm:flex">
                <span className="text-xs font-bold text-white leading-tight">
                  {currentUser?.name || "User"}
                </span>
                <span className="text-[10px] text-slate-400 flex items-center justify-end gap-1 capitalize font-medium">
                  <Shield className="h-2.5 w-2.5 text-blue-400" />
                  {currentUser?.role || "Staff"}
                </span>
              </div>
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-blue-500/20">
                {currentUser?.initials || currentUser?.name?.slice(0, 2).toUpperCase() || "SM"}
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
            </button>

            {/* Dropdown Menu */}
            {currentUser && showUserDropdown && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl py-1 text-xs text-slate-300 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-2.5 border-b border-slate-800">
                  <p className="font-bold text-white text-xs">{currentUser.name}</p>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">@{currentUser.username || currentUser.email}</p>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-900/40 border border-blue-700/50 text-blue-300 text-[10px] font-semibold capitalize">
                    <Sparkles className="h-2.5 w-2.5 text-blue-400" />
                    Role: {currentUser.role}
                  </div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      setShowCommandPalette(true);
                    }}
                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <Search className="h-3.5 w-3.5 text-blue-400" />
                      Global Search
                    </span>
                    <kbd className="text-[9px] font-mono text-slate-500 bg-slate-800 px-1 py-0.5 rounded border border-slate-700">Ctrl K</kbd>
                  </button>
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      setShowPasswordModal(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <KeyRound className="h-3.5 w-3.5 text-cyan-400" />
                    Change Password
                  </button>
                </div>

                <div className="border-t border-slate-800 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors cursor-pointer font-medium"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Change Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Change Your Password"
        description="Update your credentials for secure ERP access"
      >
        <form onSubmit={handlePasswordChange} className="space-y-4">
          {passwordError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs animate-in fade-in">
              {passwordError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              New Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
              placeholder="••••••••"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <MotionButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowPasswordModal(false)}
            >
              Cancel
            </MotionButton>
            <MotionButton
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isChangingPassword}
              isSuccess={passwordSuccess}
              loadingText="Updating..."
              successText="Password Changed!"
            >
              Update Password
            </MotionButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
