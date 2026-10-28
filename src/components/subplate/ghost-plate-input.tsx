"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import { Sparkles } from "lucide-react";
import {
  findContextualPlateGhost,
  findTopContextualPlates,
} from "@/lib/plate-recommender";
import type { GhostSuggestionResult } from "@/lib/mould-autocomplete";

interface GhostPlateInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  existingPlateNames?: string[];
  placeholder?: string;
  required?: boolean;
  className?: string;
  onEnterAdvance?: () => void;
}

export function GhostPlateInput({
  id = "subplate-name-input",
  value,
  onChange,
  existingPlateNames = [],
  placeholder = "e.g. Cavity Plate A-Side, Top Clamping Plate...",
  required = true,
  className = "",
  onEnterAdvance,
}: GhostPlateInputProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const bgInputRef = useRef<HTMLInputElement | null>(null);

  // Guard against mobile scroll gesture firing accidental chip selection
  const isDraggingRef = useRef(false);
  const touchStartPos = useRef({ x: 0, y: 0 });

  // Compute ghost suggestion for desktop inline completion
  const ghost: GhostSuggestionResult | null = useMemo(() => {
    if (isDismissed || !value || value.trimStart().length < 1) return null;
    return findContextualPlateGhost(value, existingPlateNames);
  }, [value, existingPlateNames, isDismissed]);

  // Compute top suggestions for mobile & tablet quick-chips
  const mobileSuggestions = useMemo(() => {
    if (isDismissed || !value || value.trimStart().length < 1) return [];
    return findTopContextualPlates(value, existingPlateNames, 4);
  }, [value, existingPlateNames, isDismissed]);

  // Synchronize horizontal scroll between foreground input and ghost background
  const handleScroll = () => {
    if (inputRef.current && bgInputRef.current) {
      bgInputRef.current.scrollLeft = inputRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    handleScroll();
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsDismissed(false);
    onChange(e.target.value);
  };

  const handleAccept = (customText?: string) => {
    const textToApply = customText || (ghost && ghost.fullSuggestion);
    if (textToApply) {
      onChange(textToApply);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (ghost && ghost.remainingText) {
      const isAtEnd =
        inputRef.current &&
        inputRef.current.selectionStart === inputRef.current.value.length;

      if (e.key === "Tab" || (e.key === "ArrowRight" && isAtEnd)) {
        e.preventDefault();
        handleAccept();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setIsDismissed(true);
        return;
      }
    }

    if (e.key === "Enter") {
      if (onEnterAdvance) {
        e.preventDefault();
        onEnterAdvance();
      }
    }
  };

  // Mobile touch scroll vs tap disambiguation
  const handleChipTouchStart = (e: React.TouchEvent) => {
    isDraggingRef.current = false;
    touchStartPos.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleChipTouchMove = (e: React.TouchEvent) => {
    const dx = Math.abs(e.touches[0].clientX - touchStartPos.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStartPos.current.y);
    if (dx > 6 || dy > 6) {
      isDraggingRef.current = true;
    }
  };

  const handleChipClick = (suggestion: string) => {
    if (isDraggingRef.current) return;
    handleAccept(suggestion);
  };

  const hasGhost = Boolean(ghost && ghost.remainingText);

  const sharedInputStyles =
    "w-full h-10 px-3.5 text-xs font-semibold leading-normal border-0 outline-none focus:outline-none focus:ring-0 box-border bg-transparent";

  return (
    <div className="space-y-1.5 w-full">
      <div
        className={`relative w-full rounded-xl border border-slate-200 bg-slate-50 transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-600 focus-within:bg-white overflow-hidden shadow-2xs ${className}`}
      >
        {/* Background Ghost Input: renders ghost completion in muted slate-400 */}
        <input
          ref={bgInputRef}
          tabIndex={-1}
          aria-hidden="true"
          disabled
          type="text"
          value={hasGhost ? value + ghost!.remainingText : ""}
          className={`absolute inset-0 select-none pointer-events-none text-slate-400 overflow-hidden ${sharedInputStyles}`}
          style={{
            fontFamily: "inherit",
            letterSpacing: "normal",
          }}
        />

        {/* Foreground Real Input: renders user typed text */}
        <input
          ref={inputRef}
          id={id}
          required={required}
          type="text"
          placeholder={hasGhost ? "" : placeholder}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          className={`relative z-10 text-slate-900 placeholder:text-slate-400 ${sharedInputStyles}`}
          style={{
            fontFamily: "inherit",
            letterSpacing: "normal",
          }}
        />

        {/* Desktop-only Tab Badge (hidden on mobile and tablet) */}
        {hasGhost && (
          <div
            aria-hidden="true"
            className="hidden md:inline-flex absolute right-2.5 top-1/2 -translate-y-1/2 z-20 pointer-events-none select-none items-center gap-1 text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-white/95 text-blue-600 border border-blue-200/90 shadow-2xs animate-in fade-in duration-100"
          >
            <span>Tab</span>
            <span className="text-[10px] leading-none">⇥</span>
          </div>
        )}
      </div>

      {/* Mobile & Tablet Predictive Suggestion Chips */}
      {mobileSuggestions.length > 0 && (
        <div
          onTouchStart={handleChipTouchStart}
          onTouchMove={handleChipTouchMove}
          className="flex md:hidden items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5 pb-1 px-0.5 animate-in fade-in duration-150"
        >
          <span className="text-[10px] font-semibold text-slate-400 shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-blue-500" />
            <span className="hidden xs:inline">Suggestions:</span>
          </span>
          {mobileSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              tabIndex={-1}
              onClick={() => handleChipClick(suggestion)}
              className="px-2.5 py-1 text-[11px] font-medium bg-blue-50 text-blue-700 active:bg-blue-200 hover:bg-blue-100 border border-blue-200/80 rounded-lg whitespace-nowrap active:scale-95 transition-all shadow-2xs shrink-0 cursor-pointer"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
