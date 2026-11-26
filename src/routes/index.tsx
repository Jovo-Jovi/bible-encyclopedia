import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/shell";
import { SkeletonRows } from "@/components/skeleton";
import { catalog, type SectionMeta } from "@/data/catalog";
import { arNum, GROUPS, loadSearch, normalizeAr } from "@/lib/encyclopedia";
import { useReading } from "@/lib/reading";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q.slice(0, 80) : "",
  }),
  component: Home,
});

type Hit = { slug: string; id: number; title: string; body: boolean; norm: string };

function Home() {
  const { q } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const recent = useReading((state) => state.recent);
  const [index, setIndex] = useState<Hit[] | null>(null);
  const [limit, setLimit] = useState(30);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancel = false;
    loadSearch()
      .then((rows) => {
        if (cancel) return;
        setIndex(
          rows.map(([slug, id, title, body]) => ({
            slug,
            id,
            title,
            body: body === 1,
            norm: normalizeAr(title),
          })),
        );
      })
      .catch(() => {
        if (!cancel) setFailed(true);
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    setLimit(30);
  }, [q]);

  const query = normalizeAr(q);
  const hits = useMemo(() => {
    if (!index || query.length < 2) return [];
    const found: Hit[] = [];
    for (const row of index) {
      if (row.norm.includes(query)) found.push(row);
    }
    return found;
  }, [index, query]);

  const bySlug = new Map(catalog.sections.map((section) => [section.slug, section]));

  return (
    <Shell>
      <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-12">
        <h1 className="display text-center">موسوعة الكتاب المقدس</h1>
        <span className="flourish" aria-hidden="true" />

        <label className="field-box mx-auto mt-8 max-w-2xl">
          <Search className="size-5 shrink-0 text-crimson" aria-hidden="true" />
          <input
            value={q}
            onChange={(event) => {
              void navigate({
                search: { q: event.target.value },
                replace: true,
              });
            }}
            placeholder="ابحث في العناوين: أبوليناريوس، التكوين، شهود يهوه…"
            className="w-full bg-transparent text-base text-ink outline-none placeholder:text-muted"
            enterKeyHint="search"
          />
        </label>

        {query.length >= 2 ? (
          <SearchResults
            ready={index !== null}
            failed={failed}
            hits={hits}
            limit={limit}
            onMore={() => setLimit((value) => value + 30)}
          />
        ) : (
          <>
            {recent.length > 0 ? (
              <section className="mt-8">
                <h2 className="font-serif text-xl">تابعت مؤخراً</h2>
                <ul className="panel mt-3 divide-y divide-line overflow-hidden">
                  {recent.slice(0, 5).map((item) => (
                    <li key={item.id}>
                      <Link
                        to="/r/$slug/$id"
                        params={{ slug: item.slug, id: String(item.id) }}
                        className="row-hover block min-h-11 px-4 py-3"
                      >
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {GROUPS.map((group) => (
              <section key={group.id} className="mt-10">
                <h2 className="font-serif text-xl">{group.title}</h2>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.slugs.map((slug) => {
                    const section = bySlug.get(slug);
                    if (!section) return null;
                    return (
                      <li key={slug}>
                        <SectionCard section={section} />
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}

            <p className="mt-12 text-sm leading-relaxed text-muted">
              للاستخدام الشخصي كما سمح به صاحب المادة، وليست لإعادة النشر التجاري.
            </p>
          </>
        )}
      </main>
    </Shell>
  );
}

function SectionCard({ section }: { section: SectionMeta }) {
  return (
    <Link
      to="/s/$slug"
      params={{ slug: section.slug }}
      search={{ d: "", only: "" }}
      className="panel topic-card flex h-full flex-col justify-between px-5 py-5 pe-28"
    >
      <img src={`/art/topics/${section.slug}.png`} alt="" className="topic-art" />
      <span className="relative font-serif text-xl leading-snug">{section.label}</span>
      <span className="relative mt-6 flex items-center justify-between gap-2 text-sm text-muted">
        <span>{arNum(section.count)} عنواناً</span>
        {section.bodies > 0 ? (
          <span className="chip">{arNum(section.bodies)} نص</span>
        ) : (
          <span className="text-xs">فهرس</span>
        )}
      </span>
    </Link>
  );
}

function SearchResults({
  ready,
  failed,
  hits,
  limit,
  onMore,
}: {
  ready: boolean;
  failed: boolean;
  hits: Hit[];
  limit: number;
  onMore: () => void;
}) {
  if (failed) {
    return <p className="mt-6 text-muted">تعذر تحميل الفهرس.</p>;
  }
  if (!ready) {
    return <SkeletonRows count={7} />;
  }
  if (hits.length === 0) {
    return <p className="mt-6 text-muted">لا عنوان يطابق هذا البحث.</p>;
  }
  const shown = hits.slice(0, limit);
  return (
    <section className="mt-6">
      <p className="text-sm text-muted">{arNum(hits.length)} عنواناً</p>
      <ul className="panel mt-3 divide-y divide-line overflow-hidden">
        {shown.map((hit) => (
          <li key={hit.id}>
            <Link
              to="/r/$slug/$id"
              params={{ slug: hit.slug, id: String(hit.id) }}
              className="row-hover flex min-h-11 items-center justify-between gap-3 px-4 py-3"
            >
              <span className="min-w-0">
                <span className="block leading-snug">{hit.title}</span>
                <span className="text-xs text-muted">
                  {catalog.sections.find((section) => section.slug === hit.slug)?.label}
                </span>
              </span>
              <span className="shrink-0 text-xs text-crimson">{hit.body ? "نص" : "فهرس"}</span>
            </Link>
          </li>
        ))}
      </ul>
      {shown.length < hits.length ? (
        <button
          type="button"
          onClick={onMore}
          className="panel mt-3 min-h-11 px-4 text-sm"
        >
          المزيد
        </button>
      ) : null}
    </section>
  );
}
