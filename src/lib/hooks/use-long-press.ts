"use client";

import { useCallback, useRef } from "react";

export interface UseLongPressOptions {
  threshold?: number; // ms to wait before triggering (default: 500)
  vibrate?: boolean | number; // haptic feedback duration in ms (default: 50)
  onCancel?: () => void;
}

export function useLongPress<T = any>(
  callback: (item: T, event: { x: number; y: number }) => void,
  options: UseLongPressOptions = {}
) {
  const { threshold = 500, vibrate = 50, onCancel } = options;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isLongPressRef = useRef(false);

  const start = useCallback(
    (item: T, e: React.TouchEvent | React.MouseEvent) => {
      let clientX = 0;
      let clientY = 0;

      if ("touches" in e) {
        if (e.touches.length !== 1) return;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
      }

      startPosRef.current = { x: clientX, y: clientY };
      isLongPressRef.current = false;

      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        // Trigger mobile haptic feedback if supported by browser/device
        if (vibrate && typeof window !== "undefined" && typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate(typeof vibrate === "number" ? vibrate : 50);
          } catch {
            // Ignore unsupported/blocked vibration
          }
        }
        callback(item, { x: clientX, y: clientY });
      }, threshold);
    },
    [callback, threshold, vibrate]
  );

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onCancel?.();
  }, [onCancel]);

  const move = useCallback(
    (e: React.TouchEvent) => {
      if (!timerRef.current || e.touches.length !== 1) return;
      const moveX = e.touches[0].clientX;
      const moveY = e.touches[0].clientY;
      const distance = Math.hypot(
        moveX - startPosRef.current.x,
        moveY - startPosRef.current.y
      );
      // If user moved more than 10px, they are scrolling page -> cancel long-press
      if (distance > 10) {
        cancel();
      }
    },
    [cancel]
  );

  return {
    getHandlers: (item: T) => ({
      onTouchStart: (e: React.TouchEvent) => start(item, e),
      onTouchMove: move,
      onTouchEnd: cancel,
      onTouchCancel: cancel,
    }),
  };
}
