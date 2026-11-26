import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FontSize = "sm" | "md" | "lg" | "xl";
export type ThemeName = "day" | "night";

export type RecentRead = {
  slug: string;
  id: number;
  title: string;
};

type ReadingState = {
  theme: ThemeName;
  size: FontSize;
  recent: RecentRead[];
  setTheme: (theme: ThemeName) => void;
  setSize: (size: FontSize) => void;
  remember: (item: RecentRead) => void;
};

export const useReading = create<ReadingState>()(
  persist(
    (set, get) => ({
      theme: "day",
      size: "md",
      recent: [],
      setTheme: (theme) => set({ theme }),
      setSize: (size) => set({ size }),
      remember: (item) => {
        const recent = [item, ...get().recent.filter((entry) => entry.id !== item.id)].slice(0, 5);
        set({ recent });
      },
    }),
    { name: "encyclopedia-reading", skipHydration: true },
  ),
);
