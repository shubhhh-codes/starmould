"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import { Sparkles } from "lucide-react";
import {
  findGhostSuggestion,
  findTopSuggestions,
  GhostSuggestionResult,
} from "@/lib/mould-autocomplete";

interface GhostDescriptionInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  worktype?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  className?: string;
  onEnterAdvance?: () => void;
  liveDescriptions?: string[];
}

export function GhostDescriptionInput({
  id = "part-description-input",
  value,
  onChange,
  worktype = "Pulp Mould",
  placeholder = "e.g. 8 Cavity Cap Mould Top Core Plate, 120 GSM pulp packaging...",
  required = true,
  rows = 2,
  className = "",
  onEnterAdvance,
  liveDescriptions = [],
}: GhostDescriptionInputProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bgTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Guard against scroll gesture firing click/touch selection
  const isDraggingRef = useRef(false);
  const touchStartPos = useRef({ x: 0, y: 0 });

  // Compute ghost suggestion for desktop inline completion
  const ghost: GhostSuggestionResult | null = useMemo(() => {
    if (isDismissed || !value || value.trimStart().length < 2) return null;
    return findGhostSuggestion(value, worktype, liveDescriptions);
  }, [value, worktype, isDismissed, liveDescriptions]);

  // Compute top suggestions for mobile & tablet quick-chips (iOS QuickType / Android predictive style)
  const mobileSuggestions = useMemo(() => {
    if (isDismissed || !value || value.trimStart().length < 2) return [];
    return findTopSuggestions(value, worktype, liveDescriptions, 5);
  }, [value, worktype, isDismissed, liveDescriptions]);

  // Sync scroll position between foreground and background textarea
  const handleScroll = () => {
    if (textareaRef.current && bgTextareaRef.current) {
      bgTextareaRef.current.scrollTop = textareaRef.current.scrollTop;
      bgTextareaRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    handleScroll();
  }, [value]);

  // Reset dismissal whenever user types
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setIsDismissed(false);
    onChange(e.target.value);
  };

  const handleAccept = (customText?: string) => {
    const textToApply = customText || (ghost && ghost.fullSuggestion);
    if (textToApply) {
      onChange(textToApply);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 1. Accept Ghost Text on Tab or ArrowRight (at end of text)
    if (ghost && ghost.remainingText) {
      const isAtEnd =
        textareaRef.current &&
        textareaRef.current.selectionStart === textareaRef.current.value.length;

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

    // 2. Advance on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      if (onEnterAdvance) {
        e.preventDefault();
        onEnterAdvance();
      }
    }
  };

  // Touch scroll vs tap disambiguation
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
    // If finger moves more than 6px, it's an intentional scroll gesture, NOT a tap
    if (dx > 6 || dy > 6) {
      isDraggingRef.current = true;
    }
  };

  const handleChipClick = (suggestion: string) => {
    if (isDraggingRef.current) {
      // Swipe/scroll was in progress, ignore accidental tap
      return;
    }
    handleAccept(suggestion);
  };

  const hasGhost = Boolean(ghost && ghost.remainingText);

  // Exact shared typography & geometry classes (borderless inside container to eliminate double border)
  const sharedTextareaStyles =
    "w-full px-3 py-2 text-xs font-normal font-sans rounded-xl resize-none leading-normal border-0 outline-none focus:outline-none focus:ring-0 box-border bg-transparent";

  return (
    <div className="space-y-1.5 w-full">
      <div
        className={`relative w-full rounded-xl border border-slate-200 bg-slate-50 transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-600 focus-within:bg-white overflow-hidden shadow-2xs ${className}`}
      >
        {/* Background Ghost Textarea: renders suggestion text in muted slate-400 */}
        <textarea
          ref={bgTextareaRef}
          tabIndex={-1}
          aria-hidden="true"
          disabled
          rows={rows}
          value={hasGhost ? value + ghost!.remainingText : ""}
          className={`absolute inset-0 select-none pointer-events-none text-slate-400 overflow-hidden ${sharedTextareaStyles}`}
          style={{
            fontFamily: "inherit",
            letterSpacing: "normal",
          }}
        />

        {/* Foreground Real Interactive Textarea: renders user typed text in dark slate-800 */}
        <textarea
          ref={textareaRef}
          id={id}
          required={required}
          rows={rows}
          placeholder={hasGhost ? "" : placeholder}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          className={`relative z-10 text-slate-800 placeholder:text-slate-400 ${sharedTextareaStyles}`}
          style={{
            fontFamily: "inherit",
            letterSpacing: "normal",
          }}
        />

        {/* Desktop-only Tab Badge (hidden on mobile and tablet) */}
        {hasGhost && (
          <div
            aria-hidden="true"
            className="hidden md:inline-flex absolute right-2.5 bottom-2 z-20 pointer-events-none select-none items-center gap-1 text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-white/95 text-blue-600 border border-blue-200/90 shadow-2xs animate-in fade-in duration-100"
          >
            <span>Tab</span>
            <span className="text-[10px] leading-none">⇥</span>
          </div>
        )}
      </div>

      {/* Mobile & Tablet Predictive Suggestion Chips (like iOS QuickType / Android predictive keyboard) */}
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
