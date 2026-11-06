"use client";

import type { SubplatePageContext } from "../hooks/use-subplate-page-controller";
import { ERPSelect } from "@/components/ui/erp-select";

type Props = Pick<SubplatePageContext,
  | "dimLabels"
  | "modalForm"
  | "blockInvalidNumberKeys"
  | "handleNumericDimension"
  | "heightDisabled"
  | "handleDimensionChange"
  | "modalUnitOptions"
>;

export function SubplateDimensionFields({
  dimLabels,
  modalForm,
  blockInvalidNumberKeys,
  handleNumericDimension,
  heightDisabled,
  handleDimensionChange,
  modalUnitOptions,
}: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Dimensions & Unit
        </label>
        <span className="text-[10px] text-slate-500 font-medium">
          {dimLabels.headerGuide}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {dimLabels.isRound ? (
          <>
            {/* 1. OD (Outer Diameter) */}
            <div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={dimLabels.widthPlaceholder}
                  value={modalForm.width}
                  onKeyDown={blockInvalidNumberKeys}
                  onChange={(e) =>
                    handleNumericDimension("width", e.target.value)
                  }
                  className="w-full h-10 pl-3 pr-8 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                  OD
                </span>
              </div>
            </div>
            {/* 2. Length */}
            <div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={dimLabels.length}
                  value={modalForm.length}
                  onKeyDown={blockInvalidNumberKeys}
                  onChange={(e) =>
                    handleNumericDimension("length", e.target.value)
                  }
                  className="w-full h-10 pl-3 pr-7 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                  L
                </span>
              </div>
            </div>
            {/* 3. Height (Disabled for Round) */}
            <div>
              <div className="relative">
                <input
                  type="text"
                  disabled
                  placeholder={dimLabels.heightPlaceholder}
                  value=""
                  className="w-full h-10 pl-3 pr-7 rounded-xl text-xs font-mono font-bold transition-all shadow-xs bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                  —
                </span>
              </div>
            </div>
          </>
        ) : dimLabels.isPipe ? (
          <>
            {/* 1. OD (Outer Diameter) */}
            <div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={dimLabels.widthPlaceholder}
                  value={modalForm.width}
                  onKeyDown={blockInvalidNumberKeys}
                  onChange={(e) =>
                    handleNumericDimension("width", e.target.value)
                  }
                  className="w-full h-10 pl-3 pr-8 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                  OD
                </span>
              </div>
            </div>
            {/* 2. Wall Thickness */}
            <div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={dimLabels.heightPlaceholder}
                  value={modalForm.height}
                  onKeyDown={blockInvalidNumberKeys}
                  onChange={(e) =>
                    handleNumericDimension("height", e.target.value)
                  }
                  className="w-full h-10 pl-3 pr-7 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                  T
                </span>
              </div>
            </div>
            {/* 3. Length */}
            <div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={dimLabels.length}
                  value={modalForm.length}
                  onKeyDown={blockInvalidNumberKeys}
                  onChange={(e) =>
                    handleNumericDimension("length", e.target.value)
                  }
                  className="w-full h-10 pl-3 pr-7 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                  L
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* 1. Length */}
            <div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={dimLabels.length}
                  value={modalForm.length}
                  onKeyDown={blockInvalidNumberKeys}
                  onChange={(e) =>
                    handleNumericDimension("length", e.target.value)
                  }
                  className="w-full h-10 pl-3 pr-7 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                  L
                </span>
              </div>
            </div>
            {/* 2. Width */}
            <div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={dimLabels.widthPlaceholder}
                  value={modalForm.width}
                  onKeyDown={blockInvalidNumberKeys}
                  onChange={(e) =>
                    handleNumericDimension("width", e.target.value)
                  }
                  className="w-full h-10 pl-3 pr-7 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-xs"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                  W
                </span>
              </div>
            </div>
            {/* 3. Height / Thickness */}
            <div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={dimLabels.heightPlaceholder}
                  value={modalForm.height}
                  disabled={heightDisabled}
                  onKeyDown={blockInvalidNumberKeys}
                  onChange={(e) =>
                    handleNumericDimension("height", e.target.value)
                  }
                  className={"w-full h-10 pl-3 pr-7 rounded-xl text-xs font-mono font-bold transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 " + (
                    heightDisabled
                      ? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 placeholder:font-normal"
                  )}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                  {heightDisabled ? "—" : "H"}
                </span>
              </div>
            </div>
          </>
        )}
        <div>
          <ERPSelect
            value={modalForm.unit}
            onChange={(val) =>
              handleDimensionChange("unit", String(val))
            }
            options={modalUnitOptions}
            showSearch={false}
            placeholder="Unit"
          />
        </div>
      </div>
    </div>
  );
}
