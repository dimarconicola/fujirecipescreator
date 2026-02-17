import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { defaultImageId } from "../data/images";

export type ViewerTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type CompareMode = "after" | "split";

type ViewerStoreState = {
  selectedImageId: string;
  transforms: Record<string, ViewerTransform>;
  compareMode: CompareMode;
  splitPosition: number;
  selectImage: (imageId: string) => void;
  setScale: (imageId: string, scale: number) => void;
  zoomBy: (imageId: string, factor: number) => void;
  setPan: (imageId: string, offsetX: number, offsetY: number) => void;
  resetView: (imageId: string) => void;
  setCompareMode: (mode: CompareMode) => void;
  setSplitPosition: (position: number) => void;
};

export const defaultTransform: ViewerTransform = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

function clampScale(scale: number): number {
  return Math.min(Math.max(scale, 1), 4);
}

function getTransform(
  transforms: Record<string, ViewerTransform>,
  imageId: string,
): ViewerTransform {
  return transforms[imageId] ?? defaultTransform;
}

export const useViewerStore = create<ViewerStoreState>()(
  persist(
    (set, get) => ({
      selectedImageId: defaultImageId,
      transforms: {},
      compareMode: "after",
      splitPosition: 0.5,
      selectImage: (imageId) => {
        set({ selectedImageId: imageId });
      },
      setScale: (imageId, scale) => {
        const normalizedScale = clampScale(scale);
        const currentTransform = getTransform(get().transforms, imageId);

        set((state) => ({
          transforms: {
            ...state.transforms,
            [imageId]: {
              ...currentTransform,
              scale: normalizedScale,
              offsetX: normalizedScale === 1 ? 0 : currentTransform.offsetX,
              offsetY: normalizedScale === 1 ? 0 : currentTransform.offsetY,
            },
          },
        }));
      },
      zoomBy: (imageId, factor) => {
        const currentTransform = getTransform(get().transforms, imageId);
        get().setScale(imageId, currentTransform.scale * factor);
      },
      setPan: (imageId, offsetX, offsetY) => {
        const currentTransform = getTransform(get().transforms, imageId);

        set((state) => ({
          transforms: {
            ...state.transforms,
            [imageId]: {
              ...currentTransform,
              offsetX,
              offsetY,
            },
          },
        }));
      },
      resetView: (imageId) => {
        set((state) => ({
          transforms: {
            ...state.transforms,
            [imageId]: defaultTransform,
          },
        }));
      },
      setCompareMode: (mode) => {
        set({ compareMode: mode });
      },
      setSplitPosition: (position) => {
        const normalized = Math.min(Math.max(position, 0.1), 0.9);
        set({ splitPosition: normalized });
      },
    }),
    {
      name: "fuji-viewer-session-v1",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        selectedImageId: state.selectedImageId,
        transforms: state.transforms,
        compareMode: state.compareMode,
        splitPosition: state.splitPosition,
      }),
    },
  ),
);
