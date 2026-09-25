"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  X,
} from "lucide-react";

interface TopbarProps {
  onToggleSidebar?: () => void;
  onToggleMobileMenu?: () => void;
  currentUser?: {
    name: string;
    email: string;
    role: string;
    initials: string;
    role_id?: number;
  } | null;
}

const ALL_TOP_NAV_LINKS = [
  { href: "/", label: "Live Projects", allowedRoles: [0, 1, 2, 3, 4] },
  { href: "/subplate", label: "Subplate", allowedRoles: [0, 1, 2, 3] },
  { href: "/scanning", label: "Scanning", allowedRoles: [0, 1, 2, 3, 4] },
  { href: "/purchase", label: "Purchase", allowedRoles: [0, 1] },
  { href: "/challan", label: "Outward Challan", allowedRoles: [0, 1, 2] },
  { href: "/dispatch", label: "Dispatch", allowedRoles: [0, 1, 2] },
  { href: "/inward", label: "Inward", allowedRoles: [0, 1, 2] },
  { href: "/customer", label: "Customers", allowedRoles: [0, 1] },
];

export function Topbar({
  onToggleSidebar,
  onToggleMobileMenu,
  currentUser,
}: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

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

  const userRoleId = currentUser?.role_id;
  const visibleTopNavLinks =
    userRoleId !== undefined && userRoleId !== null
      ? ALL_TOP_NAV_LINKS.filter((item) => item.allowedRoles.includes(Number(userRoleId)))
      : ALL_TOP_NAV_LINKS;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters long");
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
      <header className="sticky top-0 z-30 h-16 bg-slate-900 border-b border-slate-800 text-slate-200 px-3 sm:px-4 md:px-6 flex items-center justify-between shadow-sm">
        {/* Left Section: Menu toggle & Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (typeof window !== "undefined" && window.innerWidth < 768) {
                if (onToggleMobileMenu) onToggleMobileMenu();
                else if (onToggleSidebar) onToggleSidebar();
              } else {
                onToggleSidebar?.();
              }
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer"
            aria-label="Toggle Menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Quick Module Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1 text-xs">
            {visibleTopNavLinks.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname === link.href || pathname.startsWith(link.href + "/");

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                    isActive
                      ? "text-white bg-blue-600 shadow-xs font-semibold"
                      : "text-slate-300 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Center: Global Search */}
        <div className="hidden md:flex items-center flex-1 max-w-xs mx-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search mould, customer, plate..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        {/* Right Section: System status, Notifications & User profile */}
        <div className="flex items-center gap-3">
          {/* Shift / Work Time indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/60 text-[11px] text-slate-300 border border-slate-700/60">
            <Clock className="h-3 w-3 text-blue-400" />
            <span>Shift Active</span>
          </div>

          {/* Notifications button */}
          <button
            title="Notifications"
            className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-slate-900" />
          </button>

          {/* User Profile Menu */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2.5 p-1 pl-2 rounded-lg hover:bg-slate-800 transition-colors text-left cursor-pointer"
            >
              <div className="flex flex-col text-right hidden sm:flex">
                <span className="text-xs font-semibold text-white leading-tight">
                  {currentUser?.name || "User"}
                </span>
                <span className="text-[10px] text-slate-400 flex items-center justify-end gap-1">
                  <Shield className="h-2.5 w-2.5 text-blue-400" />
                  {currentUser?.role || "Staff"}
                </span>
              </div>
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shadow-xs">
                {currentUser?.initials || "SM"}
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
            </button>

            {/* Dropdown Menu */}
            {currentUser && showUserDropdown && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-xl py-1 text-xs text-slate-300 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2.5 border-b border-slate-800">
                  <p className="font-semibold text-white">{currentUser.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{currentUser.email}</p>
                  <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-900/60 border border-blue-700/50 text-blue-300 text-[10px] font-medium">
                    <Sparkles className="h-2.5 w-2.5" />
                    Role: {currentUser.role}
                  </div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      setShowPasswordModal(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-800/80 text-slate-300 hover:text-white transition-colors"
                  >
                    <KeyRound className="h-3.5 w-3.5 text-blue-400" />
                    Change Password
                  </button>
                </div>

                <div className="pt-1 border-t border-slate-800">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Change Password Modal (recreated from old app's topbar modal) */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2 font-semibold text-sm text-white">
                <KeyRound className="h-4 w-4 text-blue-400" />
                Change Account Password
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handlePasswordChange} className="p-5 space-y-4 text-xs">
              {passwordSuccess && (
                <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-medium">
                  Password updated successfully!
                </div>
              )}

              {passwordError && (
                <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 font-medium">
                  {passwordError}
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  disabled={isChangingPassword}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 chars)"
                  disabled={isChangingPassword}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  disabled={isChangingPassword}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  disabled={isChangingPassword}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 font-medium transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium shadow-xs shadow-blue-600/30 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  {isChangingPassword ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
