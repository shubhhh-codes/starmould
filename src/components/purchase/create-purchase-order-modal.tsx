"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Layers,
  Plus,
  Trash2,
  Scale,
  AlertCircle,
  ShoppingCart,
} from "lucide-react";
import { Modal } from "@/components/ui/dialog";
import { ERPSelect } from "@/components/ui/erp-select";
import { MotionButton } from "@/components/ui/motion-button";
import type { ScanProject, Subplate, Customer, Vendor } from "@/lib/supabase/types";
import {
  useVendorDropdownQuery,
  useCustomerDropdownQuery,
  useProjectsQuery,
  useSubplatesByProjectQuery,
  useCreatePurchaseMutation,
} from "@/lib/query/hooks";
import {
  formatSubplateDimensions,
  calculateSubplateWeight,
} from "@/lib/weight-calculator";
import { appStore } from "@/lib/state/store";

export interface CreatePurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProject?: ScanProject | null;
  onSuccess?: (createdPO?: any) => void;
}

interface PurchaseItemForm {
  plateid: number | "";
  material: string;
  materialtype: string;
  qty: number | "";
  rate: number | "";
}

export function CreatePurchaseOrderModal({
  isOpen,
  onClose,
  initialProject,
  onSuccess,
}: CreatePurchaseOrderModalProps) {
  const router = useRouter();

  // Queries
  const { data: vendorLookup = [] } = useVendorDropdownQuery("Supplier");
  const { data: customerLookup = [] } = useCustomerDropdownQuery("Customer");
  const { data: projectsData } = useProjectsQuery({ pageSize: 500 });
  const createPurchaseMutation = useCreatePurchaseMutation();

  const scans = useMemo<ScanProject[]>(() => {
    return (projectsData?.scans || []) as ScanProject[];
  }, [projectsData?.scans]);

  const vendors = vendorLookup as Vendor[];
  const clients = customerLookup as Customer[];

  // Initialize form state once on mount
  const [formData, setFormData] = useState<{
    odate: string;
    vname: number | "";
    cname: number | "";
    projectid: string;
    items: PurchaseItemForm[];
  }>(() => {
    let defaultCustomer: number | "" = "";
    const defaultMould = initialProject?.projectid || "";

    if (initialProject) {
      if (initialProject.customer_id) {
        defaultCustomer = Number(initialProject.customer_id);
      } else if (initialProject.cname && !isNaN(Number(initialProject.cname))) {
        defaultCustomer = Number(initialProject.cname);
      }
    }

    const platesList = initialProject?.subplates || [];
    const pendingPlates = platesList.filter((sp) => {
      const total = Number(sp.sqty) || 1;
      const ordered = sp.ordered_qty ?? 0;
      return total - ordered > 0;
    });

    const items: PurchaseItemForm[] =
      pendingPlates.length > 0
        ? pendingPlates.map((sp) => {
            const rem = Math.max(0, (Number(sp.sqty) || 1) - (sp.ordered_qty ?? 0));
            const formattedDims = formatSubplateDimensions(sp);
            const dims =
              formattedDims !== "—"
                ? formattedDims
                : [sp.length ?? "", sp.width ?? "", sp.height ?? ""]
                    .filter(Boolean)
                    .join(" x ") + (sp.unit ? ` ${sp.unit}` : " mm");
            return {
              plateid: sp.id,
              material: dims,
              materialtype: sp.material || "",
              qty: rem > 0 ? rem : 1,
              rate: "",
            };
          })
        : [{ plateid: "", material: "", materialtype: "", qty: 1, rate: "" }];

    return {
      odate: new Date().toISOString().slice(0, 10),
      vname: "",
      cname: defaultCustomer,
      projectid: defaultMould,
      items,
    };
  });

  const [formError, setFormError] = useState<string | null>(null);

  // If initial customer ID was numeric string or name, resolve once clients query finishes
  const hasResolvedCustomerRef = useRef(false);
  useEffect(() => {
    if (hasResolvedCustomerRef.current || !initialProject || clients.length === 0) return;
    if (formData.cname) {
      hasResolvedCustomerRef.current = true;
      return;
    }
    const cnameStr = String(
      initialProject.cname || (initialProject as any).customername || ""
    )
      .toLowerCase()
      .trim();
    if (!cnameStr) return;
    const found = clients.find(
      (c) => c.customername?.toLowerCase().trim() === cnameStr
    );
    if (found) {
      hasResolvedCustomerRef.current = true;
      setFormData((prev) => ({ ...prev, cname: found.id }));
    }
  }, [clients, initialProject, formData.cname]);

  // Selected scan for subplate resolution
  const selectedScan = useMemo(() => {
    if (!formData.projectid) return null;
    if (
      initialProject &&
      (initialProject.projectid === formData.projectid ||
        String(initialProject.id) === formData.projectid)
    ) {
      return initialProject;
    }
    return (
      scans.find(
        (s) =>
          s.projectid === formData.projectid ||
          String(s.id) === formData.projectid
      ) || null
    );
  }, [scans, formData.projectid, initialProject]);

  const lookupProjectId = selectedScan ? selectedScan.id : formData.projectid || undefined;
  const { data: dynamicSubplates = [] } = useSubplatesByProjectQuery(lookupProjectId, {
    enabled: Boolean(lookupProjectId),
  });

  // Combine initialProject subplates with dynamic query subplates
  const allSubplates = useMemo<Subplate[]>(() => {
    const map = new Map<number, Subplate>();
    if (initialProject?.subplates && Array.isArray(initialProject.subplates)) {
      initialProject.subplates.forEach((sp) => map.set(sp.id, sp));
    }
    dynamicSubplates.forEach((sp) => map.set(sp.id, sp));
    return Array.from(map.values());
  }, [initialProject?.subplates, dynamicSubplates]);

  // Once dynamic subplates load from API, pre-fill line items if initial items were blank
  const hasPopulatedPlatesRef = useRef(false);
  useEffect(() => {
    if (hasPopulatedPlatesRef.current || dynamicSubplates.length === 0) return;

    if (initialProject?.subplates && initialProject.subplates.length > 0) {
      hasPopulatedPlatesRef.current = true;
      return;
    }

    const pendingPlates = dynamicSubplates.filter((sp) => {
      const rem = sp.remaining_qty ?? (Number(sp.sqty) || 1);
      return rem > 0;
    });

    if (pendingPlates.length > 0) {
      hasPopulatedPlatesRef.current = true;
      setFormData((prev) => {
        if (prev.items.some((it) => it.plateid !== "")) return prev;
        return {
          ...prev,
          items: pendingPlates.map((sp) => {
            const rem = sp.remaining_qty ?? (Number(sp.sqty) || 1);
            const formattedDims = formatSubplateDimensions(sp);
            const dims =
              formattedDims !== "—"
                ? formattedDims
                : [sp.length ?? "", sp.width ?? "", sp.height ?? ""]
                    .filter(Boolean)
                    .join(" x ") + (sp.unit ? ` ${sp.unit}` : " mm");
            return {
              plateid: sp.id,
              material: dims,
              materialtype: sp.material || "",
              qty: rem > 0 ? rem : 1,
              rate: "",
            };
          }),
        };
      });
    }
  }, [dynamicSubplates, initialProject]);

  // Helper to calculate exact remaining quantity
  const getPlateRemainingQty = React.useCallback(
    (plateId: number | string | undefined | null) => {
      if (!plateId) return null;
      const numId = Number(plateId);
      const sp = allSubplates.find((p) => p.id === numId);
      if (!sp) return null;
      const total = Number(sp.sqty) || 1;
      const ordered = sp.ordered_qty ?? 0;
      return Math.max(0, total - ordered);
    },
    [allSubplates]
  );

  // Subplates matching the selected mould in Add modal
  const platesForSelectedProject = useMemo(() => {
    if (!formData.projectid) return [];
    const scanIdStr = selectedScan ? String(selectedScan.id) : "";
    return allSubplates.filter(
      (sp) =>
        (scanIdStr && String(sp.projectid) === scanIdStr) ||
        (selectedScan && sp.mold_id && sp.mold_id === selectedScan.id) ||
        (sp.mold_code && sp.mold_code === formData.projectid) ||
        String(sp.projectid) === formData.projectid ||
        (sp.subprojectid && sp.subprojectid.includes(formData.projectid))
    );
  }, [allSubplates, formData.projectid, selectedScan]);

  // Dropdown options
  const vendorOptions = useMemo(() => {
    return vendors.map((v: any) => ({
      value: v.id,
      label: v.vendor_name || v.customername || `Vendor #${v.id}`,
      badge: v.initials || undefined,
      badgeVariant: "purple" as const,
      subtitle: v.mobile || undefined,
    }));
  }, [vendors]);

  const customerOptions = useMemo(() => {
    return clients.map((c: any) => ({
      value: c.id,
      label: c.customername,
      badge: c.initials || undefined,
      badgeVariant: "blue" as const,
      subtitle: c.city || undefined,
    }));
  }, [clients]);

  const mouldOptions = useMemo(() => {
    const list = [...scans];
    if (initialProject && !list.some((s) => s.projectid === initialProject.projectid)) {
      list.unshift(initialProject);
    }
    if (formData.projectid && !list.some((s) => s.projectid === formData.projectid)) {
      list.push({ projectid: formData.projectid, description: "" } as any);
    }
    return list.map((s: any) => ({
      value: s.projectid || "",
      label: s.projectid || "",
      subtitle: s.description || undefined,
    }));
  }, [scans, initialProject, formData.projectid]);

  const subplateOptions = useMemo(() => {
    return platesForSelectedProject.map((sp) => {
      const remQty = getPlateRemainingQty(sp.id);
      const isFullyOrdered = remQty !== null && remQty <= 0;
      return {
        value: sp.id,
        label: sp.platename,
        badge: remQty !== null ? `Rem: ${remQty} / Req: ${sp.sqty}` : `Qty: ${sp.sqty}`,
        badgeVariant: remQty !== null && remQty > 0 ? ("amber" as const) : ("slate" as const),
        disabled: isFullyOrdered,
        disabledReason: isFullyOrdered ? "Fully Ordered" : undefined,
      };
    });
  }, [platesForSelectedProject, getPlateRemainingQty]);

  // Handlers for Line Items
  const handleAddPlateRow = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { plateid: "", material: "", materialtype: "", qty: 1, rate: "" },
      ],
    }));
  };

  const handleRemovePlateRow = (index: number) => {
    if (formData.items.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleUpdateItem = (
    index: number,
    field: "plateid" | "material" | "materialtype" | "qty" | "rate",
    value: string | number
  ) => {
    setFormData((prev) => {
      const updated = [...prev.items];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, items: updated };
    });
  };

  const handleSelectPlate = (index: number, plateId: number | "") => {
    if (plateId === "") {
      setFormData((prev) => {
        const updated = [...prev.items];
        updated[index] = {
          ...updated[index],
          plateid: "",
          material: "",
          materialtype: "",
          qty: 1,
        };
        return { ...prev, items: updated };
      });
      return;
    }
    const foundPlate = allSubplates.find((sp) => sp.id === Number(plateId));
    const remQty = getPlateRemainingQty(plateId);
    const defaultQty = remQty !== null && remQty > 0 ? remQty : foundPlate?.sqty || 1;

    setFormData((prev) => {
      const updated = [...prev.items];
      if (foundPlate) {
        const formattedDims = formatSubplateDimensions(foundPlate);
        const dims =
          formattedDims !== "—"
            ? formattedDims
            : [foundPlate.length ?? "", foundPlate.width ?? "", foundPlate.height ?? ""]
                .filter(Boolean)
                .join(" x ") + (foundPlate.unit ? ` ${foundPlate.unit}` : " mm");

        updated[index] = {
          ...updated[index],
          plateid: foundPlate.id,
          materialtype: foundPlate.material || "",
          material: dims,
          qty: defaultQty,
        };
      } else {
        updated[index] = {
          ...updated[index],
          plateid: Number(plateId),
          qty: defaultQty,
        };
      }
      return { ...prev, items: updated };
    });
  };

  // Estimated weight
  const modalEstimatedWeightKg = useMemo(() => {
    let total = 0;
    formData.items.forEach((item) => {
      if (!item.plateid) return;
      const sp = allSubplates.find((p) => p.id === Number(item.plateid));
      if (!sp) return;
      total += calculateSubplateWeight({
        shape: sp.shape || "Plate",
        material: item.materialtype || sp.material || "",
        length: sp.length ?? undefined,
        width: sp.width ?? undefined,
        height: sp.height ?? undefined,
        unit: sp.unit || "mm",
        quantity: Number(item.qty) || 1,
      });
    });
    return Math.round(total * 10) / 10;
  }, [formData.items, allSubplates]);

  // Form Submit Handler
  const handleSubmitPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createPurchaseMutation.isPending) return;

    if (!formData.vname) {
      setFormError("Please select a supplier/vendor.");
      return;
    }
    if (!formData.cname) {
      setFormError("Please select a customer.");
      return;
    }
    if (!formData.projectid) {
      setFormError("Please select a mould project.");
      return;
    }
    if (formData.items.some((it) => !it.plateid || Number(it.qty) <= 0)) {
      setFormError("All line items must have a selected plate and quantity greater than 0.");
      return;
    }

    try {
      const result = await createPurchaseMutation.mutateAsync({
        odate: formData.odate,
        vname: Number(formData.vname),
        cname: Number(formData.cname),
        projectid: formData.projectid,
        items: formData.items,
      });

      appStore.addToast({
        type: "success",
        message: `Purchase Order created successfully for ${formData.projectid}`,
      });

      onClose();
      onSuccess?.(result);

      // Seamless redirect: After successful submission, route user directly to Purchase Management
      router.push(`/purchase?tab=orders`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error creating purchase order";
      setFormError(msg);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Raw Material Purchase Order"
      description="Generate a new raw material purchase order with vendor details and line items"
      size="3xl"
      className="sm:max-w-[760px] w-full"
    >
      <form onSubmit={handleSubmitPO} className="space-y-5 text-xs">
        {formError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Header Fields (2x2 Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          {/* Order Date */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Order Date <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                required
                value={formData.odate}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    odate: e.target.value,
                  }))
                }
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Supplier Name */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Supplier Name (vname) <span className="text-rose-500">*</span>
            </label>
            <ERPSelect
              required
              value={formData.vname}
              onChange={(val) =>
                setFormData((p) => ({
                  ...p,
                  vname: val ? Number(val) : "",
                }))
              }
              options={vendorOptions}
              placeholder="Select Supplier / Vendor"
              searchPlaceholder="Search supplier or initials..."
            />
          </div>

          {/* Customer Name */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Customer Name (cname) <span className="text-rose-500">*</span>
            </label>
            <ERPSelect
              required
              value={formData.cname}
              onChange={(val) => {
                const newCid = val ? Number(val) : "";
                setFormData((p) => ({
                  ...p,
                  cname: newCid,
                }));
              }}
              options={customerOptions}
              placeholder="Select Customer"
              searchPlaceholder="Search customer..."
            />
          </div>

          {/* Mould Name (projectid) */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Mould Name (projectid) <span className="text-rose-500">*</span>
            </label>
            <ERPSelect
              required
              value={formData.projectid}
              onChange={(val) => {
                const newProj = String(val || "");
                setFormData((p) => {
                  if (p.projectid === newProj) return p;
                  return {
                    ...p,
                    projectid: newProj,
                    items: p.items.map((it) => ({
                      ...it,
                      plateid: "",
                    })),
                  };
                });
              }}
              options={mouldOptions}
              placeholder="Select Mould Project"
              searchPlaceholder="Search mould project ID..."
            />
          </div>
        </div>

        {/* Dynamic Line Items Section */}
        <div className="pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <label className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>PO Subplate Line Items</span>
              <span className="text-slate-400 font-normal">
                ({formData.items.length} {formData.items.length === 1 ? "line" : "lines"})
              </span>
            </label>
            <div className="flex items-center gap-2">
              {modalEstimatedWeightKg > 0 && (
                <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-mono font-semibold flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-emerald-600" />
                  Est. Total: ~{modalEstimatedWeightKg.toLocaleString()} kg
                </span>
              )}
              <button
                type="button"
                onClick={handleAddPlateRow}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Plate Line</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {formData.items.map((item, idx) => {
              const rowSubplateOptions = subplateOptions.map((opt) => {
                const isSelectedInOtherRow = formData.items.some(
                  (it, i) => i !== idx && Number(it.plateid) === Number(opt.value)
                );
                return {
                  ...opt,
                  disabled: opt.disabled || isSelectedInOtherRow,
                  disabledReason: isSelectedInOtherRow ? "Already added" : opt.disabledReason,
                };
              });

              if (
                item.plateid &&
                !rowSubplateOptions.some((opt) => Number(opt.value) === Number(item.plateid))
              ) {
                const foundSp = allSubplates.find((sp) => sp.id === Number(item.plateid));
                if (foundSp) {
                  rowSubplateOptions.unshift({
                    value: foundSp.id,
                    label: foundSp.platename,
                    badge: `Qty: ${foundSp.sqty}`,
                    badgeVariant: "amber" as const,
                    disabled: false,
                    disabledReason: undefined,
                  });
                }
              }

              const itemPlateRemQty = item.plateid ? getPlateRemainingQty(item.plateid) : null;
              const otherLinesQty = formData.items
                .filter((it, i) => i !== idx && it.plateid && Number(it.plateid) === Number(item.plateid))
                .reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
              const maxAllowedQty =
                itemPlateRemQty !== null ? Math.max(0, itemPlateRemQty - otherLinesQty) : null;
              const isExceeding = maxAllowedQty !== null && Number(item.qty) > maxAllowedQty;

              return (
                <div
                  key={idx}
                  className="p-3 sm:p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 relative shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                        #{String(idx + 1).padStart(2, "0")}
                      </span>
                      <span className="text-[11px] text-slate-400 hidden sm:inline">
                        Line Item
                      </span>
                    </div>
                    {formData.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePlateRow(idx)}
                        className="inline-flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-md transition cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline font-medium">Remove</span>
                      </button>
                    )}
                  </div>

                  {/* Row 1: Subplate Selector & Material Type */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3 items-start">
                    <div className="sm:col-span-7">
                      <label className="block text-[11px] text-slate-600 mb-1 font-medium">
                        Subplate <span className="text-rose-500">*</span>
                      </label>
                      <ERPSelect
                        required
                        value={item.plateid}
                        onChange={(val) =>
                          handleSelectPlate(idx, val ? Number(val) : "")
                        }
                        options={rowSubplateOptions}
                        placeholder={
                          !formData.projectid
                            ? "Select Mould first"
                            : platesForSelectedProject.length === 0
                            ? "No plates found for this mould"
                            : "Select Subplate"
                        }
                        searchPlaceholder="Search subplate..."
                        disabled={
                          !formData.projectid || platesForSelectedProject.length === 0
                        }
                      />
                    </div>

                    <div className="sm:col-span-5">
                      <label className="block text-[11px] text-slate-600 mb-1 font-medium truncate">
                        Material Type <span className="text-[10px] text-slate-400 font-normal">(Readonly)</span>
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={item.materialtype}
                        placeholder="Auto from plate"
                        className="w-full h-9 px-2.5 bg-slate-100/90 border border-slate-200 rounded-lg text-slate-700 text-xs cursor-not-allowed font-medium select-none truncate"
                      />
                    </div>
                  </div>

                  {/* Row 2: Dimensions, Rem Qty, Order Qty, Rate */}
                  <div className="grid grid-cols-12 gap-2.5 sm:gap-3 items-start">
                    <div className="col-span-12 sm:col-span-6">
                      <label className="block text-[11px] text-slate-600 mb-1 font-medium truncate">
                        Req. Material / Dims
                      </label>
                      <input
                        type="text"
                        value={item.material}
                        onChange={(e) => handleUpdateItem(idx, "material", e.target.value)}
                        placeholder="e.g. 955 x 955 x 65 mm"
                        className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs text-slate-800"
                      />
                    </div>

                    <div className="col-span-4 sm:col-span-2">
                      <label className="block text-[11px] text-slate-600 mb-1 font-medium text-center truncate">
                        Rem. Qty
                      </label>
                      <input
                        type="text"
                        disabled
                        value={
                          item.plateid
                            ? getPlateRemainingQty(item.plateid) ?? "—"
                            : "—"
                        }
                        className="w-full h-9 px-2 bg-slate-100/90 border border-slate-200 rounded-lg text-slate-700 text-xs cursor-not-allowed font-mono font-bold text-center select-none"
                      />
                    </div>

                    <div className="col-span-4 sm:col-span-2">
                      <label className="block text-[11px] text-slate-600 mb-1 font-medium text-center truncate">
                        Order Qty <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={maxAllowedQty !== null && maxAllowedQty > 0 ? maxAllowedQty : undefined}
                        required
                        value={item.qty}
                        onWheel={(e) => {
                          const currentQty = Number(item.qty) || 1;
                          const maxLimit = maxAllowedQty !== null && maxAllowedQty > 0 ? maxAllowedQty : 99999;
                          if (e.deltaY < 0 && currentQty < maxLimit) {
                            handleUpdateItem(idx, "qty", currentQty + 1);
                          } else if (e.deltaY > 0 && currentQty > 1) {
                            handleUpdateItem(idx, "qty", currentQty - 1);
                          }
                        }}
                        onInput={(e) => {
                          const target = e.currentTarget;
                          const val = Number(target.value);
                          if (maxAllowedQty !== null && maxAllowedQty > 0 && val > maxAllowedQty) {
                            target.value = String(maxAllowedQty);
                            handleUpdateItem(idx, "qty", maxAllowedQty);
                          }
                        }}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === "") {
                            handleUpdateItem(idx, "qty", "");
                            return;
                          }
                          const val = Number(raw);
                          if (isNaN(val)) return;
                          if (maxAllowedQty !== null && maxAllowedQty > 0 && val > maxAllowedQty) {
                            handleUpdateItem(idx, "qty", maxAllowedQty);
                            return;
                          }
                          handleUpdateItem(idx, "qty", Math.max(1, val));
                        }}
                        className={`w-full h-9 px-2 bg-white border rounded-lg focus:outline-none focus:ring-2 text-xs text-center font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition ${
                          isExceeding
                            ? "border-rose-400 bg-rose-50/40 text-rose-700 ring-1 ring-rose-400 focus:ring-rose-500/20 focus:border-rose-500"
                            : "border-slate-200 text-slate-800 focus:ring-blue-500/20 focus:border-blue-500"
                        }`}
                      />
                    </div>

                    <div className="col-span-4 sm:col-span-2">
                      <label className="block text-[11px] text-slate-600 mb-1 font-medium text-right truncate">
                        Rate (₹) <span className="text-[10px] text-slate-400 font-normal">(Opt)</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={item.rate !== undefined && item.rate !== null ? item.rate : ""}
                        onChange={(e) =>
                          handleUpdateItem(
                            idx,
                            "rate",
                            e.target.value === "" ? "" : Number(e.target.value)
                          )
                        }
                        placeholder=""
                        className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs text-right font-medium text-slate-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition cursor-pointer"
          >
            Cancel
          </button>
          <MotionButton
            type="submit"
            loading={createPurchaseMutation.isPending}
            variant="primary"
            size="sm"
          >
            Submit Purchase Order
          </MotionButton>
        </div>
      </form>
    </Modal>
  );
}
