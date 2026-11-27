import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/shell";
import { SkeletonRows } from "@/components/skeleton";
import { catalog } from "@/data/catalog";
import {
  arNum,
  arrange,
  findNode,
  flattenDocs,
  letterOf,
  loadSection,
  normalizeAr,
  testamentOrder,
  type FlatDoc,
  type SectionFile,
  type SortMode,
  type TreeNode,
} from "@/lib/encyclopedia";
import { useReading } from "@/lib/reading";

/** Long alphabetical lists get a bar of letters to jump with. */
const LETTER_BAR_MIN = 30;

export const Route = createFileRoute("/s/$slug")({
  validateSearch: (search: Record<string, unknown>) => ({
    d: typeof search.d === "string" ? search.d : "",
    only: search.only === "1" ? "1" : "",
  }),
  component: SectionPage,
});

function SectionPage() {
  const { slug } = Route.useParams();
  const { d, only } = Route.useSearch();
  const navigate = useNavigate({ from: "/s/$slug" });
  const meta = catalog.sections.find((section) => section.slug === slug);
  const [file, setFile] = useState<SectionFile | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const sort: SortMode = useReading((state) => state.sorts[slug] ?? "");
  const setSort = useReading((state) => state.setSort);

  useEffect(() => {
    if (!meta) return;
    let cancel = false;
    setFile(null);
    setError("");
    loadSection(slug)
      .then((data) => {
        if (!cancel) setFile(data);
      })
      .catch((err: unknown) => {
        if (!cancel) setError(err instanceof Error ? err.message : "تعذر الفتح");
      });
    return () => {
      cancel = true;
    };
  }, [slug, meta]);

  const parts = d ? d.split("/").filter(Boolean) : [];
  const node = file ? findNode(file.tree, parts) : null;

  const filtered = useMemo(() => {
    if (!file) return [];
    const needle = normalizeAr(filter);
    if (needle.length < 2) return [];
    return flattenDocs(file.tree).filter((doc) => normalizeAr(doc.title).includes(needle));
  }, [file, filter]);

  if (!meta) {
    return (
      <Shell>
        <main className="mx-auto max-w-3xl px-4 py-16">
          <h1 className="font-serif text-3xl">القسم غير موجود</h1>
          <Link to="/" search={{ q: "" }} className="mt-4 inline-block text-crimson">
            العودة للفهرس
          </Link>
        </main>
      </Shell>
    );
  }

  return (
    <Shell mark={`/art/topics/${slug}.png`}>
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">
        <Link to="/" search={{ q: "" }} className="text-sm text-muted">
          الفهرس
        </Link>
        <h1 className="display mt-3 max-w-3xl text-balance text-3xl">{meta.label}</h1>
        <span className="flourish" aria-hidden="true" />
        <p className="mt-2 text-sm text-muted">
          {arNum(meta.count)} عنواناً
          {meta.bodies > 0 ? ` · ${arNum(meta.bodies)} بنص مرفوع` : " · عناوين فقط"}
        </p>

        <label className="field-box mt-6">
          <Search className="size-5 shrink-0 text-crimson" aria-hidden="true" />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="تصفية داخل هذا القسم"
            className="w-full bg-transparent text-base outline-none placeholder:text-muted"
          />
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {meta.bodies > 0 ? (
            <div className="flex gap-2" role="group" aria-label="ما يظهر">
              <FilterChip
                active={only !== "1"}
                label="الكل"
                onClick={() => {
                  void navigate({ search: { d, only: "" } });
                }}
              />
              <FilterChip
                active={only === "1"}
                label="فيها نص"
                onClick={() => {
                  void navigate({ search: { d, only: "1" } });
                }}
              />
            </div>
          ) : null}
          <div className="ms-auto flex items-center gap-2" role="group" aria-label="الترتيب">
            <span className="text-sm text-muted">الترتيب</span>
            <FilterChip active={sort === ""} label="الأصلي" onClick={() => setSort(slug, "")} />
            <FilterChip active={sort === "az"} label="أبجدي" onClick={() => setSort(slug, "az")} />
          </div>
        </div>

        {error ? <p className="mt-6 text-crimson">{error}</p> : null}
        {!file && !error ? <SkeletonRows count={6} /> : null}

        {file && filter.trim().length >= 2 ? (
          <DocList docs={filtered.slice(0, 80)} slug={slug} note={filtered.length > 80} />
        ) : null}

        {file && filter.trim().length < 2 && only === "1" ? (
          <DocList
            docs={flattenDocs(node ?? file.tree).filter((doc) => doc.body)}
            slug={slug}
            sort={sort}
          />
        ) : null}

        {file && node && filter.trim().length < 2 && only !== "1" ? (
          <FolderView
            slug={slug}
            node={node}
            parts={parts}
            sort={sort}
            onOpen={(name) => {
              void navigate({
                search: { d: [...parts, name].join("/"), only: "" },
              });
            }}
            onCrumb={(index) => {
              void navigate({
                search: { d: parts.slice(0, index).join("/"), only: "" },
              });
            }}
          />
        ) : null}

        {file && !node && filter.trim().length < 2 && only !== "1" ? (
          <p className="mt-6 text-muted">هذا المسار غير موجود في القسم.</p>
        ) : null}
      </main>
    </Shell>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "min-h-11 rounded-full px-4 text-sm " +
        (active ? "bg-ink text-parchment" : "panel text-ink")
      }
    >
      {label}
    </button>
  );
}

function FolderView({
  slug,
  node,
  parts,
  sort,
  onOpen,
  onCrumb,
}: {
  slug: string;
  node: TreeNode;
  parts: string[];
  sort: SortMode;
  onOpen: (name: string) => void;
  onCrumb: (index: number) => void;
}) {
  const dirs = arrange(testamentOrder(node.dirs), (dir) => dir.label, sort);
  const docs = arrange(node.docs, (doc) => doc.title, sort);
  const lettered = sort === "az" && !docs.kept && docs.items.length >= LETTER_BAR_MIN;
  return (
    <div className="mt-6">
      {parts.length > 0 ? (
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted">
          <button type="button" className="min-h-11 underline" onClick={() => onCrumb(0)}>
            بداية القسم
          </button>
          {parts.map((part, index) => (
            <span key={part} className="flex items-center gap-2">
              <span aria-hidden="true">/</span>
              <button type="button" className="min-h-11" onClick={() => onCrumb(index + 1)}>
                {nodeLabel(part)}
              </button>
            </span>
          ))}
        </nav>
      ) : null}

      {dirs.items.length > 0 ? (
        <>
          {dirs.kept ? <KeptNote /> : null}
          <ul className="space-y-2">
            {dirs.items.map((dir) => (
              <li key={dir.name}>
                <button
                  type="button"
                  onClick={() => onOpen(dir.name)}
                  className="panel flex w-full min-h-11 items-center justify-between gap-3 px-4 py-3 text-start"
                >
                  <span>
                    <span className="block font-medium">{dir.label}</span>
                    <span className="text-sm text-muted">{arNum(dir.count)} عنواناً</span>
                  </span>
                  <span className="flex items-center gap-2 text-sm text-muted">
                    {dir.bodies > 0 ? <span className="text-crimson">{arNum(dir.bodies)} نص</span> : null}
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {docs.items.length > 0 ? (
        <div className={dirs.items.length > 0 ? "mt-4" : undefined}>
          {docs.kept ? <KeptNote /> : null}
          {lettered ? <LetterBar docs={docs.items} listId="docs" /> : null}
          <ul className="panel divide-y divide-line overflow-hidden">
            {docs.items.map((doc, index) => (
              <li key={doc.id} id={lettered ? letterAnchor(docs.items, index, "docs") : undefined} className="scroll-mt-24">
                <DocLink slug={slug} doc={doc} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {node.dirs.length === 0 && node.docs.length === 0 ? (
        <p className="text-muted">هذا المجلد فارغ.</p>
      ) : null}
    </div>
  );
}

function KeptNote() {
  return <p className="mb-2 text-sm text-muted">هذه القائمة متسلسلة، فبقيت بترتيبها الأصلي.</p>;
}

/** The anchor id for the first title under each letter, or undefined. */
function letterAnchor(docs: { title: string }[], index: number, listId: string): string | undefined {
  const letter = letterOf(docs[index].title);
  if (index > 0 && letterOf(docs[index - 1].title) === letter) return undefined;
  return `${listId}-${letter}`;
}

function LetterBar({ docs, listId }: { docs: { title: string }[]; listId: string }) {
  const letters: string[] = [];
  for (const doc of docs) {
    const letter = letterOf(doc.title);
    if (letters[letters.length - 1] !== letter) letters.push(letter);
  }
  return (
    <nav className="mb-3 flex flex-wrap gap-1.5" aria-label="انتقل إلى حرف">
      {letters.map((letter) => (
        <button
          key={letter}
          type="button"
          className="panel flex size-10 items-center justify-center rounded-full font-serif text-lg"
          onClick={() =>
            document.getElementById(`${listId}-${letter}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        >
          {letter === "#" ? "#" : letter}
        </button>
      ))}
    </nav>
  );
}

function nodeLabel(name: string): string {
  return name.replace(/^\d+-/, "");
}

function DocList({
  docs,
  slug,
  note,
  sort = "",
}: {
  docs: FlatDoc[];
  slug: string;
  note?: boolean;
  sort?: SortMode;
}) {
  if (docs.length === 0) {
    return <p className="mt-6 text-muted">لا شيء هنا.</p>;
  }
  const arranged = arrange(docs, (doc) => doc.title, sort);
  const lettered = sort === "az" && !arranged.kept && arranged.items.length >= LETTER_BAR_MIN;
  return (
    <div className="mt-6">
      {arranged.kept ? <KeptNote /> : null}
      {lettered ? <LetterBar docs={arranged.items} listId="flat" /> : null}
      <ul className="panel divide-y divide-line overflow-hidden">
        {arranged.items.map((doc, index) => (
          <li key={doc.id} id={lettered ? letterAnchor(arranged.items, index, "flat") : undefined} className="scroll-mt-24">
            <DocLink slug={slug} doc={doc} trail={doc.trail.join(" · ")} />
          </li>
        ))}
      </ul>
      {note ? <p className="mt-3 text-sm text-muted">ضيّق التصفية لرؤية البقية.</p> : null}
    </div>
  );
}

function DocLink({ slug, doc, trail }: { slug: string; doc: { id: number; title: string; body: boolean }; trail?: string }) {
  return (
    <Link
      to="/r/$slug/$id"
      params={{ slug, id: String(doc.id) }}
      className="row-hover flex min-h-11 items-center justify-between gap-3 px-4 py-3"
    >
      <span className="min-w-0">
        <span className="block leading-snug">{doc.title}</span>
        {trail ? <span className="text-xs text-muted">{trail}</span> : null}
      </span>
      <span className={"shrink-0 text-xs " + (doc.body ? "text-crimson" : "text-muted")}>
        {doc.body ? "نص" : "فهرس"}
      </span>
    </Link>
  );
}
