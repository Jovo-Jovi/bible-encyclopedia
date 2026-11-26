import type { Block } from "@/lib/encyclopedia";
import type { FontSize } from "@/lib/reading";

export function ArticleBody({ blocks, size }: { blocks: Block[]; size: FontSize }) {
  const bilingual = blocks.some((block) => block.t === "en" || block.t === "pair");

  return (
    <div className="reader" data-size={size}>
      {bilingual ? (
        <p className="mb-6 text-sm text-muted">العربي في المتن، والإنجليزي في إطار حيث ورد في الأصل.</p>
      ) : null}
      <div className="space-y-5">
        {blocks.map((block, index) => {
          if (block.t === "pair") {
            return (
              <figure key={index} className="quote overflow-hidden">
                <blockquote className="border-b border-line px-4 py-4" dir="ltr" lang="en">
                  <span className="mb-2 block font-sans text-xs not-italic text-muted">English</span>
                  <p className="reader-en text-ink">{block.en}</p>
                </blockquote>
                <figcaption className="px-4 py-4">
                  <span className="mb-2 block font-sans text-xs text-crimson">الترجمة</span>
                  <p className="reader-copy text-ink">{block.ar}</p>
                </figcaption>
              </figure>
            );
          }
          if (block.t === "en") {
            return (
              <blockquote
                key={index}
                dir="ltr"
                lang="en"
                className="quote px-4 py-4"
              >
                <span className="mb-2 block font-sans text-xs not-italic text-muted">English</span>
                <p className="reader-en text-ink">{block.x}</p>
              </blockquote>
            );
          }
          return (
            <p key={index} className="reader-copy text-ink">
              {block.x}
            </p>
          );
        })}
      </div>
    </div>
  );
}
