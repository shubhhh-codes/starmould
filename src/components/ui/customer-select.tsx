"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { ChevronDown, Check, X, Building2, UserPlus, Phone } from "lucide-react";
import type { Customer } from "@/lib/supabase/types";
import { useRolePermissions } from "@/components/providers/permissions-provider";

export interface CustomerSelectProps {
  customers: Customer[];
  value: string | number;
  onChange: (value: string, customer?: Customer) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  onAddNew?: (initialQuery?: string) => void;
  filterUserType?: string | "ALL"; // "Customer" (default), "Vendor", or "ALL"
  id?: string;
  onSelectAdvance?: () => void;
}

export function CustomerSelect({
  customers,
  value,
  onChange,
  placeholder = "Search or pick customer...",
  disabled = false,
  required = false,
  className = "",
  onAddNew,
  filterUserType = "Customer",
  id,
  onSelectAdvance,
}: CustomerSelectProps) {
  const { hasPermission } = useRolePermissions();

  const isVendorType = filterUserType === "Vendor";
  const isAllType = filterUserType === "ALL" || filterUserType === "All";

  // Check action create permissions strictly based on filter user type
  const canCreate = isVendorType
    ? hasPermission("action_create_vendor")
    : isAllType
    ? hasPermission("action_create_customer") || hasPermission("action_create_vendor")
    : hasPermission("action_create_customer");

  // Check directory navigation access
  const canAccessDirectory = isVendorType
    ? hasPermission("nav_vendor_transport")
    : isAllType
    ? hasPermission("nav_customer_creator") || hasPermission("nav_vendor_transport")
    : hasPermission("nav_customer_creator");

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Active list filtered by deleted_at and user type
  const activeCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (c.deleted_at) return false;
      if (!filterUserType || filterUserType === "ALL" || filterUserType === "All") return true;
      return c.usertype === filterUserType;
    });
  }, [customers, filterUserType]);

  // Find currently selected customer/vendor
  const selectedCustomer = useMemo(() => {
    if (!value) return null;
    return activeCustomers.find((c) => String(c.id) === String(value)) || null;
  }, [activeCustomers, value]);

  // Keep display input text synchronized with selected item when not actively querying
  const [isTyping, setIsTyping] = useState(false);
  const displayValue = isTyping ? query : selectedCustomer ? selectedCustomer.customername : "";

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsTyping(false);
        setQuery("");
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Filter customers/vendors by query (name, initials, mobile, email, usertype)
  const filteredCustomers = useMemo(() => {
    if (!query.trim()) return activeCustomers.slice(0, 50);
    const q = query.toLowerCase().trim();
    return activeCustomers.filter((c) => {
      const name = (c.customername || "").toLowerCase();
      const initials = (c.initials || "").toLowerCase();
      const mobile = (c.mobile || "").toLowerCase();
      const usertype = (c.usertype || "").toLowerCase();
      return (
        name.includes(q) ||
        initials.includes(q) ||
        mobile.includes(q) ||
        usertype.includes(q) ||
        String(c.id).includes(q)
      );
    });
  }, [activeCustomers, query]);

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
    (cust: Customer) => {
      onChange(String(cust.id), cust);
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

  // Keyboard navigation & fast Tab flow
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(0);
      } else {
        setActiveIndex((prev) =>
          prev < filteredCustomers.length - 1 ? prev + 1 : 0
        );
      }
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(filteredCustomers.length - 1);
      } else {
        setActiveIndex((prev) =>
          prev > 0 ? prev - 1 : filteredCustomers.length - 1
        );
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && activeIndex >= 0 && activeIndex < filteredCustomers.length) {
        handleSelect(filteredCustomers[activeIndex]);
        if (onSelectAdvance) {
          setTimeout(() => onSelectAdvance(), 20);
        }
      } else if (value && onSelectAdvance) {
        onSelectAdvance();
      }
      return;
    }

    if (e.key === "Tab") {
      if (e.shiftKey) {
        setIsOpen(false);
        setIsTyping(false);
        return;
      }
      // If user typed and an item is highlighted, select it on Tab and let browser advance focus
      if (isOpen) {
        if (query.trim() && activeIndex >= 0 && activeIndex < filteredCustomers.length) {
          handleSelect(filteredCustomers[activeIndex]);
        } else if (query.trim() && filteredCustomers.length === 1) {
          handleSelect(filteredCustomers[0]);
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

  return (
    <div ref={containerRef} className={`relative w-full ${isOpen ? "z-30" : "z-10"} ${className}`}>
      {/* Hidden input for HTML form validation */}
      {required && (
        <input
          type="text"
          className="sr-only"
          value={value ? String(value) : ""}
          required
          onChange={() => {}}
          tabIndex={-1}
        />
      )}

      {/* Single Unified Combobox Input (Directly typeable with Tab continuity) */}
      <div
        className={`w-full min-h-[40px] flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-50 border rounded-xl text-xs transition-all ${
          disabled
            ? "opacity-60 cursor-not-allowed bg-slate-100 border-slate-200"
            : isOpen
            ? "border-blue-600 ring-2 ring-blue-500/20 bg-white"
            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/80"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            id={id}
            type="text"
            disabled={disabled}
            value={displayValue}
            placeholder={placeholder}
            onFocus={() => {
              setIsOpen(true);
              setIsTyping(false);
              setQuery("");
              const selIdx = filteredCustomers.findIndex(
                (c) => String(c.id) === String(value)
              );
              setActiveIndex(selIdx >= 0 ? selIdx : 0);
              inputRef.current?.select();
            }}
            onChange={(e) => {
              setIsTyping(true);
              setQuery(e.target.value);
              setIsOpen(true);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none font-medium truncate"
          />
        </div>

        {/* Selected Badges & Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {selectedCustomer && !isTyping && (
            <div className="flex items-center gap-1">
              {filterUserType === "ALL" && selectedCustomer.usertype && (
                <span
                  className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider ${
                    selectedCustomer.usertype === "Vendor"
                      ? "bg-purple-50 text-purple-700 border border-purple-200"
                      : "bg-blue-50 text-blue-700 border border-blue-200"
                  }`}
                >
                  {selectedCustomer.usertype}
                </span>
              )}
              {selectedCustomer.initials && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold font-mono bg-blue-50 text-blue-700 border border-blue-200/80 rounded">
                  {selectedCustomer.initials}
                </span>
              )}
            </div>
          )}

          {value && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleClear}
              className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-slate-600 transition cursor-pointer"
              title="Clear selection"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              if (disabled) return;
              setIsOpen(!isOpen);
              if (!isOpen) {
                inputRef.current?.focus();
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

      {/* Directly Attached Dropdown List (No redundant secondary search box!) */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* List items */}
          <div
            ref={listRef}
            className="max-h-60 overflow-y-auto divide-y divide-slate-50 p-1"
          >
            {filteredCustomers.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs text-slate-500 font-medium">
                  {query.trim() ? (
                    <>No matches found for &quot;<span className="text-slate-700 font-semibold">{query}</span>&quot;</>
                  ) : (
                    isVendorType ? "No vendors found" : "No customers found"
                  )}
                </p>
                {canCreate && onAddNew ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onAddNew(query.trim());
                    }}
                    className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>
                      {query.trim()
                        ? `${isVendorType ? "Vendor" : "Customer"} doesn't exist? Create "${query.trim()}" now`
                        : `Create ${isVendorType ? "Vendor" : "Customer"} now`}
                    </span>
                  </button>
                ) : canAccessDirectory ? (
                  <a
                    href={isVendorType ? "/vendors" : "/customers"}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold transition"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Manage Directory</span>
                  </a>
                ) : null}
              </div>
            ) : (
              filteredCustomers.map((cust, idx) => {
                const isSelected = String(cust.id) === String(value);
                const isActive = idx === activeIndex;
                const isVendor = cust.usertype === "Vendor";

                return (
                  <div
                    key={cust.id}
                    onClick={() => handleSelect(cust)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg cursor-pointer transition text-xs ${
                      isSelected
                        ? "bg-blue-50 text-blue-900 font-semibold"
                        : isActive
                        ? "bg-slate-100 text-slate-900"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="truncate">{cust.customername}</span>
                        {filterUserType === "ALL" && (
                          isVendor ? (
                            <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                              Vendor
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                              Customer
                            </span>
                          )
                        )}
                        {cust.initials && (
                          <span
                            className={`px-1.5 py-0.2 text-[10px] font-mono font-bold rounded shrink-0 ${
                              isSelected
                                ? "bg-blue-200/80 text-blue-800"
                                : "bg-slate-200/70 text-slate-600"
                            }`}
                          >
                            {cust.initials}
                          </span>
                        )}
                      </div>
                      {cust.mobile && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                          <Phone className="w-2.5 h-2.5 shrink-0" />
                          <span>{cust.mobile}</span>
                        </div>
                      )}
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-blue-600 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Persistent Add Customer action when results are shown (Strictly guarded by permission) */}
          {canCreate && onAddNew && filteredCustomers.length > 0 && (
            <div className="p-1.5 border-t border-slate-100 bg-slate-50/70">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onAddNew(query.trim());
                }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50/80 border border-dashed border-blue-200 hover:border-blue-300 transition cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>
                  {query.trim()
                    ? `${isVendorType ? "Vendor" : "Customer"} doesn't exist? Create "${query.trim()}" now`
                    : `+ Add New ${isVendorType ? "Vendor" : "Customer"}`}
                </span>
              </button>
            </div>
          )}

          {/* Quick footer counter */}
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              {filteredCustomers.length} of {activeCustomers.length} results
            </span>
            <span className="text-[10px] text-slate-400">
              Press <kbd className="px-1 py-0.5 bg-white border rounded text-[9px] font-mono">↑</kbd> <kbd className="px-1 py-0.5 bg-white border rounded text-[9px] font-mono">↓</kbd> then <kbd className="px-1 py-0.5 bg-white border rounded text-[9px] font-mono">Tab</kbd> or <kbd className="px-1 py-0.5 bg-white border rounded text-[9px] font-mono">Enter</kbd>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
