"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Layers,
  Scan,
  ShoppingCart,
  ArrowUpRight,
  Truck,
  ArrowDownLeft,
  Users,
  Receipt,
  FileDown,
  Plus,
  Command,
  ArrowRight,
  Loader2,
  Printer,
  Sparkles,
  ExternalLink,
  Shield,
  Compass,
  Building2,
} from "lucide-react";
import { Modal } from "./dialog";

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  icon?: React.ElementType;
  href?: string;
  action?: () => void;
  meta?: string;
}

const DEFAULT_NAV_COMMANDS: CommandItem[] = [
  {
    id: "nav-dashboard",
    title: "Production Dashboard",
    subtitle: "7-Stage Pipeline & Live Mould Overview",
    category: "Navigation",
    icon: Layers,
    href: "/",
  },
  {
    id: "nav-subplate",
    title: "Subplate Master & Progression",
    subtitle: "Track 9-stage workpiece machining pipeline",
    category: "Navigation",
    icon: Layers,
    href: "/subplate",
  },
  {
    id: "nav-scanning",
    title: "Scanning / Mould Projects",
    subtitle: "Mould project registration & stage staff allocation",
    category: "Navigation",
    icon: Scan,
    href: "/scanning",
  },
  {
    id: "nav-printing",
    title: "3D Printing Studio",
    subtitle: "Gram pricing calculation & print queue",
    category: "Navigation",
    icon: Printer,
    href: "/printing",
  },
  {
    id: "nav-purchase",
    title: "Purchase Orders",
    subtitle: "Raw material procurement ledger & inward receipts",
    category: "Navigation",
    icon: ShoppingCart,
    href: "/purchase",
  },
  {
    id: "nav-challan",
    title: "Outward Challans",
    subtitle: "Job work plate dispatches & delivery challans",
    category: "Navigation",
    icon: ArrowUpRight,
    href: "/challan",
  },
  {
    id: "nav-dispatch",
    title: "Finished Goods Dispatch",
    subtitle: "Final delivery & logistics register",
    category: "Navigation",
    icon: Truck,
    href: "/dispatch",
  },
  {
    id: "nav-inward",
    title: "Job Work Inward Returns",
    subtitle: "Material receipts from vendors",
    category: "Navigation",
    icon: ArrowDownLeft,
    href: "/inward",
  },
  {
    id: "nav-customers",
    title: "Customer Creator",
    subtitle: "Manage client customer accounts & billing profiles",
    category: "Navigation",
    icon: Building2,
    href: "/customers",
  },
  {
    id: "nav-vendors",
    title: "Vendor / Transport",
    subtitle: "Manage suppliers, logistics transporters & external partners",
    category: "Navigation",
    icon: Truck,
    href: "/vendors",
  },
  {
    id: "nav-sample",
    title: "Sample & Rework Orders",
    subtitle: "Manage sample prototypes and rework cycles",
    category: "Navigation",
    icon: Sparkles,
    href: "/sample",
  },
  {
    id: "nav-expense",
    title: "Expense Ledger",
    subtitle: "Financial transactions & rolling balances",
    category: "Navigation",
    icon: Receipt,
    href: "/expense",
  },
  {
    id: "nav-export",
    title: "Master CSV Exports",
    subtitle: "Download 7-in-1 manufacturing registers",
    category: "Navigation",
    icon: FileDown,
    href: "/export",
  },
  {
    id: "action-new-scan",
    title: "Register New Mould Project",
    subtitle: "Quick create in Scanning",
    category: "Quick Actions",
    icon: Plus,
    href: "/scanning?new=true",
  },
  {
    id: "action-new-po",
    title: "Create Purchase Order",
    subtitle: "Quick create raw material PO",
    category: "Quick Actions",
    icon: Plus,
    href: "/purchase?new=true",
  },
  {
    id: "action-new-challan",
    title: "Generate Outward Challan",
    subtitle: "Send workpiece to job work vendor",
    category: "Quick Actions",
    icon: Plus,
    href: "/challan?new=true",
  },
];

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [liveResults, setLiveResults] = useState<CommandItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search query with abort controller support
  const searchDatabase = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setLiveResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      const results: CommandItem[] = (data.results || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        subtitle: r.subtitle,
        category: r.category || "Search Results",
        href: r.href,
        meta: r.meta,
        icon:
          r.category === "Mould Orders"
            ? Scan
            : r.category === "Subplates"
            ? Layers
            : r.category === "Customers & Parties"
            ? Users
            : r.category === "Purchase Orders"
            ? ShoppingCart
            : r.category === "Challans"
            ? ArrowUpRight
            : r.category === "3D Printing"
            ? Printer
            : Search,
      }));
      setLiveResults(results);
    } catch {
      setLiveResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!query.trim()) {
      setLiveResults([]);
      setIsLoading(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      searchDatabase(query);
    }, 150);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, searchDatabase]);

  // Combined displayed results
  const displayedItems = React.useMemo(() => {
    if (!query.trim()) {
      return DEFAULT_NAV_COMMANDS;
    }

    const q = query.toLowerCase();
    const matchingNav = DEFAULT_NAV_COMMANDS.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        cmd.subtitle?.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q)
    );

    return [...liveResults, ...matchingNav];
  }, [query, liveResults]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [displayedItems]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setLiveResults([]);
      setIsLoading(false);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSelect = (cmd: CommandItem) => {
    onClose();
    if (cmd.action) {
      cmd.action();
    } else if (cmd.href) {
      router.push(cmd.href);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, displayedItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + displayedItems.length) % Math.max(1, displayedItems.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = displayedItems[selectedIndex];
      if (current) {
        handleSelect(current);
      }
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case "Mould Orders":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Subplates":
        return "bg-cyan-50 text-cyan-700 border-cyan-200";
      case "Customers & Parties":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "Purchase Orders":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "Challans":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "3D Printing":
        return "bg-teal-50 text-teal-700 border-teal-200";
      case "Quick Actions":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      showCloseButton={false}
      className="p-0! overflow-hidden rounded-2xl border-slate-200 shadow-2xl bg-white"
    >
      {/* Search Input Bar */}
      <div className="flex items-center px-4 py-3.5 border-b border-slate-100 gap-3 bg-slate-50/50">
        {isLoading ? (
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
        ) : (
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search Order ID, Project Code, Subplate, Customer, PO, Challan…"
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400 text-slate-900 font-medium"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="text-slate-400 hover:text-slate-600 text-xs px-1.5 py-0.5 rounded cursor-pointer"
          >
            Clear
          </button>
        )}
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-medium text-slate-400 bg-white rounded border border-slate-200 shadow-2xs">
          ESC to close
        </kbd>
      </div>

      {/* Results List */}
      <div className="max-h-96 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {isLoading && displayedItems.length === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center gap-2.5 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs font-medium text-slate-500">Searching orders, subplates, parties…</span>
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="py-14 text-center text-xs text-slate-400 space-y-1">
            <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-600 text-sm">No results found</p>
            <p>No matching orders, plates, parties, or commands for &ldquo;{query}&rdquo;</p>
          </div>
        ) : (
          displayedItems.map((cmd, idx) => {
            const isSelected = idx === selectedIndex;
            const Icon = cmd.icon || Search;
            const badgeClass = getCategoryBadgeClass(cmd.category);

            return (
              <button
                key={cmd.id}
                type="button"
                onClick={() => handleSelect(cmd)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all duration-100 cursor-pointer ${
                  isSelected
                    ? "bg-blue-50/90 text-blue-950 border border-blue-200/80 shadow-xs"
                    : "text-slate-700 hover:bg-slate-50 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`p-2 rounded-xl shrink-0 transition-colors ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {cmd.title}
                      </span>
                      {cmd.meta && (
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                          {cmd.meta}
                        </span>
                      )}
                    </div>
                    {cmd.subtitle && (
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {cmd.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${badgeClass}`}>
                    {cmd.category}
                  </span>
                  {isSelected ? (
                    <ArrowRight className="w-3.5 h-3.5 text-blue-600 shrink-0 animate-in slide-in-from-left-1 duration-150" />
                  ) : (
                    <ExternalLink className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 shrink-0" />
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer Helper */}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-3">
          <span>
            <kbd className="font-mono font-semibold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs">↑↓</kbd> Navigate
          </span>
          <span>
            <kbd className="font-mono font-semibold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs">↵</kbd> Select
          </span>
          <span>
            <kbd className="font-mono font-semibold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs">ESC</kbd> Close
          </span>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
          <Command className="w-3 h-3 text-slate-400" /> StarMould Global Search
        </span>
      </div>
    </Modal>
  );
}
