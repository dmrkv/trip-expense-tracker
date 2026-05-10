import { create } from 'zustand';

/**
 * Lightweight UI store. Persistent state (groups, expenses) lives in
 * IndexedDB via Dexie + `useLiveQuery`; this store only handles
 * ephemeral cross-component UI state like modals and toasts.
 */

export interface ToastInput {
  kind?: 'success' | 'error' | 'info';
  message: string;
  /** Auto-dismiss after this many ms. Defaults to 3000. */
  durationMs?: number;
}

export interface Toast extends Required<Omit<ToastInput, 'kind'>> {
  id: string;
  kind: NonNullable<ToastInput['kind']>;
}

interface UIState {
  toasts: Toast[];
  pushToast: (t: ToastInput) => void;
  dismissToast: (id: string) => void;
}

export const useUI = create<UIState>((set) => ({
  toasts: [],
  pushToast: (t) =>
    set((s) => {
      const toast: Toast = {
        id: Math.random().toString(36).slice(2),
        kind: t.kind ?? 'info',
        message: t.message,
        durationMs: t.durationMs ?? 3000,
      };
      // Schedule auto-dismiss outside React's render path.
      setTimeout(() => {
        useUI.getState().dismissToast(toast.id);
      }, toast.durationMs);
      return { toasts: [...s.toasts, toast] };
    }),
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
