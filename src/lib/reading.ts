import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FontSize = "sm" | "md" | "lg" | "xl";
export type ThemeName = "day" | "night";

export type RecentRead = {
  slug: string;
  id: number;
  title: string;
};

/** "" keeps the source order; "az" is alphabetical. Mirrors SortMode in encyclopedia.ts. */
export type SectionSort = "" | "az";

type ReadingState = {
  theme: ThemeName;
  size: FontSize;
  recent: RecentRead[];
  /** Sort choice per section slug; a missing entry means the source order. */
  sorts: Record<string, SectionSort>;
  setTheme: (theme: ThemeName) => void;
  setSize: (size: FontSize) => void;
  setSort: (slug: string, sort: SectionSort) => void;
  remember: (item: RecentRead) => void;
};

export const useReading = create<ReadingState>()(
  persist(
    (set, get) => ({
      theme: "day",
      size: "md",
      recent: [],
      sorts: {},
      setTheme: (theme) => set({ theme }),
      setSize: (size) => set({ size }),
      setSort: (slug, sort) => {
        const sorts = { ...get().sorts };
        if (sort) sorts[slug] = sort;
        else delete sorts[slug];
        set({ sorts });
      },
      remember: (item) => {
        const recent = [item, ...get().recent.filter((entry) => entry.id !== item.id)].slice(0, 5);
        set({ recent });
      },
    }),
    { name: "encyclopedia-reading", skipHydration: true },
  ),
);
