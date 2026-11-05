"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type PointerEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { animate, motion, useDragControls, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { overlayStack } from "@/lib/overlay-stack";

const DISCLOSE = { type: "spring", stiffness: 150, damping: 27, mass: 1 } as const;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const focusable = (panel: HTMLElement) => Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
  .filter((element) => element.tabIndex >= 0 && !element.matches(":disabled") && !element.closest('[inert], [hidden], [aria-hidden="true"]') && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");

export type DrawerSide = "left" | "right";
export type UseDrawerOptions = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: DrawerSide;
  width?: number;
  dismissRatio?: number;
  modal?: boolean;
};

export function useDrawer({ open: controlled, defaultOpen = false, onOpenChange, side = "right", width = 320, dismissRatio = 0.38, modal = true }: UseDrawerOptions = {}) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = controlled ?? uncontrolled;
  const isControlled = controlled !== undefined;
  const [present, setPresent] = useState(open);
  const [dragging, setDragging] = useState(false);
  const [measuredWidth, setMeasuredWidth] = useState(Math.max(1, width));
  const sign = side === "right" ? 1 : -1;
  const away = sign * (measuredWidth + 24);
  const x = useMotionValue(away);
  const veil = useTransform(x, (value) => 1 - Math.min(1, Math.abs(value) / measuredWidth));
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const live = useRef(open);
  const changed = useRef(onOpenChange);
  const drawerId = useId();
  const reduced = useReducedMotion();
  const controls = useDragControls();
  const animation = useRef<ReturnType<typeof animate> | null>(null);

  useEffect(() => { live.current = open; changed.current = onOpenChange; });
  const setOpen = useCallback((next: boolean) => {
    if (!isControlled) setUncontrolled(next);
    changed.current?.(next);
  }, [isControlled]);
  const close = useCallback(() => setOpen(false), [setOpen]);
  const glide = useCallback((to: number) => {
    animation.current?.stop();
    const next = animate(x, to, reduced ? { duration: 0 } : DISCLOSE);
    animation.current = next;
    return next;
  }, [x, reduced]);

  useEffect(() => {
    if (open && !present) { setPresent(true); return; }
    if (!present) return;
    let cancelled = false;
    const next = glide(open ? 0 : away);
    void next.then(() => { if (!cancelled && !open) setPresent(false); });
    return () => { cancelled = true; next.stop(); };
  }, [open, present, away, glide]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !present) return;
    const measure = () => setMeasuredWidth(Math.max(1, panel.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [present, width]);

  useEffect(() => {
    if (panelRef.current) panelRef.current.inert = !open;
    if (!open) setDragging(false);
  }, [open, present]);

  useEffect(() => {
    const panel = panelRef.current;
    const root = rootRef.current;
    if (!present || !panel || !root || !modal) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overlayStack.push(drawerId, () => { if (live.current) close(); return false; }, trigger, root);
    const first = panel.querySelector<HTMLElement>("[data-autofocus]") || focusable(panel)[0];
    (first || panel).focus({ preventScroll: true });
    const trapTab = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Tab" || !overlayStack.isTopmost(drawerId)) return;
      const nodes = focusable(panel);
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (!first) { event.preventDefault(); panel.focus(); return; }
      if (!panel.contains(active) || (event.shiftKey && (active === first || active === panel))) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault(); first.focus();
      }
    };
    window.addEventListener("keydown", trapTab, true);
    return () => { window.removeEventListener("keydown", trapTab, true); overlayStack.pop(drawerId); };
  }, [present, modal, drawerId, close]);

  const requestClose = useCallback(() => {
    if (live.current && (!modal || overlayStack.isTopmost(drawerId))) close();
  }, [modal, drawerId, close]);
  const startDrag = useCallback((event: PointerEvent) => {
    const target = event.target;
    if (!live.current || (target instanceof Element && target.closest('button,a,input,select,textarea,[role="button"]'))) return;
    if (modal && !overlayStack.isTopmost(drawerId)) return;
    controls.start(event);
  }, [controls, modal, drawerId]);
  const onDragEnd = useCallback((_event: MouseEvent | TouchEvent | globalThis.PointerEvent, info: { offset: { x: number }; velocity: { x: number } }) => {
    setDragging(false);
    if (sign * info.offset.x > measuredWidth * dismissRatio || sign * info.velocity.x > 520) requestClose();
    else glide(0);
  }, [sign, measuredWidth, dismissRatio, requestClose, glide]);
  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (!modal && event.key === "Escape") { event.stopPropagation(); requestClose(); }
  }, [modal, requestClose]);

  return {
    open, present, side, width, dragging, x, veil, setOpen, close: requestClose, rootRef, panelRef,
    panelProps: {
      tabIndex: -1, role: "dialog" as const, "aria-modal": modal || undefined, onKeyDown,
      drag: "x" as const, dragControls: controls, dragListener: false, dragMomentum: false,
      dragConstraints: { left: 0, right: 0 },
      dragElastic: side === "right" ? { top: 0, bottom: 0, left: 0, right: 1 } : { top: 0, bottom: 0, left: 1, right: 0 },
      onDragStart: () => setDragging(true), onDragEnd,
    },
    gripProps: { onPointerDown: startDrag },
  };
}

export type UseDrawerResult = ReturnType<typeof useDrawer>;
export type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  side?: DrawerSide;
  width?: number;
  container?: "viewport" | "parent";
  closeLabel?: string;
  dismissOnScrimClick?: boolean;
  className?: string;
  bodyClassName?: string;
  showCloseButton?: boolean;
  headerActions?: ReactNode;
  beforeBody?: ReactNode;
  onCloseComplete?: () => void;
};

function DrawerSurface({ open, onOpenChange, title, children, description, footer, side = "right", width = 320, container = "viewport", closeLabel = "Close panel", dismissOnScrimClick = true, className = "", bodyClassName = "", showCloseButton = true, headerActions, beforeBody, onCloseComplete }: DrawerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const hintId = useId();
  const { present, rootRef, panelRef, veil, x, dragging, close, panelProps, gripProps } = useDrawer({ open, onOpenChange, side, width, modal: container === "viewport" });
  const wasPresent = useRef(false);
  useEffect(() => {
    if (present) wasPresent.current = true;
    else if (wasPresent.current) { wasPresent.current = false; onCloseComplete?.(); }
  }, [present, onCloseComplete]);
  if (!present) return null;
  return (
    <div ref={rootRef} data-overlay-root data-drawer-root className={`${container === "viewport" ? "fixed" : "absolute"} inset-0 z-[9999] overflow-hidden`}>
      <motion.div aria-hidden="true" data-drawer-scrim style={{ opacity: veil }} onClick={dismissOnScrimClick ? close : undefined} className="absolute inset-0 bg-stone-900/20 backdrop-blur-[4px] backdrop-saturate-[1.1] dark:bg-black/40" />
      <motion.div
        ref={panelRef} aria-labelledby={titleId} aria-describedby={`${description ? descriptionId + " " : ""}${hintId}`} aria-hidden={!open || undefined}
        style={{ x: x, width: Math.max(1, width), maxWidth: "calc(100% - 40px)" }}
        className={`absolute inset-y-0 flex min-w-0 flex-col border-stone-200 bg-white shadow-[0_28px_56px_-24px_rgba(24,22,20,0.45)] outline-none dark:border-white/[0.16] dark:bg-[#1D1D1A] ${side === "right" ? "right-0 rounded-l-[14px] border-l" : "left-0 rounded-r-[14px] border-r"} ${dragging ? "select-none" : ""} ${className}`}
        {...panelProps}
      >
        <header {...gripProps} style={{ touchAction: "pan-y" }} className={`flex shrink-0 select-none items-start gap-3 border-b border-stone-200 px-4 py-3 dark:border-white/[0.16] ${dragging ? "cursor-grabbing" : "cursor-grab"}`}>
          <div className="min-w-0 flex-1">
            {typeof title === "string" ? <h2 id={titleId} className="text-[13px] font-medium text-stone-700 dark:text-stone-200">{title}</h2> : <div id={titleId} className="text-[13px] font-medium text-stone-700 dark:text-stone-200">{title}</div>}
            {description && <div id={descriptionId} className="mt-0.5 text-[12.5px] text-stone-500 dark:text-stone-400">{description}</div>}
          </div>
          {headerActions && <div className="flex shrink-0 items-center gap-2" onPointerDown={(event) => event.stopPropagation()}>{headerActions}</div>}
          {showCloseButton && <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={close} aria-label={closeLabel} className="-mr-1 grid size-7 shrink-0 cursor-pointer place-items-center rounded-[7px] text-stone-400 outline-none transition-colors duration-150 hover:bg-stone-100 hover:text-stone-700 focus-visible:bg-blue-50 focus-visible:text-stone-700 focus-visible:ring-1 focus-visible:ring-blue-600 dark:text-stone-500 dark:hover:bg-white/10 dark:hover:text-stone-100">
            <svg width="13" height="13" viewBox="0 0 256 256" fill="none" aria-hidden="true"><path d="M200 56 56 200M200 200 56 56" stroke="currentColor" strokeWidth="16" strokeLinecap="round" /></svg>
          </button>}
        </header>
        {beforeBody && <div className="shrink-0">{beforeBody}</div>}
        <div data-drawer-body className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 ${bodyClassName}`}>{children}</div>
        {footer && <div className="shrink-0 border-t border-stone-200 px-4 py-3 dark:border-white/[0.16]">{footer}</div>}
        <span id={hintId} className="sr-only">Press Escape to close, or drag the header toward the edge.</span>
      </motion.div>
    </div>
  );
}

export function Drawer(props: DrawerProps) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [retained, setRetained] = useState(props);
  useEffect(() => { setHost(document.body); }, []);
  useEffect(() => { if (props.open) setRetained(props); }, [props]);
  if (!host) return null;
  // Keep the last visible content while the closing panel moves off screen.
  const visible = props.open ? props : { ...retained, open: false, onOpenChange: props.onOpenChange, onCloseComplete: props.onCloseComplete };
  return props.container === "parent" ? <DrawerSurface {...visible} /> : createPortal(<DrawerSurface {...visible} />, host);
}
