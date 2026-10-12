/**
 * Unified application state management store using lightweight subscription pattern (React compatible).
 * Handles global notifications, sidebar toggle, search modal, and UI preferences.
 */
import { useSyncExternalStore } from "react";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
  duration?: number;
}

export interface AppState {
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
  activeFilter: string | null;
  toasts: ToastMessage[];
}

const initialState: AppState = {
  sidebarOpen: true,
  commandPaletteOpen: false,
  activeFilter: null,
  toasts: [],
};

let state: AppState = { ...initialState };
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export const appStore = {
  getState: () => state,

  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  setSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof open === "function" ? open(state.sidebarOpen) : open;
    if (state.sidebarOpen !== next) {
      state = { ...state, sidebarOpen: next };
      notify();
    }
  },

  toggleSidebar: () => {
    state = { ...state, sidebarOpen: !state.sidebarOpen };
    notify();
  },

  setCommandPaletteOpen: (open: boolean) => {
    if (state.commandPaletteOpen !== open) {
      state = { ...state, commandPaletteOpen: open };
      notify();
    }
  },

  setActiveFilter: (filter: string | null) => {
    state = { ...state, activeFilter: filter };
    notify();
  },

  addToast: (toast: Omit<ToastMessage, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newToast: ToastMessage = { ...toast, id };
    state = { ...state, toasts: [...state.toasts, newToast] };
    notify();

    const duration = toast.duration ?? 4000;
    if (duration > 0) {
      setTimeout(() => {
        appStore.removeToast(id);
      }, duration);
    }
    return id;
  },

  removeToast: (id: string) => {
    state = { ...state, toasts: state.toasts.filter((t) => t.id !== id) };
    notify();
  },

  clearToasts: () => {
    state = { ...state, toasts: [] };
    notify();
  },
};

/**
 * Custom React hook to subscribe to state slices
 */
export function useAppStore<T>(selector: (state: AppState) => T): T {
  return useSyncExternalStore(
    appStore.subscribe,
    () => selector(appStore.getState()),
    () => selector(initialState)
  );
}
