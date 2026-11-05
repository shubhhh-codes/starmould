"use client";

type DismissHandler = () => boolean | void;

interface OverlayEntry {
  id: string;
  onDismiss: DismissHandler;
  triggerElement?: HTMLElement | null;
  root?: HTMLElement | null;
  originalZIndex?: string;
}

class OverlayManager {
  private stack: OverlayEntry[] = [];
  private isListening = false;
  private originalPaddingRight = "";
  private originalOverflow = "";
  private bodyLocked = false;
  private muted = new Map<HTMLElement, boolean>();

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" || e.key === "Esc") {
      if (this.stack.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        const top = this.stack[this.stack.length - 1];
        if (top) {
          const handled = top.onDismiss();
          if (handled !== false) {
            this.pop(top.id);
          }
        }
      }
    }
  };

  private updateBodyLock() {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    if (this.stack.length > 0) {
      if (!this.bodyLocked) {
        this.bodyLocked = true;
        this.originalOverflow = document.body.style.overflow;
        this.originalPaddingRight = document.body.style.paddingRight;
        // Only apply scrollbar width padding compensation on desktop screens with standard physical scrollbars
        const isTouchOrMobile =
          window.innerWidth < 768 ||
          ("ontouchstart" in window && navigator.maxTouchPoints > 0);

        if (!isTouchOrMobile) {
          const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
          if (scrollbarWidth > 0 && scrollbarWidth <= 24) {
            document.body.style.paddingRight = `${scrollbarWidth}px`;
          }
        }
        document.body.style.overflow = "hidden";
      }
    } else {
      if (this.bodyLocked) {
        document.body.style.overflow = this.originalOverflow;
        document.body.style.paddingRight = this.originalPaddingRight;
        this.originalOverflow = "";
        this.originalPaddingRight = "";
        this.bodyLocked = false;
      }
    }
  }

  private updateBackground() {
    for (const [element, inert] of this.muted) element.inert = inert;
    this.muted.clear();
    const top = this.stack[this.stack.length - 1];
    if (!top?.root) return;
    for (const node of Array.from(document.body.children)) {
      if (!(node instanceof HTMLElement) || node.contains(top.root)) continue;
      this.muted.set(node, node.inert);
      node.inert = true;
    }
    this.stack.forEach((entry, index) => {
      if (entry.root) entry.root.style.zIndex = String(10000 + index * 10);
    });
  }

  push(id: string, onDismiss: DismissHandler, triggerElement?: HTMLElement | null, root?: HTMLElement | null) {
    if (typeof window === "undefined") return;

    // Remove if already in stack to move to top
    this.stack = this.stack.filter((item) => item.id !== id);
    this.stack.push({
      id,
      onDismiss,
      triggerElement: triggerElement || (document.activeElement as HTMLElement),
      root,
      originalZIndex: root?.style.zIndex,
    });

    if (!this.isListening) {
      window.addEventListener("keydown", this.handleKeyDown, { capture: true });
      this.isListening = true;
    }

    this.updateBodyLock();
    this.updateBackground();
  }

  pop(id: string) {
    if (typeof window === "undefined") return;

    const index = this.stack.findIndex((item) => item.id === id);
    if (index !== -1) {
      const wasTopmost = index === this.stack.length - 1;
      const [removed] = this.stack.splice(index, 1);
      if (removed.root) removed.root.style.zIndex = removed.originalZIndex || "";
      // Restore focus to trigger element
      if (wasTopmost && removed?.triggerElement && typeof removed.triggerElement.focus === "function") {
        setTimeout(() => {
          try {
            const target = removed.triggerElement;
            const top = this.stack[this.stack.length - 1];
            if (target?.isConnected && !target.closest("[inert]") && (!top?.root || top.root.contains(target))) {
              target.focus({ preventScroll: true });
            }
          } catch {
            // ignore
          }
        }, 50);
      }
    }

    this.updateBodyLock();
    this.updateBackground();

    if (this.stack.length === 0 && this.isListening) {
      window.removeEventListener("keydown", this.handleKeyDown, { capture: true });
      this.isListening = false;
    }
  }

  isTopmost(id: string): boolean {
    if (this.stack.length === 0) return false;
    return this.stack[this.stack.length - 1].id === id;
  }
}

export const overlayStack = new OverlayManager();
