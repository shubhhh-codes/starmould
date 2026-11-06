"use client";

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { Minus, Plus } from "lucide-react";

export interface RollingCounterProps {
  /**
   * Initial value (uncontrolled mode). Default is 1.
   */
  defaultValue?: number;
  /**
   * Current value (controlled mode).
   */
  value?: number;
  /**
   * Callback fired when the value changes.
   */
  onChange?: (val: number) => void;
  /**
   * Minimum allowed value. Default is 1.
   */
  min?: number;
  /**
   * Maximum allowed value. Default is 99,999.
   */
  max?: number;
  /**
   * How lively a digit lands (0-100). Default is 45.
   */
  bounce?: number;
  /**
   * The wait between one column and the next in ms (0-120). Default is 45.
   */
  stagger?: number;
  /**
   * How much a spinning digit smears with speed (0-100). Default is 50.
   */
  blur?: number;
  /**
   * Outer corner border radius in px.
   */
  corner?: number;
  /**
   * Visual theme: "dark" | "light" | "auto". Default is "light" for input variant, "dark" for default variant.
   */
  theme?: "dark" | "light" | "auto";
  /**
   * Input sizing: "sm" (h-10 / 40px ERP input height) | "md" (46px standard Bencho size).
   */
  size?: "sm" | "md";
  /**
   * Style variant: "input" (seamless white ERP input matching dropdowns) | "default" (standalone Bencho floating pill).
   */
  variant?: "default" | "input";
  /**
   * Whether the component expands to 100% of container width.
   */
  fullWidth?: boolean;
  /**
   * Enable tactile synthesized Web Audio tock sound. Default is true.
   */
  sound?: boolean;
  /**
   * Additional container CSS classes.
   */
  className?: string;
  /**
   * Inline container styles.
   */
  style?: React.CSSProperties;
}

const TOTAL_DIGITS = 5;
const DEFAULT_MAX = 10 ** TOTAL_DIGITS - 1; // 99999
const DRAG_PX_PER_STEP = 12;

const clamp = (val: number, minVal: number, maxVal: number) =>
  Math.min(maxVal, Math.max(minVal, val));

const getSpring = (bounce: number) => ({
  k: 0.08 + (bounce / 100) * 0.16,
  d: 0.62 + (bounce / 100) * 0.2,
});

let sharedAudioContext: AudioContext | null = null;
function playTockSound() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedAudioContext) sharedAudioContext = new AudioCtx();
    if (sharedAudioContext.state === "suspended") {
      sharedAudioContext.resume().catch(() => {});
    }
    const osc = sharedAudioContext.createOscillator();
    const gain = sharedAudioContext.createGain();
    const now = sharedAudioContext.currentTime;

    osc.type = "sine";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.025);

    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

    osc.connect(gain);
    gain.connect(sharedAudioContext.destination);

    osc.start(now);
    osc.stop(now + 0.035);
  } catch {}
}

const ROLLING_COUNTER_CSS = `
/* =========================================================================
   1. ERP Form Input Variant (Exact match for modal inputs & ERP selects)
   ========================================================================= */
.rct-root[data-variant="input"] {
  height: 40px;
  background-color: #ffffff;
  color: #0f172a;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03);
  overflow: hidden;
  user-select: none;
  box-sizing: border-box;
  padding: 0;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.rct-root[data-variant="input"]:hover {
  border-color: #cbd5e1;
}

.rct-root[data-variant="input"]:focus-within {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
}

.rct-root[data-variant="input"] .rct-btn {
  height: 100%;
  width: 34px;
  border-radius: 0;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  border: 0;
  flex: none;
  place-items: center;
  padding: 0;
  display: grid;
  transition: background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease;
}

.rct-root[data-variant="input"] .rct-btn:hover:not(:disabled) {
  background-color: #f1f5f9;
  color: #0f172a;
}

.rct-root[data-variant="input"] .rct-btn:active:not(:disabled) {
  background-color: #e2e8f0;
  scale: 0.94;
}

.rct-root[data-variant="input"] .rct-num {
  height: 40px;
  line-height: 40px;
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  cursor: ns-resize;
  touch-action: none;
  user-select: none;
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%);
}

.rct-root[data-variant="input"] .rct-strip > span {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rct-root[data-variant="input"] .rct-col {
  height: 40px;
}

/* =========================================================================
   2. Standalone Bencho Floating Pill Variant
   ========================================================================= */
.rct-root[data-variant="default"] {
  font-family: var(--font-inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
  border-radius: var(--rct-r, 16px);
  background: #111318;
  color: #f8fafc;
  align-items: center;
  gap: 0;
  padding: 4px;
  display: inline-flex;
  position: relative;
  user-select: none;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1), 0 4px 16px rgba(0, 0, 0, 0.4);
  box-sizing: border-box;
}

.rct-root[data-variant="default"][data-theme="light"] {
  background: #ffffff;
  color: #0f172a;
  border: 1px solid #e2e8f0;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05), 0 2px 10px rgba(0, 0, 0, 0.05);
}

.rct-root[data-variant="default"][data-theme="light"] .rct-btn {
  background: rgba(15, 23, 42, 0.06);
  color: #0f172a;
}

.rct-root[data-variant="default"][data-theme="light"] .rct-btn:hover {
  background: rgba(15, 23, 42, 0.11);
}

.rct-root[data-variant="default"][data-theme="dark"] {
  background: #111318;
  color: #f8fafc;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1), 0 4px 16px rgba(0, 0, 0, 0.4);
}

.rct-root[data-variant="default"][data-theme="dark"] .rct-btn {
  background: rgba(255, 255, 255, 0.08);
  color: #f8fafc;
}

.rct-root[data-variant="default"][data-theme="dark"] .rct-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.rct-root[data-variant="default"] .rct-btn {
  width: var(--rct-btn-w, 40px);
  height: var(--rct-cell, 46px);
  border-radius: var(--rct-in, 11px);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  border: 0;
  flex: none;
  place-items: center;
  padding: 0;
  transition: scale 0.2s cubic-bezier(0.3, 0.9, 0.4, 1), background-color 0.16s, opacity 0.16s;
  display: grid;
}

.rct-root[data-variant="default"] .rct-btn:active:not(:disabled) {
  scale: 0.88;
}

.rct-root[data-variant="default"] .rct-num {
  height: var(--rct-cell, 46px);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  font-size: var(--rct-font-size, 30px);
  font-weight: 600;
  line-height: var(--rct-cell, 46px);
  cursor: ns-resize;
  touch-action: none;
  user-select: none;
  border-radius: 8px;
  justify-content: center;
  padding: 0 var(--rct-pad, 14px);
  display: flex;
  flex: 1;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%);
}

.rct-root[data-variant="default"] .rct-strip > span {
  height: var(--rct-cell, 46px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.rct-root[data-variant="default"] .rct-col {
  height: var(--rct-cell, 46px);
}

/* =========================================================================
   3. Shared Rolling Odometer Engine Mechanics
   ========================================================================= */
.rct-root.rct-fullwidth {
  width: 100%;
}

.rct-btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
  pointer-events: none;
}

.rct-btn:focus-visible,
.rct-num:focus-visible {
  outline: none;
}

.rct-pair {
  display: flex;
}

.rct-col {
  opacity: 0;
  width: 0;
  transition: width 0.32s cubic-bezier(0.3, 1.2, 0.4, 1), opacity 0.22s;
  overflow: hidden;
}

.rct-col[data-on] {
  opacity: 1;
  width: 0.64em;
}

.rct-strip {
  will-change: transform, filter;
  flex-direction: column;
  align-items: center;
  display: flex;
}

.rct-sep {
  opacity: 0;
  width: 0;
  transition: width 0.32s cubic-bezier(0.3, 1.2, 0.4, 1), opacity 0.22s;
  overflow: hidden;
  display: flex;
  align-items: center;
}

.rct-sep[data-on] {
  opacity: 1;
  width: 0.26em;
}
`;

export function RollingCounter({
  defaultValue = 1,
  value: controlledValue,
  onChange,
  min = 1,
  max = DEFAULT_MAX,
  bounce = 45,
  stagger = 45,
  blur = 50,
  corner,
  theme,
  size = "md",
  variant = "input",
  fullWidth = false,
  sound = true,
  className = "",
  style,
}: RollingCounterProps) {
  const isControlled = controlledValue !== undefined;
  const initialVal = isControlled ? controlledValue! : defaultValue;

  const [displayValue, setDisplayValue] = useState<number>(initialVal);
  const currentValRef = useRef<number>(initialVal);
  const stripRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Resolve theme: if variant="input", defaults to "light" unless user specified
  const effectiveTheme = theme || (variant === "input" ? "light" : "dark");

  // Sizing definitions
  const isInput = variant === "input";
  const isSm = size === "sm" || isInput;
  const cellHeight = isInput ? 40 : isSm ? 34 : 46;
  const btnWidth = isInput ? 34 : isSm ? 32 : 40;
  const fontSize = isInput ? 14 : isSm ? 18 : 30;
  const paddingX = isInput ? 4 : isSm ? 6 : 14;
  const defaultCorner = isInput ? 12 : isSm ? 12 : 16;
  const effectiveCorner = corner !== undefined ? corner : defaultCorner;

  // Internal Column Odometer State: one spring per place (0 = ones, 1 = tens, etc.)
  const columnsRef = useRef(
    Array.from({ length: TOTAL_DIGITS }, (_, i) => {
      const n = Math.floor(initialVal / 10 ** i);
      return {
        pos: n,
        vel: 0,
        target: n,
        due: [] as number[],
        next: [] as number[],
      };
    })
  );

  const animFrameRef = useRef<number>(0);
  const paramsRef = useRef({ bounce, stagger, blur, cellHeight });
  useLayoutEffect(() => {
    paramsRef.current = { bounce, stagger, blur, cellHeight };
  }, [bounce, stagger, blur, cellHeight]);

  // Update visual DOM positions and blur smear
  const updateDOM = useCallback(() => {
    columnsRef.current.forEach((col, place) => {
      const strip = stripRefs.current[place];
      if (!strip) return;
      const modPos = ((col.pos % 10) + 10) % 10;
      const smear =
        Math.min(3, Math.abs(col.vel) * 2.4) * (paramsRef.current.blur / 50);

      strip.style.transform = `translateY(${-modPos * paramsRef.current.cellHeight}px)`;
      strip.style.filter = smear > 0.15 ? `blur(${smear.toFixed(2)}px)` : "";
    });
  }, []);

  // Position the digits before the first paint, even when the value never changes.
  useLayoutEffect(() => {
    updateDOM();
  }, [updateDOM, cellHeight]);

  // Physics Spring Animation Loop with ripple carry
  const startAnimation = useCallback(() => {
    if (animFrameRef.current) return;
    let lastTime = 0;

    const tick = (now: number) => {
      const delta = lastTime ? clamp((now - lastTime) / 16.67, 0, 2.5) : 1;
      lastTime = now;
      const { k, d: damping } = getSpring(paramsRef.current.bounce);
      const currTime = performance.now();
      let isRunning = false;

      for (const col of columnsRef.current) {
        // Shift scheduled staggered targets
        while (col.due.length && col.due[0] <= currTime) {
          col.due.shift();
          const nxt = col.next.shift();
          if (nxt !== undefined) col.target = nxt;
        }
        if (col.due.length) isRunning = true;

        const diff = col.target - col.pos;
        if (Math.abs(diff) > 24) {
          col.pos += Math.round((diff - Math.sign(diff) * 24) / 10) * 10;
        }
        col.vel += (col.target - col.pos) * k * delta;
        col.vel *= damping ** delta;
        col.pos += col.vel * delta;

        if (Math.abs(col.target - col.pos) < 0.004 && Math.abs(col.vel) < 0.004) {
          col.pos = col.target;
          col.vel = 0;
        } else {
          isRunning = true;
        }
      }

      updateDOM();
      animFrameRef.current = isRunning ? requestAnimationFrame(tick) : 0;
    };

    animFrameRef.current = requestAnimationFrame(tick);
  }, [updateDOM]);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }
    };
  }, []);

  // Internal step logic
  const stepTo = useCallback(
    (targetVal: number) => {
      const nextVal = clamp(targetVal, min, max);
      if (nextVal === currentValRef.current && nextVal === displayValue) return;

      currentValRef.current = nextVal;
      setDisplayValue(nextVal);
      onChange?.(nextVal);

      const now = performance.now();
      columnsRef.current.forEach((col, place) => {
        const placeCount = Math.floor(nextVal / 10 ** place);
        if (prefersReducedMotion) {
          col.pos = col.target = placeCount;
          col.vel = 0;
          col.due = [];
          col.next = [];
          return;
        }
        col.due.push(now + place * paramsRef.current.stagger);
        col.next.push(placeCount);
      });

      if (sound) playTockSound();

      if (prefersReducedMotion) {
        updateDOM();
      } else {
        startAnimation();
      }
    },
    [min, max, onChange, prefersReducedMotion, sound, updateDOM, startAnimation, displayValue]
  );

  // Sync when controlled value updates externally.
  useEffect(() => {
    if (isControlled && controlledValue !== currentValRef.current) {
      stepTo(controlledValue);
    }
  }, [isControlled, controlledValue, stepTo]);

  const stepDelta = useCallback(
    (delta: number) => {
      stepTo(currentValRef.current + delta);
    },
    [stepTo]
  );

  // Hold-to-repeat state (accelerates after 1.5s)
  const holdRef = useRef<{ t: number; since: number }>({ t: 0, since: 0 });
  const stopHold = useCallback(() => {
    if (holdRef.current.t) {
      clearTimeout(holdRef.current.t);
      holdRef.current.t = 0;
    }
  }, []);

  useEffect(() => () => stopHold(), [stopHold]);

  const startHold = useCallback(
    (direction: number) => {
      stopHold();
      stepDelta(direction);
      holdRef.current.since = performance.now();

      const repeat = () => {
        const elapsed = performance.now() - holdRef.current.since;
        const multiplier = elapsed > 1500 ? 10 : 1;
        stepDelta(direction * multiplier);
        holdRef.current.t = window.setTimeout(repeat, elapsed > 900 ? 55 : 90);
      };

      holdRef.current.t = window.setTimeout(repeat, 380);
    },
    [stepDelta, stopHold]
  );

  // Drag-and-fling physics
  const dragAnimRef = useRef<number>(0);
  const dragStateRef = useRef<{ y: number; acc: number; v: number; t: number } | null>(null);

  useEffect(() => {
    return () => {
      if (dragAnimRef.current) cancelAnimationFrame(dragAnimRef.current);
    };
  }, []);

  const handleDragAccumulate = useCallback(
    (delta: number) => {
      const steps = delta > 0 ? Math.floor(delta / DRAG_PX_PER_STEP) : Math.ceil(delta / DRAG_PX_PER_STEP);
      if (steps) stepDelta(steps);
      return delta - steps * DRAG_PX_PER_STEP;
    },
    [stepDelta]
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragAnimRef.current) cancelAnimationFrame(dragAnimRef.current);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    dragStateRef.current = {
      y: e.clientY,
      acc: 0,
      v: 0,
      t: performance.now(),
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (!state) return;
    const now = performance.now();
    const deltaY = state.y - e.clientY; // upward drag = positive increment
    state.y = e.clientY;
    const dt = Math.max(1, now - state.t);
    state.t = now;
    state.v = state.v * 0.6 + (deltaY / dt) * 0.4;
    state.acc = handleDragAccumulate(state.acc + deltaY);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    dragStateRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    if (!state || prefersReducedMotion) return;

    let velocity = performance.now() - state.t > 90 ? 0 : state.v * 16.67;
    if (Math.abs(velocity) < 2) return;

    let acc = state.acc;
    const coast = () => {
      acc = handleDragAccumulate(acc + velocity);
      velocity *= 0.94;
      if (Math.abs(velocity) > 0.4) {
        dragAnimRef.current = requestAnimationFrame(coast);
      }
    };
    dragAnimRef.current = requestAnimationFrame(coast);
  };

  const activeDigitsCount = Math.max(1, String(displayValue).length);
  const outerRadius = clamp(effectiveCorner, 0, 28);
  const innerRadius = Math.max(0, outerRadius - (isSm ? 3 : 5));

  const isMinDisabled = displayValue <= min;
  const isMaxDisabled = displayValue >= max;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ROLLING_COUNTER_CSS }} />
      <div
        className={`rct-root ${fullWidth ? "rct-fullwidth" : ""} ${className}`}
        data-theme={effectiveTheme}
        data-variant={variant}
        data-size={size}
        style={
          {
            "--rct-r": `${outerRadius}px`,
            "--rct-in": `${innerRadius}px`,
            "--rct-cell": `${cellHeight}px`,
            "--rct-btn-w": `${btnWidth}px`,
            "--rct-font-size": `${fontSize}px`,
            "--rct-pad": `${paddingX}px`,
            ...style,
          } as React.CSSProperties
        }
      >
        {/* Decrement Button */}
        <button
          type="button"
          className="rct-btn"
          aria-label="Decrease value"
          disabled={isMinDisabled}
          onPointerDown={() => startHold(-1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              stepDelta(-1);
            }
          }}
        >
          <Minus size={isInput ? 13 : isSm ? 14 : 16} strokeWidth={isInput ? 2.5 : isSm ? 2.6 : 2.4} />
        </button>

        {/* Rolling Odometer Number Display (Draggable & Keyboard-navigable) */}
        <div
          className="rct-num"
          role="spinbutton"
          aria-valuenow={displayValue}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-label="Count. Drag up or down to spin."
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault();
              stepDelta(1);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              stepDelta(-1);
            }
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {Array.from({ length: TOTAL_DIGITS }, (_, idx) => {
            const place = TOTAL_DIGITS - 1 - idx;
            return (
              <span className="rct-pair" key={place}>
                <span
                  className="rct-col"
                  data-on={place < activeDigitsCount || undefined}
                >
                  <span
                    className="rct-strip"
                    ref={(el) => {
                      stripRefs.current[place] = el;
                    }}
                  >
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((digit, dIdx) => (
                      <span key={dIdx}>{digit}</span>
                    ))}
                  </span>
                </span>
                {place === 3 && (
                  <span
                    className="rct-sep"
                    data-on={activeDigitsCount > 3 || undefined}
                  >
                    ,
                  </span>
                )}
              </span>
            );
          })}
        </div>

        {/* Increment Button */}
        <button
          type="button"
          className="rct-btn"
          aria-label="Increase value"
          disabled={isMaxDisabled}
          onPointerDown={() => startHold(1)}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              stepDelta(1);
            }
          }}
        >
          <Plus size={isInput ? 13 : isSm ? 14 : 16} strokeWidth={isInput ? 2.5 : isSm ? 2.6 : 2.4} />
        </button>
      </div>
    </>
  );
}
