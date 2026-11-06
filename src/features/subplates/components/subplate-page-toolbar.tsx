"use client";

import type { SubplatePageContext } from "../hooks/use-subplate-page-controller";
import { Search, X } from "lucide-react";
import { ERPSelect } from "@/components/ui/erp-select";

type Props = Pick<SubplatePageContext,
  | "searchQuery"
  | "setSearchQuery"
  | "setCurrentPage"
  | "materialFilter"
  | "setMaterialFilter"
  | "materialFilterOptions"
  | "categoryFilter"
  | "setCategoryFilter"
  | "categoryFilterOptions"
  | "locationFilter"
  | "setLocationFilter"
  | "locationFilterOptions"
  | "projectFilter"
  | "setProjectFilter"
  | "projectFilterOptions"
  | "stageFilter"
  | "setStageFilter"
  | "stageFilterOptions"
  | "mouldGroups"
  | "filteredSubplates"
  | "handleToggleAllMoulds"
>;

export function SubplatePageToolbar({
  searchQuery,
  setSearchQuery,
  setCurrentPage,
  materialFilter,
  setMaterialFilter,
  materialFilterOptions,
  categoryFilter,
  setCategoryFilter,
  categoryFilterOptions,
  locationFilter,
  setLocationFilter,
  locationFilterOptions,
  projectFilter,
  setProjectFilter,
  projectFilterOptions,
  stageFilter,
  setStageFilter,
  stageFilterOptions,
  mouldGroups,
  filteredSubplates,
  handleToggleAllMoulds,
}: Props) {
  return (
    <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3 w-full max-w-full min-w-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-2.5 w-full min-w-0">
        {/* Universal Search Input */}
        <div className="relative w-full sm:col-span-2 lg:col-span-1 lg:w-auto lg:min-w-[320px] min-w-0">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Universal Search (mould, plate, customer, specs, staff)..."
            data-shortcut-search="true"
            autoComplete="off"
            data-form-type="other"
            data-lpignore="true"
            suppressHydrationWarning
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setCurrentPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Material Selector */}
        <div className="w-full lg:w-44 min-w-0">
          <ERPSelect
            value={materialFilter}
            onChange={(val) => {
              setMaterialFilter(String(val));
              setCurrentPage(1);
            }}
            options={materialFilterOptions}
            placeholder="All Materials"
            searchPlaceholder="Search materials..."
          />
        </div>

        {/* Category Selector */}
        <div className="w-full lg:w-48 min-w-0">
          <ERPSelect
            value={categoryFilter}
            onChange={(val) => {
              setCategoryFilter(String(val));
              setCurrentPage(1);
            }}
            options={categoryFilterOptions}
            placeholder="All Categories"
            showSearch={false}
          />
        </div>

        {/* Location Selector */}
        <div className="w-full lg:w-40 min-w-0">
          <ERPSelect
            value={locationFilter}
            onChange={(val) => {
              setLocationFilter(String(val));
              setCurrentPage(1);
            }}
            options={locationFilterOptions}
            placeholder="All Locations"
            showSearch={false}
          />
        </div>

        {/* Project Selector */}
        <div className="w-full lg:w-56 min-w-0">
          <ERPSelect
            value={projectFilter}
            onChange={(val) => {
              setProjectFilter(String(val));
              setCurrentPage(1);
            }}
            options={projectFilterOptions}
            placeholder="All Projects"
            searchPlaceholder="Search projects..."
          />
        </div>

        {/* 9-Stage Production Filter */}
        <div className="w-full lg:w-52 min-w-0">
          <ERPSelect
            value={stageFilter}
            onChange={(val) => {
              setStageFilter(String(val));
              setCurrentPage(1);
            }}
            options={stageFilterOptions}
            placeholder="All Stages"
            showSearch={false}
          />
        </div>
      </div>

      {/* Toolbar Sub-Bar: Counts and Expand/Collapse Controls */}
      <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-slate-100 flex-wrap text-xs">
        <div className="flex items-center gap-2 text-slate-500">
          <span className="font-bold text-slate-800">
            {mouldGroups.length} {mouldGroups.length === 1 ? "Mould Project" : "Mould Projects"}
          </span>
          <span className="text-slate-300">•</span>
          <span className="font-medium text-slate-600">
            {filteredSubplates.length} {filteredSubplates.length === 1 ? "Subplate" : "Subplates"} Total
          </span>
          {searchQuery && (
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold text-[11px] border border-blue-200">
              Search: &quot;{searchQuery}&quot;
            </span>
          )}
          {(materialFilter !== "ALL" || locationFilter !== "ALL" || projectFilter !== "ALL" || stageFilter !== "ALL" || categoryFilter !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setMaterialFilter("ALL");
                setLocationFilter("ALL");
                setProjectFilter("ALL");
                setStageFilter("ALL");
                setCategoryFilter("ALL");
                setCurrentPage(1);
              }}
              className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer ml-1"
            >
              Clear all filters
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleToggleAllMoulds(true)}
            className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 rounded-lg transition border border-slate-200 cursor-pointer"
            title="Expand all mould cards"
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={() => handleToggleAllMoulds(false)}
            className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition border border-slate-200 cursor-pointer"
            title="Collapse all mould cards"
          >
            Collapse All
          </button>
        </div>
      </div>
    </div>
  );
}
