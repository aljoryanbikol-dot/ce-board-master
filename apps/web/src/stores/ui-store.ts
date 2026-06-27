/**
 * @file ui-store.ts — ephemeral UI state (Zustand): command palette + sidebar.
 * Theme is owned by next-themes; this store covers cross-component UI toggles.
 */
import { create } from 'zustand';

interface UIState {
  commandOpen: boolean;
  sidebarOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  toggleCommand: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  commandOpen: false,
  sidebarOpen: false,
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  toggleCommand: () => set((s) => ({ commandOpen: !s.commandOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
