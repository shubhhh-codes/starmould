"use client";

import { ProjectSubplatesRow } from "@/features/moulds/components/project-subplates-row";
import React from "react";
import { flexRender } from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { TableSkeletonRows } from "@/components/ui/skeleton";
import type { MouldTableContext } from "../hooks/use-mould-table-controller";

type Props = Pick<
  MouldTableContext,
  | "table"
  | "showSkeleton"
  | "columns"
  | "expandedRowId"
  | "toggleRowExpand"
  | "handleRowContextMenu"
  | "longPress"
  | "activeStaff"
  | "handleOpenAddPlate"
  | "handleOpenView"
  | "handleOpenEditPlate"
  | "handleDeleteSubplate"
  | "handleSubplateContextMenu"
>;

export function MouldDesktopTable({
  table,
  showSkeleton,
  columns,
  expandedRowId,
  toggleRowExpand,
  handleRowContextMenu,
  longPress,
  activeStaff,
  handleOpenAddPlate,
  handleOpenView,
  handleOpenEditPlate,
  handleDeleteSubplate,
  handleSubplateContextMenu,
}: Props) {
  return (
    <div className="hidden md:block overflow-x-auto w-full">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="bg-slate-50/90 border-b border-slate-200">
              {headerGroup.headers.map((header) => {
                const isSorted = header.column.getIsSorted();
                const canSort = header.column.getCanSort();
                const isSelect = header.id === "select";
                const isActions = header.id === "actions";

                return (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={`py-3.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap transition-colors ${canSort ? "cursor-pointer select-none hover:bg-slate-100/90 hover:text-slate-900 group" : ""
                      } ${isSelect ? "w-10 text-center px-3" : ""} ${isActions ? "text-right pr-4" : ""}`}
                  >
                    <div className={`flex items-center gap-1.5 ${isActions ? "justify-end" : isSelect ? "justify-center" : ""}`}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <span className="inline-flex items-center ml-1">
                          {isSorted === "asc" ? (
                            <ArrowUp className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />
                          ) : isSorted === "desc" ? (
                            <ArrowDown className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-800 transition-colors" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {showSkeleton ? (
            <TableSkeletonRows rows={8} columns={columns.length} />
          ) : table.getRowModel().rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="py-12 text-center text-slate-400 text-xs"
              >
                No moulds or projects match the selected filter.
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => {
              const project = row.original;
              const isExpanded = expandedRowId !== null && String(expandedRowId) === String(project.id);

              return (
                <React.Fragment key={row.id}>
                  <tr
                    onClick={() => toggleRowExpand(project)}
                    onContextMenu={(e) => handleRowContextMenu(e, project)}
                    {...longPress.getHandlers(project)}
                    className={`transition-colors hover:bg-blue-50/40 cursor-pointer select-none ${row.getIsSelected() ? "bg-blue-50/50" : ""
                      } ${isExpanded ? "bg-blue-50/20 font-medium" : ""}`}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const isInteractive = cell.column.id === "select" || cell.column.id === "actions";
                      return (
                        <td
                          key={cell.id}
                          onClick={isInteractive ? undefined : (e) => {
                            e.stopPropagation();
                            toggleRowExpand(project);
                          }}
                          className={`py-2.5 px-3 align-middle text-slate-700 text-xs ${isInteractive ? "" : "cursor-pointer"} ${cell.column.id === "select" ? "text-center" : ""
                            } ${cell.column.id === "actions" ? "text-right pr-4" : ""}`}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Inline Master-Detail Workbench */}
                  {isExpanded && (
                    <ProjectSubplatesRow
                      project={project}
                      columnsCount={columns.length}
                      staff={activeStaff}
                      onAddPlate={handleOpenAddPlate}
                      onOpenView={handleOpenView}
                      onEditPlate={handleOpenEditPlate}
                      onDeletePlate={handleDeleteSubplate}
                      onSubplateContextMenu={handleSubplateContextMenu}
                    />
                  )}
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
