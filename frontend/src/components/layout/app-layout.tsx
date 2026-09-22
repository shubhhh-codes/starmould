"use client";

import React, { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileDrawerOpen}
        onMobileClose={() => setMobileDrawerOpen(false)}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 pl-0 ${
          sidebarCollapsed ? "md:pl-16" : "md:pl-64"
        }`}
      >
        {/* Topbar */}
        <Topbar
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          onToggleMobileMenu={() => setMobileDrawerOpen(!mobileDrawerOpen)}
          currentUser={{
            name: "Akshay",
            email: "akshay@star.in",
            role: "Admin",
            initials: "AKS",
          }}
        />

        {/* Dynamic Page Content */}
        <main className="flex-1 p-3 sm:p-4 md:p-6 max-w-[1600px] w-full mx-auto">
          {children}
        </main>

        {/* Global Footer */}
        <footer className="py-3 px-4 sm:px-6 border-t border-slate-200 bg-white text-slate-500 text-xs flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>2026 © Star Mould ERP Solutions</span>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Server: Supabase Postgres</span>
            <span>•</span>
            <span>Client: Next.js 15+</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
