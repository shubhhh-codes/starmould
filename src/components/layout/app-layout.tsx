"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { TopProgressBar } from "@/components/ui/top-progress-bar";
import { ShieldAlert } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { useRolePermissions } from "@/components/providers/permissions-provider";

interface AppLayoutProps {
  children: React.ReactNode;
}

function AppLayoutContent({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { currentUser, isSessionLoaded } = useAuth();
  const { canAccessRoute } = useRolePermissions();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isSessionLoaded && !currentUser && pathname !== "/login") {
      router.push("/login");
    }
  }, [isSessionLoaded, currentUser, pathname, router]);

  // Determine if current user is authorized for current route dynamically
  // Prevent SSR hydration mismatch: During SSR and initial client hydration, evaluate to true
  const isAuthorized = React.useMemo(() => {
    if (!isMounted || !currentUser) return true;
    if (currentUser.role_id === 0) return true; // Admin has universal access
    return canAccessRoute(pathname, currentUser.role_id);
  }, [isMounted, currentUser, pathname, canAccessRoute]);

  // If session loaded but unauthorized after mount, trigger instant redirect
  useEffect(() => {
    if (isMounted && isSessionLoaded && currentUser && !isAuthorized) {
      router.replace("/");
    }
  }, [isMounted, isSessionLoaded, currentUser, isAuthorized, router]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col w-full max-w-full min-w-0 overflow-x-hidden">
      <TopProgressBar />

      {/* Sidebar */}
      <React.Suspense fallback={null}>
        <Sidebar
          collapsed={sidebarCollapsed}
          mobileOpen={mobileDrawerOpen}
          onMobileClose={() => setMobileDrawerOpen(false)}
          currentUser={currentUser}
        />
      </React.Suspense>

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 w-full max-w-full transition-all duration-300 pl-0 ${
          sidebarCollapsed ? "md:pl-16" : "md:pl-64"
        }`}
      >
        {/* Topbar */}
        <React.Suspense fallback={<div className="h-16 border-b border-slate-200 bg-white" />}>
          <Topbar
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
            onToggleMobileMenu={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            currentUser={currentUser}
          />
        </React.Suspense>

        {/* Dynamic Page Content (Seamless render) */}
        <main className="flex-1 p-3 sm:p-5 lg:p-6 w-full max-w-full min-w-0 overflow-x-hidden">
          {isMounted && isSessionLoaded && currentUser && !isAuthorized ? (
            <div className="flex flex-col items-center justify-center py-24 text-center space-y-3 animate-in fade-in duration-200">
              <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-200">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Access Restricted</h2>
              <p className="text-xs text-slate-500 max-w-sm">
                Your role ({currentUser?.role}) does not have permission to view this module. Redirecting to dashboard...
              </p>
            </div>
          ) : (
            <div className="animate-in fade-in duration-150">
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  return <AppLayoutContent>{children}</AppLayoutContent>;
}
