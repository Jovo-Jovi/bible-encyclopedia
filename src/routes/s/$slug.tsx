import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/shell";
import { SkeletonRows } from "@/components/skeleton";
import { catalog } from "@/data/catalog";
import {
  arNum,
  findNode,
  flattenDocs,
  loadSection,
  normalizeAr,
  type FlatDoc,
  type SectionFile,
  type TreeNode,
} from "@/lib/encyclopedia";

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

        {meta.bodies > 0 ? (
          <div className="mt-3 flex gap-2">
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

        {error ? <p className="mt-6 text-crimson">{error}</p> : null}
        {!file && !error ? <SkeletonRows count={6} /> : null}

        {file && filter.trim().length >= 2 ? (
          <DocList docs={filtered.slice(0, 80)} slug={slug} note={filtered.length > 80} />
        ) : null}

        {file && filter.trim().length < 2 && only === "1" ? (
          <DocList
            docs={flattenDocs(node ?? file.tree).filter((doc) => doc.body)}
            slug={slug}
          />
        ) : null}

        {file && node && filter.trim().length < 2 && only !== "1" ? (
          <FolderView
            slug={slug}
            node={node}
            parts={parts}
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
  onOpen,
  onCrumb,
}: {
  slug: string;
  node: TreeNode;
  parts: string[];
  onOpen: (name: string) => void;
  onCrumb: (index: number) => void;
}) {
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

      {node.dirs.length > 0 ? (
        <ul className="space-y-2">
          {node.dirs.map((dir) => (
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
      ) : null}

      {node.docs.length > 0 ? (
        <ul className={node.dirs.length > 0 ? "panel mt-4 divide-y divide-line overflow-hidden" : "panel divide-y divide-line overflow-hidden"}>
          {node.docs.map((doc) => (
            <li key={doc.id}>
              <DocLink slug={slug} doc={doc} />
            </li>
          ))}
        </ul>
      ) : null}

      {node.dirs.length === 0 && node.docs.length === 0 ? (
        <p className="text-muted">هذا المجلد فارغ.</p>
      ) : null}
    </div>
  );
}

function nodeLabel(name: string): string {
  return name.replace(/^\d+-/, "");
}

function DocList({ docs, slug, note }: { docs: FlatDoc[]; slug: string; note?: boolean }) {
  if (docs.length === 0) {
    return <p className="mt-6 text-muted">لا شيء هنا.</p>;
  }
  return (
    <div className="mt-6">
      <ul className="panel divide-y divide-line overflow-hidden">
        {docs.map((doc) => (
          <li key={doc.id}>
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
