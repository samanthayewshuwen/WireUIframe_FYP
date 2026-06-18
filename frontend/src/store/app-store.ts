import { create } from "zustand";
import { AppState } from "../types";

interface SavedComponentEntry {
  id: string;
  name: string;
  html: string;
}

type ImageStateUpdate = string[] | ((previous: string[]) => string[]);

interface AppStore {
  appState: AppState;
  setAppState: (state: AppState) => void;

  updateInstruction: string;
  setUpdateInstruction: (instruction: string) => void;

  updateImages: string[];
  setUpdateImages: (images: ImageStateUpdate) => void;

  inSelectAndEditMode: boolean;
  toggleInSelectAndEditMode: () => void;
  disableInSelectAndEditMode: () => void;

  isInteractiveMode: boolean;
  setInteractiveMode: (value: boolean) => void;

  isInspectMode: boolean;
  setInspectMode: (value: boolean) => void;

  propsPanelOpen: boolean;
  setPropsPanelOpen: (value: boolean) => void;

  hadInteractiveEdits: boolean;
  setHadInteractiveEdits: (value: boolean) => void;

  sidebarCollapsed: boolean;
  setSidebarCollapsed: (value: boolean) => void;

  selectedElement: HTMLElement | null;
  setSelectedElement: (element: HTMLElement | null) => void;

  savedComponents: SavedComponentEntry[];
  addSavedComponent: (component: SavedComponentEntry) => void;
  removeSavedComponent: (id: string) => void;

  /** Current project title — synced from Sidebar; used for download filenames. */
  projectTitle: string;
  setProjectTitle: (title: string) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  appState: AppState.INITIAL,
  setAppState: (state) => set({ appState: state }),

  updateInstruction: "",
  setUpdateInstruction: (instruction) => set({ updateInstruction: instruction }),

  updateImages: [],
  setUpdateImages: (images) =>
    set((state) => ({
      updateImages: typeof images === "function" ? images(state.updateImages) : images,
    })),

  inSelectAndEditMode: false,
  toggleInSelectAndEditMode: () => set((state) => ({ inSelectAndEditMode: !state.inSelectAndEditMode })),
  disableInSelectAndEditMode: () => set({ inSelectAndEditMode: false }),

  isInteractiveMode: false,
  setInteractiveMode: (value) => set({ isInteractiveMode: value }),

  isInspectMode: false,
  setInspectMode: (value) => set({ isInspectMode: value }),

  propsPanelOpen: false,
  setPropsPanelOpen: (value) => set({ propsPanelOpen: value }),

  hadInteractiveEdits: false,
  setHadInteractiveEdits: (value) => set({ hadInteractiveEdits: value }),

  sidebarCollapsed: false,
  setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),

  selectedElement: null,
  setSelectedElement: (element) => set({ selectedElement: element }),

  savedComponents: [],
  addSavedComponent: (component) =>
    set((state) => ({ savedComponents: [component, ...state.savedComponents] })),
  removeSavedComponent: (id) =>
    set((state) => ({ savedComponents: state.savedComponents.filter((component) => component.id !== id) })),

  projectTitle: "ui-export",
  setProjectTitle: (title) => set({ projectTitle: title }),
}));
