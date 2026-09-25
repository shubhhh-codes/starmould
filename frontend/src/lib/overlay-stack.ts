"use client";

type DismissHandler = () => boolean | void;

interface OverlayEntry {
  id: string;
  onDismiss: DismissHandler;
  triggerElement?: HTMLElement | null;
}

class OverlayManager {
  private stack: OverlayEntry[] = [];
  private isListening = false;
  private originalPaddingRight = "";
  private originalOverflow = "";

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
      if (!this.originalOverflow) {
        this.originalOverflow = document.body.style.overflow;
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollbarWidth > 0) {
          this.originalPaddingRight = document.body.style.paddingRight;
          document.body.style.paddingRight = `${scrollbarWidth}px`;
        }
        document.body.style.overflow = "hidden";
      }
    } else {
      if (this.originalOverflow !== undefined) {
        document.body.style.overflow = this.originalOverflow;
        document.body.style.paddingRight = this.originalPaddingRight;
        this.originalOverflow = "";
        this.originalPaddingRight = "";
      }
    }
  }

  push(id: string, onDismiss: DismissHandler, triggerElement?: HTMLElement | null) {
    if (typeof window === "undefined") return;

    // Remove if already in stack to move to top
    this.stack = this.stack.filter((item) => item.id !== id);
    this.stack.push({
      id,
      onDismiss,
      triggerElement: triggerElement || (document.activeElement as HTMLElement),
    });

    if (!this.isListening) {
      window.addEventListener("keydown", this.handleKeyDown, { capture: true });
      this.isListening = true;
    }

    this.updateBodyLock();
  }

  pop(id: string) {
    if (typeof window === "undefined") return;

    const index = this.stack.findIndex((item) => item.id === id);
    if (index !== -1) {
      const [removed] = this.stack.splice(index, 1);
      // Restore focus to trigger element
      if (removed?.triggerElement && typeof removed.triggerElement.focus === "function") {
        setTimeout(() => {
          try {
            removed.triggerElement?.focus();
          } catch {
            // ignore
          }
        }, 50);
      }
    }

    this.updateBodyLock();

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
