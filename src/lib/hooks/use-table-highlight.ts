"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

export interface TableHighlightOptions {
  pageSize?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  setCurrentPage?: (page: number) => void;
}

export function useTableHighlight<T extends { id: number | string }>(
  items: T[],
  optionsOrPageSize?: number | TableHighlightOptions,
  legacySetCurrentPage?: (page: number) => void
) {
  let pageSize = 25;
  let onPageChange: ((page: number) => void) | undefined = legacySetCurrentPage;

  if (typeof optionsOrPageSize === "number") {
    pageSize = optionsOrPageSize;
  } else if (optionsOrPageSize && typeof optionsOrPageSize === "object") {
    pageSize = optionsOrPageSize.pageSize ?? 25;
    onPageChange = optionsOrPageSize.onPageChange || optionsOrPageSize.setCurrentPage;
  }

  const searchParams = useSearchParams();
  const [highlightedId, setHighlightedId] = useState<string | number | null>(null);
  const scrolledRef = useRef(false);

  const highlightParam = searchParams.get("highlight") || searchParams.get("id");
  const searchQuery = searchParams.get("search") || searchParams.get("q");

  useEffect(() => {
    if (!highlightParam && !searchQuery) return;
    scrolledRef.current = false;
  }, [highlightParam, searchQuery]);

  useEffect(() => {
    if (scrolledRef.current || items.length === 0) return;

    let targetId: number | string | null = null;
    let targetIndex = -1;

    if (highlightParam) {
      targetIndex = items.findIndex(
        (it) => String(it.id) === String(highlightParam)
      );
      if (targetIndex !== -1) {
        targetId = items[targetIndex].id;
      }
    }

    if (targetIndex === -1 && searchQuery) {
      const q = searchQuery.toLowerCase();
      targetIndex = items.findIndex((it: any) => {
        return (
          String(it.id) === q ||
          it.projectid?.toLowerCase().includes(q) ||
          it.platename?.toLowerCase().includes(q) ||
          it.customername?.toLowerCase().includes(q) ||
          (typeof it.cname === "string" && it.cname.toLowerCase().includes(q)) ||
          it.description?.toLowerCase().includes(q) ||
          it.pono?.toLowerCase().includes(q) ||
          it.challanno?.toLowerCase().includes(q) ||
          it.srno?.toLowerCase().includes(q)
        );
      });
      if (targetIndex !== -1) {
        targetId = items[targetIndex].id;
      }
    }

    if (targetIndex !== -1 && targetId !== null) {
      // Switch page if needed
      if (onPageChange && pageSize > 0) {
        const targetPage = Math.floor(targetIndex / pageSize) + 1;
        onPageChange(targetPage);
      }

      scrolledRef.current = true;
      setHighlightedId(targetId);

      // Smooth scroll into view (desktop or mobile)
      setTimeout(() => {
        const el = document.getElementById(`row-${targetId}`) || document.getElementById(`row-mob-${targetId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 150);

      // Remove highlight after 2.8 seconds
      const timer = setTimeout(() => {
        setHighlightedId(null);
      }, 2800);

      return () => clearTimeout(timer);
    }
  }, [items, highlightParam, searchQuery, pageSize, onPageChange]);

  return {
    highlightedId,
    isHighlighted: (id: string | number) => highlightedId !== null && String(highlightedId) === String(id),
    getRowHighlightClass: (id: string | number) =>
      highlightedId !== null && String(highlightedId) === String(id)
        ? "!bg-amber-100/90 !border-amber-400 ring-2 ring-amber-400 ring-inset shadow-md transition-all duration-700 animate-pulse"
        : "",
  };
}
