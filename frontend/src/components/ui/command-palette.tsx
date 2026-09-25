"use client";

import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { Modal } from "./dialog";

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: "Navigation" | "Actions" | "Moulds";
  icon: React.ElementType;
  href?: string;
  action?: () => void;
}

const DEFAULT_COMMANDS: CommandItem[] = [
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
    title: "Subplate Master",
    subtitle: "Track 9-stage workpiece operations",
    category: "Navigation",
    icon: Layers,
    href: "/subplate",
  },
  {
    id: "nav-scanning",
    title: "Scanning / Moulds",
    subtitle: "Job creation & stage management",
    category: "Navigation",
    icon: Scan,
    href: "/scanning",
  },
  {
    id: "nav-purchase",
    title: "Purchase Orders",
    subtitle: "Raw material procurement ledger",
    category: "Navigation",
    icon: ShoppingCart,
    href: "/purchase",
  },
  {
    id: "nav-challan",
    title: "Outward Challans",
    subtitle: "Job work plate dispatches",
    category: "Navigation",
    icon: ArrowUpRight,
    href: "/challan",
  },
  {
    id: "nav-dispatch",
    title: "Finished Goods Dispatch",
    subtitle: "Final delivery & logistics",
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
    title: "Customer & Vendor Directory",
    subtitle: "Manage accounts and parties",
    category: "Navigation",
    icon: Users,
    href: "/customer",
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
    category: "Actions",
    icon: Plus,
    href: "/scanning?new=true",
  },
  {
    id: "action-new-po",
    title: "Create Purchase Order",
    subtitle: "Quick create raw material PO",
    category: "Actions",
    icon: Plus,
    href: "/purchase?new=true",
  },
  {
    id: "action-new-challan",
    title: "Generate Outward Challan",
    subtitle: "Send workpiece to job work vendor",
    category: "Actions",
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
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCommands = React.useMemo(() => {
    if (!query.trim()) return DEFAULT_COMMANDS;
    const q = query.toLowerCase();
    return DEFAULT_COMMANDS.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        cmd.subtitle?.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open handled by caller
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

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
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = filteredCommands[selectedIndex];
      if (current) {
        handleSelect(current);
      }
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
      <div className="flex items-center px-4 py-3.5 border-b border-slate-100 gap-3">
        <Search className="w-5 h-5 text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search modules, projects, or commands... (↑↓ to navigate, ↵ to select)"
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400 text-slate-800"
          autoFocus
        />
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 rounded border border-slate-200">
          ESC to close
        </kbd>
      </div>

      {/* Results List */}
      <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-50">
        {filteredCommands.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No matching commands or routes found for &ldquo;{query}&rdquo;
          </div>
        ) : (
          filteredCommands.map((cmd, idx) => {
            const isSelected = idx === selectedIndex;
            const Icon = cmd.icon;
            return (
              <button
                key={cmd.id}
                type="button"
                onClick={() => handleSelect(cmd)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors duration-100 ${
                  isSelected
                    ? "bg-blue-50/80 text-blue-900 border border-blue-100/60"
                    : "text-slate-700 hover:bg-slate-50 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{cmd.title}</p>
                    {cmd.subtitle && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {cmd.subtitle}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    {cmd.category}
                  </span>
                  {isSelected && (
                    <ArrowRight className="w-3.5 h-3.5 text-blue-600 animate-in slide-in-from-left-1 duration-150" />
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer Helper */}
      <div className="px-4 py-2 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-3">
          <span>
            <kbd className="font-semibold text-slate-600">↑↓</kbd> Navigate
          </span>
          <span>
            <kbd className="font-semibold text-slate-600">↵</kbd> Select
          </span>
          <span>
            <kbd className="font-semibold text-slate-600">esc</kbd> Dismiss
          </span>
        </div>
        <span className="flex items-center gap-1 text-[10px] text-slate-400">
          <Command className="w-3 h-3" /> StarMould Quick Jump
        </span>
      </div>
    </Modal>
  );
}
