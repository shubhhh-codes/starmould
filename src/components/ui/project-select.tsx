"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, Check, X, Layers, Building2, Loader2 } from "lucide-react";
import type { ScanProject } from "@/lib/supabase/types";

export interface ProjectSelectProps {
  projects: ScanProject[];
  value: string;
  onChange: (value: string, project?: ScanProject) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  isLoading?: boolean;
  onOpen?: () => void;
}

export function ProjectSelect({
  projects,
  value,
  onChange,
  placeholder = "Select or search project...",
  disabled = false,
  required = false,
  className = "",
  isLoading = false,
  onOpen,
}: ProjectSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  // Find currently selected project
  const selectedProject = useMemo(() => {
    if (!value) return null;
    return (
      projects.find(
        (p) => String(p.id) === value || (p.projectid && p.projectid === value)
      ) || null
    );
  }, [projects, value]);

  // Filter projects by query (project code, description, customer name, work type)
  const filteredProjects = useMemo(() => {
    if (!query.trim()) return projects.slice(0, 40); // show top 40 initially for speed
    const q = query.toLowerCase().trim();
    return projects
      .filter((p) => {
        const pCode = (p.projectid || "").toLowerCase();
        const pDesc = (p.description || "").toLowerCase();
        const pCust = (p.customername || p.cname || "").toLowerCase();
        const pWork = (p.worktype || "").toLowerCase();
        return (
          pCode.includes(q) ||
          pDesc.includes(q) ||
          pCust.includes(q) ||
          pWork.includes(q) ||
          String(p.id).includes(q)
        );
      })
      .slice(0, 50);
  }, [projects, query]);

  const handleSelect = (project: ScanProject) => {
    const val = project.id ? String(project.id) : (project.projectid || "");
    onChange(val, project);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Hidden input to support HTML form validation */}
      <input
        type="text"
        tabIndex={-1}
        required={required}
        value={value}
        onChange={() => {}}
        className="opacity-0 absolute pointer-events-none w-0 h-0"
      />

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            const next = !isOpen;
            setIsOpen(next);
            if (next && onOpen) {
              onOpen();
            }
          }
        }}
        className={`w-full min-h-[40px] px-3 py-1.5 rounded-xl border transition-all text-left flex items-center justify-between gap-2 shadow-xs cursor-pointer ${
          isOpen
            ? "border-blue-500 ring-2 ring-blue-500/20 bg-white"
            : "border-slate-200 bg-slate-50/70 hover:bg-slate-50 hover:border-slate-300"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <div className="flex-1 min-w-0">
          {selectedProject ? (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shrink-0">
                {selectedProject.projectid || `#${selectedProject.id}`}
              </span>
              <span className="text-xs font-medium text-slate-800 truncate block">
                {selectedProject.description || "Untitled Mould"}
              </span>
              {(selectedProject.customername || selectedProject.cname) && (
                <span className="hidden sm:inline-block text-[11px] text-slate-400 truncate">
                  • {selectedProject.customername || selectedProject.cname}
                </span>
              )}
            </div>
          ) : isLoading ? (
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5 select-none">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
              Loading mould projects...
            </span>
          ) : (
            <span className="text-xs text-slate-400 font-medium select-none">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {selectedProject && !disabled && (
            <div
              onClick={handleClear}
              role="button"
              tabIndex={0}
              className="p-1 hover:text-slate-600 hover:bg-slate-200/60 rounded-md transition-colors"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </div>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-blue-600" : ""
            }`}
          />
        </div>
      </button>

      {/* Floating Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Search Input Bar */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/60">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search by project code, mould name, customer..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-900 placeholder:text-slate-400 font-medium shadow-2xs"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Project List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 p-1">
            {isLoading && projects.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>Loading mould projects...</span>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                {query ? `No matching projects found for "${query}"` : "No active mould projects available"}
              </div>
            ) : (
              filteredProjects.map((p) => {
                const isSelected =
                  selectedProject &&
                  (selectedProject.id === p.id ||
                    (selectedProject.projectid && selectedProject.projectid === p.projectid));
                const cust = p.customername || p.cname;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelect(p)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-blue-50/80 text-blue-900"
                        : "hover:bg-slate-50 text-slate-800"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-slate-900 truncate">
                          {p.projectid || `#${p.id}`}
                        </span>
                        {p.worktype && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200/80 shrink-0">
                            {p.worktype}
                          </span>
                        )}
                        {isSelected && (
                          <span className="flex items-center gap-1 text-[10px] text-blue-600 font-semibold ml-auto shrink-0">
                            <Check className="w-3 h-3" /> Selected
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-600 font-medium truncate">
                        {p.description || "Untitled Mould"}
                      </div>

                      {cust && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5 truncate">
                          <Building2 className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{cust}</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Quick Footer */}
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
            <span>Showing up to {filteredProjects.length} results</span>
            <span>Press Esc to close</span>
          </div>
        </div>
      )}
    </div>
  );
}
