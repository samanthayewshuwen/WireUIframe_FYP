import { create } from "zustand";

export type ScreenStatus = "pending" | "generating" | "complete" | "error";

export interface ProjectScreen {
  id: string;
  name: string;
  html: string;
  /** Snapshot of the first-generated HTML — used by Reset to restore original. */
  originalHtml: string;
  /** Separate HTML state for mobile view. Starts as a copy of html; edits in mobile tab only change this. */
  mobileHtml: string;
  /** Snapshot of mobile HTML for Reset in mobile view. */
  originalMobileHtml: string;
  status: ScreenStatus;
}

interface FullProjectState {
  isActive: boolean;
  projectName: string;
  projectNotes: string;
  planStatus: "idle" | "planning" | "ready" | "error";
  screens: ProjectScreen[];
  activeScreenId: string | null;
  generationError: string | null;
  /** Supabase `generations.id` for this project — null until first save. */
  dbRowId: number | null;

  // Actions
  reset: () => void;
  setProjectName: (name: string) => void;
  setProjectNotes: (notes: string) => void;
  startPlanning: (projectName: string) => void;
  setPlan: (
    projectName: string,
    screens: Array<{ id: string; name: string }>
  ) => void;
  setScreenStatus: (id: string, status: ScreenStatus) => void;
  setScreenHtml: (id: string, html: string) => void;
  appendScreenHtml: (id: string, chunk: string) => void;
  setActiveScreen: (id: string) => void;
  setError: (error: string) => void;
  setDbRowId: (id: number) => void;
  /** Reset the active screen's HTML to the first-generated originalHtml. */
  resetScreenToOriginal: (id: string) => void;
  /** Update only the mobile HTML for a screen (desktop html unchanged). */
  setScreenMobileHtml: (id: string, html: string) => void;
  /** Reset the active screen's mobile HTML to the original. */
  resetScreenMobileToOriginal: (id: string) => void;
  /** Add a new blank page to the project and make it active. */
  addBlankScreen: (name: string) => void;
  /** Delete a screen by id; switches to the first remaining screen. */
  deleteScreen: (id: string) => void;
  /** Rename a screen by id. */
  renameScreen: (id: string, name: string) => void;
}

const initialState = {
  isActive: false,
  projectName: "",
  projectNotes: "",
  planStatus: "idle" as const,
  screens: [],
  activeScreenId: null,
  generationError: null,
  dbRowId: null,
};

export const useFullProjectStore = create<FullProjectState>((set) => ({
  ...initialState,

  reset: () => set({ ...initialState }),

  setProjectName: (name) => set({ projectName: name }),

  setProjectNotes: (notes) => set({ projectNotes: notes }),

  startPlanning: (projectName) =>
    set({
      isActive: true,
      projectName,
      planStatus: "planning",
      screens: [],
      activeScreenId: null,
      generationError: null,
      dbRowId: null,
    }),

  setPlan: (projectName, screens) =>
    set({
      projectName,
      planStatus: "ready",
      screens: screens.map((s) => ({
        ...s,
        html: "",
        originalHtml: "",
        mobileHtml: "",
        originalMobileHtml: "",
        status: "pending" as ScreenStatus,
      })),
      activeScreenId: screens[0]?.id ?? null,
    }),

  setScreenStatus: (id, status) =>
    set((state) => ({
      screens: state.screens.map((s) => {
        if (s.id !== id) return s;
        // Snapshot html as originalHtml the first time a screen completes generation
        const shouldSnapshot = status === "complete" && s.originalHtml === "";
        return { ...s, status, ...(shouldSnapshot ? { originalHtml: s.html } : {}) };
      }),
    })),

  setScreenHtml: (id, html) =>
    set((state) => ({
      screens: state.screens.map((s) => {
        if (s.id !== id) return s;
        // Snapshot the first non-empty html as originalHtml so Reset always has a target.
        // This covers screens loaded from the database (which bypass setScreenStatus).
        const shouldSnapshot = s.originalHtml === "" && html.trim().length > 0;
        // Also initialise mobileHtml from the first non-empty desktop HTML so mobile
        // view starts as a copy of the desktop version.
        const shouldMobileSnapshot = s.mobileHtml === "" && html.trim().length > 0;
        return {
          ...s,
          html,
          ...(shouldSnapshot ? { originalHtml: html } : {}),
          ...(shouldMobileSnapshot ? { mobileHtml: html, originalMobileHtml: html } : {}),
        };
      }),
    })),

  appendScreenHtml: (id, chunk) =>
    set((state) => ({
      screens: state.screens.map((s) =>
        s.id === id ? { ...s, html: s.html + chunk } : s
      ),
    })),

  setActiveScreen: (id) => set({ activeScreenId: id }),

  setError: (error) =>
    set({ generationError: error, planStatus: "error" as const }),

  setDbRowId: (id) => set({ dbRowId: id }),

  resetScreenToOriginal: (id) =>
    set((state) => ({
      screens: state.screens.map((s) =>
        s.id === id && s.originalHtml ? { ...s, html: s.originalHtml } : s
      ),
    })),

  setScreenMobileHtml: (id, html) =>
    set((state) => ({
      screens: state.screens.map((s) => {
        if (s.id !== id) return s;
        const shouldSnapshot = (!s.originalMobileHtml) && html.trim().length > 0;
        return {
          ...s,
          mobileHtml: html,
          ...(shouldSnapshot ? { originalMobileHtml: html } : {}),
        };
      }),
    })),

  resetScreenMobileToOriginal: (id) =>
    set((state) => ({
      screens: state.screens.map((s) =>
        s.id === id && s.originalMobileHtml
          ? { ...s, mobileHtml: s.originalMobileHtml }
          : s
      ),
    })),

  addBlankScreen: (name) =>
    set((state) => {
      const id = `screen_blank_${Date.now()}`;
      const blankHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"><\/script></head><body class="bg-white min-h-screen p-8"><p class="text-gray-400 text-sm text-center mt-20">Blank page — use the sidebar to edit</p></body></html>`;
      const newScreen: ProjectScreen = {
        id,
        name,
        html: blankHtml,
        originalHtml: blankHtml,
        mobileHtml: blankHtml,
        originalMobileHtml: blankHtml,
        status: "complete",
      };
      return { screens: [...state.screens, newScreen], activeScreenId: id };
    }),

  deleteScreen: (id) =>
    set((state) => {
      const remaining = state.screens.filter((s) => s.id !== id);
      const newActiveId =
        state.activeScreenId === id
          ? (remaining[0]?.id ?? null)
          : state.activeScreenId;
      return { screens: remaining, activeScreenId: newActiveId };
    }),

  renameScreen: (id, name) =>
    set((state) => ({
      screens: state.screens.map((s) => s.id === id ? { ...s, name } : s),
    })),
}));
