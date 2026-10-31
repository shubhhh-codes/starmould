"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { ChevronDown, Check, X, Layers, Building2, Loader2 } from "lucide-react";
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
  id?: string;
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
  id,
}: ProjectSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsTyping(false);
        setQuery("");
        setActiveIndex(-1);
        inputRef.current?.blur();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
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
    if (!query.trim()) return projects.slice(0, 50);
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

  // Auto-scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex]);

  const handleSelect = useCallback(
    (project: ScanProject) => {
      const val = project.id ? String(project.id) : (project.projectid || "");
      onChange(val, project);
      setIsOpen(false);
      setIsTyping(false);
      setQuery("");
      setActiveIndex(-1);
    },
    [onChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange("");
      setQuery("");
      setIsTyping(false);
      setActiveIndex(-1);
      inputRef.current?.focus();
    },
    [onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(0);
        if (onOpen) onOpen();
      } else {
        setActiveIndex((prev) =>
          prev < filteredProjects.length - 1 ? prev + 1 : 0
        );
      }
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(filteredProjects.length - 1);
        if (onOpen) onOpen();
      } else {
        setActiveIndex((prev) =>
          prev > 0 ? prev - 1 : filteredProjects.length - 1
        );
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && activeIndex >= 0 && activeIndex < filteredProjects.length) {
        handleSelect(filteredProjects[activeIndex]);
      } else if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(0);
        if (onOpen) onOpen();
      }
      return;
    }

    if (e.key === "Tab") {
      if (e.shiftKey) {
        setIsOpen(false);
        setIsTyping(false);
        return;
      }
      // If user typed or navigated and dropdown is open, select active or first option and let focus advance naturally
      if (isOpen) {
        if (activeIndex >= 0 && activeIndex < filteredProjects.length) {
          handleSelect(filteredProjects[activeIndex]);
        } else if (filteredProjects.length > 0) {
          handleSelect(filteredProjects[0]);
        }
        setIsOpen(false);
        setIsTyping(false);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setIsTyping(false);
      setQuery("");
      return;
    }
  };

  const displayValue = isTyping
    ? query
    : selectedProject
    ? `${selectedProject.projectid || `#${selectedProject.id}`} - ${selectedProject.description || "Untitled Mould"}`
    : "";

  return (
    <div ref={containerRef} className={`relative w-full ${isOpen ? "z-30" : "z-10"} ${className}`}>
      {/* Hidden input to support HTML form validation */}
      <input
        type="text"
        tabIndex={-1}
        required={required}
        value={value}
        onChange={() => {}}
        className="opacity-0 absolute pointer-events-none w-0 h-0"
      />

      {/* Interactive Combobox Input Box */}
      <div
        onClick={(e) => {
          if (disabled) return;
          if ((e.target as HTMLElement).closest("button")) return;
          if (!isOpen) {
            setIsOpen(true);
            setIsTyping(false);
            setQuery("");
            const selIdx = filteredProjects.findIndex(
              (p) => String(p.id) === value || p.projectid === value
            );
            setActiveIndex(selIdx >= 0 ? selIdx : 0);
            if (onOpen) onOpen();
          }
          inputRef.current?.focus();
          inputRef.current?.select();
        }}
        className={`cursor-pointer w-full min-h-[38px] px-3 py-1.5 rounded-xl border transition-all flex items-center justify-between gap-2 shadow-2xs ${
          disabled
            ? "opacity-60 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400"
            : isOpen
            ? "border-blue-600 ring-2 ring-blue-500/20 bg-white"
            : "border-slate-200 bg-slate-50/70 hover:bg-slate-50 hover:border-slate-300 text-slate-800 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:bg-white"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {isLoading && !selectedProject ? (
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5 select-none">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
              Loading mould projects...
            </span>
          ) : (
            <input
              ref={inputRef}
              id={id}
              type="text"
              disabled={disabled}
              value={displayValue}
              placeholder={placeholder}
              onClick={(e) => {
                e.stopPropagation();
                if (disabled) return;
                if (!isOpen) {
                  setIsOpen(true);
                  setIsTyping(false);
                  setQuery("");
                  const selIdx = filteredProjects.findIndex(
                    (p) => String(p.id) === value || p.projectid === value
                  );
                  setActiveIndex(selIdx >= 0 ? selIdx : 0);
                  if (onOpen) onOpen();
                }
                inputRef.current?.select();
              }}
              onFocus={() => {
                setIsOpen(true);
                setIsTyping(false);
                setQuery("");
                const selIdx = filteredProjects.findIndex(
                  (p) => String(p.id) === value || p.projectid === value
                );
                setActiveIndex(selIdx >= 0 ? selIdx : 0);
                inputRef.current?.select();
                if (onOpen) onOpen();
              }}
              onBlur={(e) => {
                if (containerRef.current && containerRef.current.contains(e.relatedTarget as Node)) {
                  return;
                }
                setIsOpen(false);
                setIsTyping(false);
                setQuery("");
              }}
              onChange={(e) => {
                setIsTyping(true);
                setQuery(e.target.value);
                setIsOpen(true);
                setActiveIndex(0);
                if (onOpen) onOpen();
              }}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none font-medium truncate cursor-pointer"
            />
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {selectedProject && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleClear}
              className="p-1 hover:text-slate-600 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              if (disabled) return;
              const next = !isOpen;
              setIsOpen(next);
              if (next) {
                setIsTyping(false);
                setQuery("");
                const selIdx = filteredProjects.findIndex(
                  (p) => String(p.id) === value || p.projectid === value
                );
                setActiveIndex(selIdx >= 0 ? selIdx : 0);
                inputRef.current?.focus();
                inputRef.current?.select();
                if (onOpen) onOpen();
              } else {
                inputRef.current?.blur();
              }
            }}
            className="p-0.5 text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isOpen ? "rotate-180 text-blue-600" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Floating Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Project List */}
          <div
            ref={listRef}
            className="max-h-60 overflow-y-auto divide-y divide-slate-100 p-1 custom-scrollbar"
          >
            {isLoading && projects.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>Loading mould projects...</span>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                {query.trim() ? (
                  <>
                    No matching projects found for &quot;
                    <span className="text-slate-700 font-semibold">{query}</span>
                    &quot;
                  </>
                ) : (
                  "No active mould projects available"
                )}
              </div>
            ) : (
              filteredProjects.map((p, idx) => {
                const isSelected =
                  selectedProject &&
                  (selectedProject.id === p.id ||
                    (selectedProject.projectid && selectedProject.projectid === p.projectid));
                const isActive = idx === activeIndex;
                const cust = p.customername || p.cname;

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-blue-50/80 text-blue-900"
                        : isActive
                        ? "bg-slate-100 text-slate-900"
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
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Footer */}
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
            <span>Showing up to {filteredProjects.length} results</span>
            <span>Use Arrow keys & Enter/Tab</span>
          </div>
        </div>
      )}
    </div>
  );
}
