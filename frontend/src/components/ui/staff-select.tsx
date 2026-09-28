"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, X } from "lucide-react";

export interface StaffUser {
 id: number;
 name: string;
 initials?: string;
 username?: string;
 usertype?: string;
}

interface StaffSelectProps {
 value: number | null | undefined;
 onChange: (userId: number) => void;
 staff: StaffUser[];
 placeholder?: string;
 disabled?: boolean;
 color?: "blue" | "cyan" | "purple" | "teal" | "indigo" | "slate";
 className?: string;
}

export function StaffSelect({
 value,
 onChange,
 staff,
 placeholder = "Select",
 disabled = false,
 color = "blue",
 className = "",
}: StaffSelectProps) {
 const [isOpen, setIsOpen] = useState(false);
 const dropdownRef = useRef<HTMLDivElement>(null);

 const selectedUser = staff.find((u) => u.id === Number(value));

 // Color scheme variants matching StarMould theme
 const colorMap = {
 blue: {
 badge: "bg-blue-50 text-blue-700 border-blue-200 ",
 active: "bg-blue-50 text-blue-700 ",
 ring: "focus:ring-blue-500/30 focus:border-blue-500",
 dot: "bg-blue-500",
 },
 cyan: {
 badge: "bg-cyan-50 text-cyan-700 border-cyan-200 ",
 active: "bg-cyan-50 text-cyan-700 ",
 ring: "focus:ring-cyan-500/30 focus:border-cyan-500",
 dot: "bg-cyan-500",
 },
 purple: {
 badge: "bg-purple-50 text-purple-700 border-purple-200 ",
 active: "bg-purple-50 text-purple-700 ",
 ring: "focus:ring-purple-500/30 focus:border-purple-500",
 dot: "bg-purple-500",
 },
 teal: {
 badge: "bg-teal-50 text-teal-700 border-teal-200 ",
 active: "bg-teal-50 text-teal-700 ",
 ring: "focus:ring-teal-500/30 focus:border-teal-500",
 dot: "bg-teal-500",
 },
 indigo: {
 badge: "bg-indigo-50 text-indigo-700 border-indigo-200 ",
 active: "bg-indigo-50 text-indigo-700 ",
 ring: "focus:ring-indigo-500/30 focus:border-indigo-500",
 dot: "bg-indigo-500",
 },
 slate: {
 badge: "bg-slate-100 text-slate-700 border-slate-200 ",
 active: "bg-slate-100 text-slate-800 ",
 ring: "focus:ring-slate-500/30 focus:border-slate-500",
 dot: "bg-slate-500",
 },
 };

 const scheme = colorMap[color] || colorMap.blue;

 // Close on outside click
 useEffect(() => {
 function handleClickOutside(event: MouseEvent) {
 if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

 // Tooltip content for full name on hover
 const hoverTooltip = selectedUser
 ? `${selectedUser.name} (${selectedUser.initials || selectedUser.name}) ${
 selectedUser.usertype ? `• ${selectedUser.usertype}` : ""
 }`
 : placeholder;

 return (
 <div ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
 {/* Trigger Button */}
 <button
 type="button"
 disabled={disabled}
 onClick={() => setIsOpen((prev) => !prev)}
 title={hoverTooltip}
 className={`group relative inline-flex items-center justify-between gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-all duration-150 ${
 disabled
 ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed "
 : selectedUser
 ? `${scheme.badge} shadow-xs hover:border-slate-300 `
 : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300 "
 } ${scheme.ring} focus:outline-none focus:ring-2`}
 >
 <span className="truncate max-w-[90px] flex items-center gap-1">
 {selectedUser ? (
 <>
 <span className={`w-1.5 h-1.5 rounded-full ${scheme.dot} shrink-0`} />
 <span className="font-mono font-semibold tracking-wide">
 {selectedUser.initials || selectedUser.name}
 </span>
 </>
 ) : (
 <span className="text-slate-400 ">{placeholder}</span>
 )}
 </span>
 <ChevronDown
 className={`w-3 h-3 text-slate-400 transition-transform duration-150 shrink-0 ${
 isOpen ? "rotate-180 text-blue-600 " : "group-hover:text-slate-600"
 }`}
 />
 </button>

 {/* Dropdown Menu */}
 {isOpen && (
 <div className="absolute z-50 mt-1 min-w-[200px] max-w-[280px] bg-white rounded-lg shadow-xl border border-slate-200 py-1 text-xs animate-in fade-in zoom-in-95 duration-100 focus:outline-none left-0">
 {/* Header */}
 <div className="px-2.5 py-1.5 border-b border-slate-100 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
 <span>Assign Staff</span>
 {selectedUser && (
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 onChange(0);
 setIsOpen(false);
 }}
 className="text-rose-500 hover:text-rose-700 flex items-center gap-0.5 text-[10px] normal-case font-medium"
 >
 <X className="w-2.5 h-2.5" /> Clear
 </button>
 )}
 </div>

 {/* Staff List */}
 <div className="max-h-56 overflow-y-auto overflow-x-hidden p-1 space-y-0.5 custom-scrollbar">
 {/* Unassigned / Default Option */}
 <button
 type="button"
 onClick={() => {
 onChange(0);
 setIsOpen(false);
 }}
 className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left transition-colors ${
 !selectedUser
 ? "bg-slate-100 text-slate-800 font-semibold "
 : "text-slate-500 hover:bg-slate-50 "
 }`}
 >
 <span className="text-slate-400 italic">Unassigned</span>
 {!selectedUser && <Check className="w-3.5 h-3.5 text-slate-600 " />}
 </button>

 {staff.map((u) => {
 const isSelected = selectedUser?.id === u.id;
 const titleText = `${u.name} (${u.initials || u.name}) ${
 u.usertype ? `• ${u.usertype}` : ""
 }`;

 return (
 <button
 key={u.id}
 type="button"
 title={titleText}
 onClick={() => {
 onChange(u.id);
 setIsOpen(false);
 }}
 className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors group ${
 isSelected
 ? `${scheme.active} font-semibold`
 : "text-slate-700 hover:bg-slate-50 "
 }`}
 >
 <div className="flex items-center gap-2 min-w-0">
 <span
 className={`inline-flex items-center justify-center font-mono font-bold text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
 isSelected
 ? scheme.badge
 : "bg-slate-100 text-slate-600 border-slate-200 group-hover:bg-white "
 }`}
 >
 {u.initials || u.name.slice(0, 5)}
 </span>
 <div className="truncate min-w-0">
 <div className="truncate font-medium text-slate-800 ">
 {u.name}
 </div>
 {u.usertype && (
 <div className="text-[10px] text-slate-400 truncate">
 {u.usertype}
 </div>
 )}
 </div>
 </div>
 {isSelected && (
 <Check
 className={`w-3.5 h-3.5 shrink-0 ${
 color === "blue"
 ? "text-blue-600 "
 : color === "cyan"
 ? "text-cyan-600 "
 : color === "purple"
 ? "text-purple-600 "
 : color === "teal"
 ? "text-teal-600 "
 : "text-slate-600 "
 }`}
 />
 )}
 </button>
 );
 })}
 </div>
 </div>
 )}
 </div>
 );
}
