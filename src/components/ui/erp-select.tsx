"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";

export interface ERPSelectOption {
  value: string | number;
  label: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: "blue" | "amber" | "green" | "purple" | "slate";
  disabled?: boolean;
  disabledReason?: string;
}

export interface ERPSelectProps {
  value: string | number | undefined | null;
  onChange: (value: any) => void;
  options: ERPSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  triggerClassName?: string;
  icon?: React.ReactNode;
  emptyMessage?: string;
  showSearch?: boolean;
  name?: string;
}

export function ERPSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  disabled = false,
  required = false,
  className = "",
  triggerClassName = "",
  icon,
  emptyMessage = "No options found",
  showSearch,
  name,
}: ERPSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Selected option
  const selectedOption = useMemo(() => {
    if (value === undefined || value === null || value === "") return null;
    return options.find((opt) => String(opt.value) === String(value)) || null;
  }, [options, value]);

  // Determine if search should be enabled
  const isSearchEnabled = showSearch !== undefined ? showSearch : options.length > 5;

  // Filtered options based on search
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter((opt) => {
      const labelMatch = (opt.label || "").toLowerCase().includes(q);
      const subMatch = (opt.subtitle || "").toLowerCase().includes(q);
      const badgeMatch = (opt.badge || "").toLowerCase().includes(q);
      return labelMatch || subMatch || badgeMatch;
    });
  }, [options, searchQuery]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input and check available screen space when dropdown opens
  useEffect(() => {
    if (isOpen) {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        // If less than 240px below and more space above, open upward
        if (spaceBelow < 240 && rect.top > 250) {
          setOpenUpward(true);
        } else {
          setOpenUpward(false);
        }
      }
      if (isSearchEnabled) {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      }
    } else {
      setSearchQuery("");
    }
  }, [isOpen, isSearchEnabled]);

  const handleSelect = useCallback(
    (opt: ERPSelectOption) => {
      if (opt.disabled) return;
      onChange(opt.value);
      setIsOpen(false);
      setSearchQuery("");
    },
    [onChange]
  );

  const getBadgeClasses = (variant?: string) => {
    switch (variant) {
      case "amber":
        return "bg-amber-50 text-amber-700 border-amber-200/80";
      case "green":
        return "bg-emerald-50 text-emerald-700 border-emerald-200/80";
      case "purple":
        return "bg-purple-50 text-purple-700 border-purple-200/80";
      case "slate":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "blue":
      default:
        return "bg-blue-50 text-blue-700 border-blue-200/80";
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${isOpen ? "z-30" : "z-10"} ${className}`}>
      {/* Hidden input for form validation */}
      {required && (
        <input
          type="text"
          name={name}
          className="sr-only"
          value={value !== undefined && value !== null ? String(value) : ""}
          required
          onChange={() => {}}
          tabIndex={-1}
        />
      )}

      {/* Custom Styled Trigger Box */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full min-h-[38px] px-3 py-2 bg-slate-50 border rounded-lg text-xs font-medium text-left flex items-center justify-between gap-2 transition-all shadow-2xs ${
          disabled
            ? "opacity-60 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400"
            : isOpen
            ? "border-blue-600 ring-2 ring-blue-500/20 bg-white"
            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 text-slate-800"
        } ${triggerClassName}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
          {selectedOption ? (
            <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
              <span className="truncate text-slate-800 font-medium">
                {selectedOption.label}
              </span>
              {selectedOption.badge && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border shrink-0 ${getBadgeClasses(
                    selectedOption.badgeVariant
                  )}`}
                >
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 truncate">{placeholder}</span>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-blue-600" : ""
          }`}
        />
      </button>

      {/* Custom Theme Dropdown Popup */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 z-50 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 min-w-full ${
            openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
        >
          {/* Quick Search Header */}
          {isSearchEnabled && (
            <div className="p-2 border-b border-slate-100 bg-slate-50/70">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-4 px-3 text-center text-xs text-slate-400">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <div
                    key={String(opt.value)}
                    onClick={() => handleSelect(opt)}
                    className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                      opt.disabled
                        ? "opacity-50 cursor-not-allowed bg-slate-50/60 text-slate-400"
                        : isSelected
                        ? "bg-blue-50 text-blue-700 font-semibold cursor-pointer"
                        : "hover:bg-slate-100/80 text-slate-700 cursor-pointer"
                    }`}
                  >
                    <div className="flex flex-col min-w-0 flex-1 pr-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{opt.label}</span>
                        {opt.disabledReason && (
                          <span className="text-[10px] text-slate-400 italic shrink-0">
                            ({opt.disabledReason})
                          </span>
                        )}
                      </div>
                      {opt.subtitle && (
                        <span className="text-[10px] text-slate-400 truncate mt-0.5 font-normal">
                          {opt.subtitle}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && (
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border ${getBadgeClasses(
                            opt.badgeVariant
                          )}`}
                        >
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="w-4 h-4 text-blue-600 shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
