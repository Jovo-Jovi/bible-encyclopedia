export type Doc = {
  id: number;
  title: string;
  chars: number;
  body: boolean;
};

export type TreeNode = {
  name: string;
  label: string;
  count: number;
  bodies: number;
  dirs: TreeNode[];
  docs: Doc[];
};

export type SectionFile = {
  slug: string;
  name: string;
  label: string;
  count: number;
  bodies: number;
  tree: TreeNode;
};

export type Block =
  | { t: "ar" | "en"; x: string }
  | { t: "pair"; en: string; ar: string };

export type BodyFile = { blocks: Block[] };

export type SearchRow = [string, number, string, number];

export type FlatDoc = Doc & { trail: string[] };

const sectionCache = new Map<string, Promise<SectionFile>>();
let searchPromise: Promise<SearchRow[]> | null = null;

export function loadSection(slug: string): Promise<SectionFile> {
  let pending = sectionCache.get(slug);
  if (!pending) {
    pending = fetch(`/data/sections/${slug}.json`).then((res) => {
      if (!res.ok) throw new Error("تعذر فتح هذا القسم");
      return res.json() as Promise<SectionFile>;
    });
    sectionCache.set(slug, pending);
  }
  return pending;
}

/** Article files live in folders of 100: id 18800 → /data/bodies/188/18800.json. */
export function bodyPath(id: number): string {
  return `/data/bodies/${Math.floor(id / 100)}/${id}.json`;
}

export function loadBody(id: number): Promise<BodyFile> {
  return fetch(bodyPath(id)).then((res) => {
    if (!res.ok) throw new Error("النص غير متاح");
    return res.json() as Promise<BodyFile>;
  });
}

export function loadSearch(): Promise<SearchRow[]> {
  if (!searchPromise) {
    searchPromise = fetch("/data/search.json").then((res) => {
      if (!res.ok) throw new Error("تعذر فتح الفهرس");
      return res.json() as Promise<SearchRow[]>;
    });
  }
  return searchPromise;
}

export function normalizeAr(input: string): string {
  return input
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function arNum(value: number): string {
  return value.toLocaleString("ar-EG");
}

export function findNode(tree: TreeNode, path: string[]): TreeNode | null {
  let node = tree;
  for (const part of path) {
    const next = node.dirs.find((dir) => dir.name === part);
    if (!next) return null;
    node = next;
  }
  return node;
}

export function locateDoc(
  tree: TreeNode,
  id: number,
  trail: TreeNode[] = [],
): { node: TreeNode; index: number; trail: TreeNode[] } | null {
  const index = tree.docs.findIndex((doc) => doc.id === id);
  if (index >= 0) return { node: tree, index, trail };
  for (const dir of tree.dirs) {
    const found = locateDoc(dir, id, trail.concat(dir));
    if (found) return found;
  }
  return null;
}

export function flattenDocs(node: TreeNode, trail: string[] = []): FlatDoc[] {
  const here: FlatDoc[] = node.docs.map((doc) => ({ ...doc, trail }));
  return node.dirs.reduce<FlatDoc[]>(
    (all, dir) => all.concat(flattenDocs(dir, trail.concat(dir.label))),
    here,
  );
}

export const GROUPS: { id: string; title: string; slugs: string[] }[] = [
  {
    id: "text",
    title: "النص والتفسير",
    slugs: ["bible", "02", "05", "07", "19", "06"],
  },
  {
    id: "faith",
    title: "العقيدة",
    slugs: ["22", "21", "18", "30", "25", "15", "16", "23", "32"],
  },
  {
    id: "church",
    title: "الكنيسة والتاريخ",
    slugs: ["14", "17", "09", "20", "29", "28", "27", "24", "12"],
  },
  {
    id: "dialogue",
    title: "حوار وردّ",
    slugs: ["11", "33", "13", "26", "31"],
  },
];
