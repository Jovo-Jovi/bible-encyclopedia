import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArticleBody } from "@/components/article-body";
import { Shell } from "@/components/shell";
import { SkeletonText } from "@/components/skeleton";
import { catalog } from "@/data/catalog";
import {
  arNum,
  loadBody,
  loadSection,
  locateDoc,
  type Block,
  type Doc,
  type SectionFile,
} from "@/lib/encyclopedia";
import { useReading, type FontSize } from "@/lib/reading";

export const Route = createFileRoute("/r/$slug/$id")({
  component: ReaderPage,
});

const SIZES: FontSize[] = ["sm", "md", "lg", "xl"];
const SIZE_LABEL: Record<FontSize, string> = {
  sm: "صغير",
  md: "وسط",
  lg: "كبير",
  xl: "أكبر",
};

function ReaderPage() {
  const { slug, id } = Route.useParams();
  const articleId = Number(id);
  const meta = catalog.sections.find((section) => section.slug === slug);
  const size = useReading((state) => state.size);
  const setSize = useReading((state) => state.setSize);
  const remember = useReading((state) => state.remember);
  const [section, setSection] = useState<SectionFile | null>(null);
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [missingBody, setMissingBody] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancel = false;
    setSection(null);
    setBlocks(null);
    setMissingBody(false);
    setError("");
    loadSection(slug)
      .then((data) => {
        if (cancel) return;
        setSection(data);
        const located = locateDoc(data.tree, articleId);
        const doc = located?.node.docs[located.index];
        if (!doc) {
          setError("هذا العنوان غير موجود في القسم.");
          return;
        }
        remember({ slug, id: articleId, title: doc.title });
        if (!doc.body) {
          setMissingBody(true);
          return;
        }
        return loadBody(articleId).then((body) => {
          if (!cancel) setBlocks(body.blocks);
        });
      })
      .catch((err: unknown) => {
        if (!cancel) setError(err instanceof Error ? err.message : "تعذر الفتح");
      });
    return () => {
      cancel = true;
    };
  }, [slug, articleId, remember]);

  const located = section ? locateDoc(section.tree, articleId) : null;
  const doc = located ? located.node.docs[located.index] : null;
  const prev = located && located.index > 0 ? located.node.docs[located.index - 1] : null;
  const next =
    located && located.index < located.node.docs.length - 1
      ? located.node.docs[located.index + 1]
      : null;
  const crumbs = located ? located.trail.map((node) => node.label) : [];

  return (
    <Shell mark={`/art/topics/${slug}.png`}>
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8">
        <article className="sheet px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <Link to="/" search={{ q: "" }}>
            الفهرس
          </Link>
          <span aria-hidden="true">/</span>
          <Link to="/s/$slug" params={{ slug }} search={{ d: "", only: "" }}>
            {meta?.label ?? "القسم"}
          </Link>
          {crumbs.map((crumb) => (
            <span key={crumb} className="contents">
              <span aria-hidden="true">/</span>
              <span>{crumb}</span>
            </span>
          ))}
        </div>

        <h1 className="display mt-4 text-balance">
          {doc?.title ?? (error ? "غير موجود" : <span className="bone mx-auto mt-2 h-9 w-2/3" />)}
        </h1>
        {doc ? (
          <p className="mt-2 text-sm text-muted">{arNum(doc.chars)} حرفاً في أصل المادة</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="حجم الخط">
          {SIZES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSize(option)}
              className={
                "min-h-11 rounded-full px-4 text-sm " +
                (size === option
                  ? "bg-ink text-parchment"
                  : "panel text-ink")
              }
              aria-pressed={size === option}
            >
              {SIZE_LABEL[option]}
            </button>
          ))}
        </div>

        {error ? <p className="mt-8 text-crimson">{error}</p> : null}

        {!doc && !error ? <SkeletonText /> : null}

        {doc && missingBody ? <MissingText sectionLabel={meta?.label ?? ""} bodies={meta?.bodies ?? 0} /> : null}

        {doc && !missingBody && !blocks && !error ? <SkeletonText /> : null}

        {blocks ? (
          <div className="mt-8">
            <ArticleBody blocks={blocks} size={size} />
          </div>
        ) : null}

        {prev || next ? (
          <nav className="mt-10 grid gap-3 sm:grid-cols-2">
            <Neighbor slug={slug} doc={prev} label="السابق" />
            <Neighbor slug={slug} doc={next} label="التالي" />
          </nav>
        ) : null}
        </article>
      </main>
    </Shell>
  );
}

function MissingText({ sectionLabel, bodies }: { sectionLabel: string; bodies: number }) {
  return (
    <div className="mt-8 rounded-lg bg-paper px-5 py-5">
      <p className="font-serif text-xl">النص غير مرفوع</p>
      <p className="mt-2 leading-relaxed text-muted">
        العنوان في الفهرس، لكن ملفه لم يصل مع هذه النسخة. المتاح للقراءة الآن{" "}
        {arNum(catalog.bodyCount)} مقالاً
        {bodies > 0 ? `، منها ${arNum(bodies)} في ${sectionLabel}` : ""}. يمكن تصفح بقية العناوين والعودة
        عندما يُرفع النص.
      </p>
      <Link
        to="/s/$slug"
        params={{ slug: "11" }}
        search={{ d: "", only: "1" }}
        className="mt-4 inline-flex min-h-11 items-center text-crimson"
      >
        النصوص المتاحة في البدع والهرطقات
      </Link>
    </div>
  );
}

function Neighbor({ slug, doc, label }: { slug: string; doc: Doc | null; label: string }) {
  if (!doc) return <span />;
  return (
    <Link
      to="/r/$slug/$id"
      params={{ slug, id: String(doc.id) }}
      className="panel block px-4 py-3"
    >
      <span className="block text-xs text-muted">{label}</span>
      <span className="mt-1 block font-serif text-lg leading-snug">{doc.title}</span>
    </Link>
  );
}
