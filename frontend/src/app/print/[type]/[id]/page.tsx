"use client";

import React, { useEffect, useState, use } from "react";
import { Printer, ArrowLeft, Factory, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface PageProps {
  params: Promise<{
    type: string;
    id: string;
  }>;
}

export default function PrintDocumentPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const { type, id } = resolvedParams;

  const [doc, setDoc] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/print-doc?type=${type}&id=${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Document not found");
        return res.json();
      })
      .then((data) => {
        setDoc(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, [type, id]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="p-6 bg-white rounded-2xl shadow-sm text-center">
          <p className="text-sm font-semibold text-slate-700">Loading document for printing...</p>
        </div>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="p-6 bg-white rounded-2xl shadow-sm text-center space-y-3">
          <p className="text-sm font-semibold text-rose-600">{error || "Failed to load document"}</p>
          <Link href="/" className="inline-block px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 py-6 px-4 print:p-0 print:bg-white text-slate-900">
      {/* Top Action Bar (hidden in print) */}
      <div className="max-w-4xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-500/20 cursor-pointer"
        >
          <Printer className="h-4 w-4" />
          <span>Print Document (A4/A5)</span>
        </button>
      </div>

      {/* Printable Sheet */}
      <div className="max-w-4xl mx-auto bg-white p-8 sm:p-12 rounded-xl shadow-lg border border-slate-300 print:shadow-none print:border-none print:p-0">
        {/* Document Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-900 text-white rounded-xl print:border print:border-slate-900">
              <Factory className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">STAR MOULD</h1>
              <p className="text-xs text-slate-600 font-medium">Precision Tooling & Mould Engineering Works</p>
              <p className="text-[11px] text-slate-500">Plot No. 42, GIDC Industrial Estate, Gujarat, India</p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-bold tracking-wider uppercase rounded-md mb-1.5">
              {doc.docType}
            </span>
            <p className="text-base font-black text-slate-900">{doc.docNumber}</p>
            <p className="text-xs font-semibold text-slate-600">Date: {doc.docDate}</p>
          </div>
        </div>

        {/* Party Details & Metadata */}
        <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-200 mb-6 text-xs print:bg-transparent print:border-slate-300">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Billed / Dispatched To</p>
            <p className="font-bold text-slate-900 text-sm">{doc.party?.customername || "—"}</p>
            <p className="text-slate-600">{doc.party?.address || "Registered Factory Address"}</p>
            {doc.party?.mobile && <p className="text-slate-600">Phone: {doc.party.mobile}</p>}
            {doc.party?.gst && <p className="text-slate-600 font-mono">GSTIN: {doc.party.gst}</p>}
          </div>
          <div className="text-right space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Project & Reference</p>
            <p className="font-bold text-slate-900 font-mono">Project Code: {doc.projectCode || "N/A"}</p>
            {doc.transporter && <p className="text-slate-600">Transporter: {doc.transporter}</p>}
            {doc.vehicleNo && <p className="text-slate-600 font-mono">Vehicle No: {doc.vehicleNo}</p>}
            {doc.invoiceNo && <p className="text-slate-600 font-mono">Invoice No: {doc.invoiceNo}</p>}
            {doc.deliveryType && <p className="text-slate-600">Delivery: {doc.deliveryType}</p>}
            {doc.freightMode && <p className="text-slate-600 font-semibold">Freight: {doc.freightMode}</p>}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="mb-8">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-100 text-slate-900 font-bold uppercase">
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-3">Particulars / Specifications</th>
                {type === "challan" && <th className="py-2.5 px-3">Material</th>}
                {type === "challan" && <th className="py-2.5 px-3">Dimensions</th>}
                {type === "dispatch" && <th className="py-2.5 px-3">Condition</th>}
                {type === "dispatch" && <th className="py-2.5 px-3">Work Nature</th>}
                {type === "inward" && <th className="py-2.5 px-3 text-right">Ordered Qty</th>}
                {type === "inward" && <th className="py-2.5 px-3 text-right">Inward Qty</th>}
                {type !== "inward" && <th className="py-2.5 px-3 text-right w-20">Quantity</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(doc.items || []).map((it: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="py-2 px-3 text-center text-slate-500 font-mono">{it.srNo || idx + 1}</td>
                  <td className="py-2 px-3 font-semibold text-slate-900">{it.particulars}</td>
                  {type === "challan" && <td className="py-2 px-3 text-slate-700">{it.material || "—"}</td>}
                  {type === "challan" && <td className="py-2 px-3 text-slate-700 font-mono">{it.dimensions || "—"}</td>}
                  {type === "dispatch" && <td className="py-2 px-3 font-medium text-blue-700">{it.condition}</td>}
                  {type === "dispatch" && <td className="py-2 px-3 text-slate-700">{it.work}</td>}
                  {type === "inward" && <td className="py-2 px-3 text-right font-medium text-slate-600">{it.orderedQty}</td>}
                  {type === "inward" && <td className="py-2 px-3 text-right font-bold text-slate-900">{it.inwardQty}</td>}
                  {type !== "inward" && <td className="py-2 px-3 text-right font-bold text-slate-900">{it.qty}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Document Footer & Signatures */}
        <div className="pt-12 mt-12 border-t border-slate-300 grid grid-cols-2 gap-8 text-xs">
          <div>
            <p className="font-bold text-slate-900 mb-1">Terms & Conditions:</p>
            <p className="text-slate-500 text-[10px] leading-relaxed">
              1. Goods once sold/dispatched will not be accepted back without prior authorization.<br />
              2. Subject to Gujarat jurisdiction only.
            </p>
          </div>
          <div className="text-right space-y-12">
            <p className="font-bold text-slate-900">For, STAR MOULD</p>
            <p className="font-bold text-slate-800 border-t border-slate-400 inline-block pt-1 px-8">Authorized Signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
}
