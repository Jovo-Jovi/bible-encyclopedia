"""Remove leftovers from the article texts before they are published.

Used by build-encyclopedia.py. The source texts in attachments/ are never
changed; only the generated JSON is cleaned, so every rule can be undone by
editing this file and rebuilding.

What is removed, per article:

1. Metadata lines left by Word and Excel exports, such as
   "MicrosoftInternetExplorer4", "Normal Clean 6 pt 2", "9.35 pt 13.75 pt",
   "* 2009-11-29T04:16:43Z" or "False False False". They have strict
   signatures and never contain Arabic letters.
2. Lines of bare numbers and Excel sheet names ("435", "que") that sit inside
   that metadata block at the top. Numbers after the block (a numbered
   question list, for example) are kept.
3. Copies of the title at the very top. The page already shows the title as
   its heading.

Everything else is kept: real headings that repeat further down an article,
and repeated table cells ("X", "نعم", "نؤمن") whose repetition is the content.

Titles that are themselves leftovers ("Normal", "*", "o أحوال") are replaced
by the article's first real line, or by an entry in TITLE_OVERRIDES.
"""

from __future__ import annotations

import re

ARABIC = re.compile(r"[\u0600-\u06FF]")
# Each pattern matches a whole paragraph with no Arabic letters in it.
SIGNATURES = [
    re.compile(r"MicrosoftInternetExplorer\d", re.I),
    re.compile(r"^(?:Normal|Clean)(?:\s+(?:Normal|Clean|[\d.]+|pt|[\d.]+pt))*$", re.I),
    re.compile(r"^(?:(?:Normal|Clean)\s+)*(?:[\d.]+\s*pt\s*)+(?:[\d.]+\s*)*$", re.I),
    re.compile(r"^\*?\s*\d{4}-\d\d-\d\dT\d\d:\d\d"),
    re.compile(r"^(?:[\d.]+\s+)*(?:(?:False|True)\s*)+(?:[\d.]+\s*)*$", re.I),
    re.compile(r"\$[A-Z]*\$?\d+:\$"),
    re.compile(r"=\w+!\$"),
]
HEADER_WINDOW = 20
# Inside the metadata block only: numbers and Excel sheet names, nothing with words.
HEADER_LEFTOVER = re.compile(r"^(?:[\d.\s$:,=!-]+|que|question|BIGSOL)$", re.I)
FOOTNOTE = re.compile(r"\[\d+\]")
TRANS = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ة": "ه", "ى": "ي", "ؤ": "و", "ئ": "ي"})
# "Normal…" and "*" come from Word/Excel; "o" before Arabic is a Word bullet.
JUNK_TITLE = re.compile(r"^(?:Normal\b.*|\*+|o\s*[؀-ۿ].*|\W*)$")
TITLE_MAX = 90

# Titles that can't be read from the text itself.
TITLE_OVERRIDES = {
    4091: "أسئلة في الكتاب المقدس (١)",
    4092: "أسئلة في الكتاب المقدس (٢)",
    10823: "المسيح حياته وأعماله (٣٩)",
}


def norm(value: str) -> str:
    value = FOOTNOTE.sub(" ", value)
    value = value.replace("\u0640", "")
    value = re.sub(r"[\u064B-\u0652\u0670]", "", value)
    value = value.translate(TRANS)
    value = re.sub(r"[^\u0600-\u06FFa-zA-Z0-9\s]", " ", value)
    value = re.sub(r"\s+", " ", value).strip().lower()
    return re.sub(r"^\d+\s*", "", value)


def is_signature(para: str) -> bool:
    if ARABIC.search(para):
        return False
    text = para.strip()
    return any(pattern.search(text) for pattern in SIGNATURES)


def is_junk_title(title: str) -> bool:
    return bool(JUNK_TITLE.match(title.strip()))


def short_title(text: str) -> str:
    text = re.sub(r"^o\s*", "", text.strip())
    if len(text) <= TITLE_MAX:
        return text
    cut = text[:TITLE_MAX].rsplit(" ", 1)[0]
    return cut + "…"


def clean(paras: list[str], title: str, article_id: int, log: list[tuple]) -> tuple[list[str], str]:
    """Return the cleaned paragraphs and the title to publish.

    Each removal is appended to `log` as (id, kind, text).
    """
    # 1-2. Metadata block at the top, then signatures anywhere.
    header_end = -1
    for i, para in enumerate(paras[:HEADER_WINDOW]):
        if is_signature(para):
            header_end = i
    kept: list[str] = []
    for i, para in enumerate(paras):
        if is_signature(para):
            log.append((article_id, "metadata", para))
            continue
        if i < header_end and HEADER_LEFTOVER.match(para.strip()):
            log.append((article_id, "metadata", para))
            continue
        kept.append(para)

    # A leftover title takes the first real line of the text.
    new_title = title
    if article_id in TITLE_OVERRIDES:
        new_title = TITLE_OVERRIDES[article_id]
    elif is_junk_title(title):
        # A Word bullet ("oأحوال") is fine here: short_title drops the "o".
        first = next((p for p in kept if ARABIC.search(p)), None)
        first = first or next((p for p in kept if len(p) > 3), None)
        if first:
            new_title = short_title(first)
    if new_title != title:
        log.append((article_id, "retitle", f"{title} -> {new_title}"))

    # 3. Copies of the title at the top. A shortened title also matches the
    # full line it was cut from, so that line goes too.
    target = norm(new_title.rstrip("…"))
    while kept and target and (norm(kept[0]) == target or (new_title.endswith("…") and norm(kept[0]).startswith(target))):
        log.append((article_id, "title", kept.pop(0)))

    # Other repeated paragraphs are left alone: most are table cells ("X",
    # "نعم", "نؤمن") whose repetition is the content.
    return kept, new_title
