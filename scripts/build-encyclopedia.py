"""Build the encyclopedia index from attachments/catalog-2.json and attachments/*.txt.

Matching is by the article path's file name. When several articles share that
name, the file is named "<stem>__<id>.txt". The first non-empty line must be
the catalog title, or a close Arabic variant of it.

An English paragraph followed by a paragraph that starts with وترجمته or
ومعناه (including the feminine وترجمتها / ومعناها) becomes a side-by-side
pair. If that cue is the whole paragraph, the following Arabic paragraph is
the translation.
"""

from __future__ import annotations

import difflib
import json
import os
import re
import shutil
import sys
from collections import Counter, defaultdict

from encyclopedia_cleanup import TITLE_OVERRIDES, norm as norm_text, clean as clean_text

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Review lists of what the cleanup removed or renamed. attachments/ is not in git.
CLEANUP_REPORT = os.path.join(ROOT, "attachments", "_cleanup-report.tsv")
SAME_TITLES_REPORT = os.path.join(ROOT, "attachments", "_same-titles.tsv")
ATTACH = os.path.join(ROOT, "attachments")
CATALOG_PATH = os.path.join(ATTACH, "catalog-2.json")
DATA = os.path.join(ROOT, "public", "data")
BODIES = os.path.join(DATA, "bodies")
SECTIONS = os.path.join(DATA, "sections")
SEARCH_PATH = os.path.join(DATA, "search.json")
CATALOG_TS = os.path.join(ROOT, "src", "data", "catalog.ts")
MAX_BYTES = 100 * 1024 * 1024
# Article files go in folders of 100 (id 18800 -> bodies/188/18800.json) so no
# folder holds more than 100 files. Must match bodyPath() in src/lib/encyclopedia.ts.
BODY_FOLDER_SIZE = 100


def body_path(index: int) -> str:
    return os.path.join(BODIES, str(index // BODY_FOLDER_SIZE), f"{index}.json")


def clear_output() -> None:
    """Remove earlier output so no stale article or packed copy is left behind."""
    for folder in (BODIES, SECTIONS):
        if os.path.isdir(folder):
            shutil.rmtree(folder)
    for name in os.listdir(DATA) if os.path.isdir(DATA) else []:
        if name == "search.json" or name.startswith("search.json.gz.b64"):
            os.remove(os.path.join(DATA, name))
SKIP_SECTIONS = {"no_file.html"}

# Labels already used by the section cards. Slugs stay in this order.
SECTION_LABELS = [
    ("02", "02-تفسير الكتاب المقدس", "التفسير"),
    ("05", "05-شبهات الكتاب المقدس", "الشبهات والردود"),
    ("06", "06-مسابقات الكتاب المقدس", "مسابقات"),
    ("07", "07-شخصيات الكتاب المقدس", "شخصيات الكتاب"),
    ("09", "09-مريم العذراء القديسة", "العذراء مريم"),
    ("11", "11-بدع وهرطقات", "البدع والهرطقات"),
    ("12", "12-كتب ابوكريفا", "الأبوكريفا"),
    ("13", "13-اسئلة مسيحية", "أسئلة مسيحية"),
    ("14", "14-علم الاباء", "علم الآباء"),
    ("15", "15-علم الاخرويات", "الأخرويات"),
    ("16", "16-علم الانسان", "علم الإنسان"),
    ("17", "17-علم التاريخ", "التاريخ الكنسي"),
    ("18", "18-علم الخلاص", "الخلاص"),
    ("19", "19-علم الكتاب المقدس", "علوم الكتاب"),
    ("20", "20-علم الكنيسة", "الكنيسة"),
    ("21", "21-علم الله", "الله"),
    ("22", "22-علم المسيح", "المسيح"),
    ("23", "23-علم الملائكة", "الملائكة"),
    ("24", "24-اللاهوت الادبي", "اللاهوت الأدبي"),
    ("25", "25-اللاهوت الدستوري", "اللاهوت الدستوري"),
    ("26", "26-اللاهوت الدفاعي", "اللاهوت الدفاعي"),
    ("27", "27-اللاهوت الرعوي", "اللاهوت الرعوي"),
    ("28", "28-اللاهوت الروحي", "اللاهوت الروحي"),
    ("29", "29-اللاهوت الطقسي", "اللاهوت الطقسي"),
    ("30", "30-اللاهوت العقيدي", "اللاهوت العقيدي"),
    ("31", "31-اللاهوت المقارن", "اللاهوت المقارن"),
    ("32", "32-اللاهوت النظري", "اللاهوت النظري"),
    ("33", "33-المسيحية والاسلام", "المسيحية والإسلام"),
    ("bible", "bible", "نصوص الكتاب المقدس"),
]

MARKER_RE = re.compile(r"^(?:وترجمتها|وترجمته|ومعناها|ومعناه)(?=$|[\s:：،,.\-–])")
TITLE_TRANS = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ة": "ه", "ى": "ي", "ؤ": "و", "ئ": "ي"})


def norm_title(value: str) -> str:
    value = value.replace("\u0640", "")
    value = re.sub(r"[\u064B-\u0652\u0670]", "", value)
    value = value.translate(TITLE_TRANS)
    value = re.sub(r"[^\u0600-\u06FFa-zA-Z0-9\s]", " ", value)
    return re.sub(r"\s+", " ", value).strip().lower()


def titles_close(left: str, right: str) -> bool:
    if left.strip() == right.strip():
        return True
    a, b = norm_title(left), norm_title(right)
    if not a or not b:
        return False
    if a == b:
        return True
    if a in b or b in a:
        return min(len(a), len(b)) / max(len(a), len(b)) >= 0.82
    return difflib.SequenceMatcher(None, a, b).ratio() >= 0.92


def stem_of(path: str) -> str:
    name = path.replace("\\", "/").split("/")[-1]
    return os.path.splitext(name)[0]


def slug_of(section: str) -> str:
    if section == "bible":
        return "bible"
    match = re.match(r"^(\d+)", section)
    return match.group(1) if match else section


def paragraphs(text: str) -> list[str]:
    chunks = re.split(r"\n\s*\n", text.replace("\r\n", "\n").replace("\r", "\n"))
    result = []
    for chunk in chunks:
        lines = [line.strip() for line in chunk.split("\n") if line.strip()]
        if lines:
            result.append(" ".join(lines))
    return result


def letter_counts(value: str) -> tuple[int, int]:
    latin = arabic = 0
    for char in value:
        if "A" <= char <= "Z" or "a" <= char <= "z":
            latin += 1
        elif "\u0600" <= char <= "\u06FF":
            arabic += 1
    return latin, arabic


def is_english(value: str) -> bool:
    latin, arabic = letter_counts(value)
    return latin >= 12 and latin > arabic * 2


def is_arabic(value: str) -> bool:
    latin, arabic = letter_counts(value)
    return arabic >= 8 and arabic >= latin


def to_blocks(paras: list[str]) -> list[dict]:
    blocks: list[dict] = []
    index = 0
    while index < len(paras):
        para = paras[index]
        if is_english(para) and index + 1 < len(paras) and MARKER_RE.match(paras[index + 1]):
            arabic = paras[index + 1]
            step = 2
            if letter_counts(arabic)[1] < 12 and index + 2 < len(paras) and is_arabic(paras[index + 2]):
                arabic = f"{arabic} {paras[index + 2]}"
                step = 3
            if letter_counts(arabic)[1] >= 8:
                blocks.append({"t": "pair", "en": para, "ar": arabic})
                index += step
                continue
        if is_english(para):
            blocks.append({"t": "en", "x": para})
        else:
            blocks.append({"t": "ar", "x": para})
        index += 1
    return blocks


def read_txt(path: str) -> str:
    with open(path, "rb") as handle:
        data = handle.read()
    if data.startswith(b"\xef\xbb\xbf"):
        data = data[3:]
    return data.decode("utf-8").replace("\r\n", "\n").replace("\r", "\n")


def first_line(text: str) -> str:
    for line in text.split("\n"):
        if line.strip():
            return line.strip()
    return ""


def dump_checked(path: str, payload: str) -> None:
    size = len(payload.encode("utf-8"))
    if size > MAX_BYTES:
        raise SystemExit(
            f"Stopped: {os.path.relpath(path, ROOT)} would be {size / 1024 / 1024:.1f} MB, over 100 MB."
        )
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(payload)


def existing_read_ids() -> list[int]:
    if not os.path.isfile(CATALOG_TS):
        return []
    text = open(CATALOG_TS, encoding="utf-8").read()
    match = re.search(r'"reads"\s*:\s*\[(.*?)\]\s*\}\s*as\s*\{', text, re.S)
    if not match:
        return []
    return [int(value) for value in re.findall(r'"id"\s*:\s*(\d+)', match.group(1))]


def folder_label(name: str) -> str:
    cleaned = re.sub(r"^\d+-", "", name).strip()
    return cleaned or name


def new_node(name: str, label: str) -> dict:
    return {"name": name, "label": label, "count": 0, "bodies": 0, "dirs": [], "docs": []}


def recount(node: dict) -> tuple[int, int]:
    count = len(node["docs"])
    bodies = sum(1 for doc in node["docs"] if doc["body"])
    for child in node["dirs"]:
        child_count, child_bodies = recount(child)
        count += child_count
        bodies += child_bodies
    node["count"] = count
    node["bodies"] = bodies
    return count, bodies


def write_cleanup_reports(log: list[tuple], trees: dict, label_by_section: dict) -> None:
    """Write what the cleanup changed, and same-named titles in one folder, for review."""
    tsv = lambda value: str(value).replace("\t", " ").replace("\n", " ")[:200]
    with open(CLEANUP_REPORT, "w", encoding="utf-8", newline="\n") as handle:
        handle.write("id\tkind\ttext\n")
        for article_id, kind, text in log:
            handle.write(f"{article_id}\t{kind}\t{tsv(text)}\n")

    rows = []

    def walk(node: dict, trail: list[str], section_label: str) -> None:
        groups: dict[str, list[dict]] = defaultdict(list)
        for doc in node["docs"]:
            groups[norm_text(doc["title"])].append(doc)
        for docs in groups.values():
            if len(docs) > 1:
                where = " / ".join([section_label, *trail])
                for doc in docs:
                    rows.append((where, doc["id"], doc["title"]))
        for child in node["dirs"]:
            walk(child, trail + [child["label"]], section_label)

    for name, tree in trees.items():
        walk(tree, [], label_by_section.get(name, (None, name))[1])
    with open(SAME_TITLES_REPORT, "w", encoding="utf-8", newline="\n") as handle:
        handle.write("folder\tid\ttitle\n")
        for where, doc_id, title in rows:
            handle.write(f"{tsv(where)}\t{doc_id}\t{tsv(title)}\n")

    kinds = Counter(kind for _, kind, _ in log)
    touched = len({article_id for article_id, kind, _ in log if kind != "retitle"})
    print("cleanup", dict(kinds), "articles touched", touched)
    print("same-named titles in one folder", len(rows))
    print("reports", os.path.relpath(CLEANUP_REPORT, ROOT), os.path.relpath(SAME_TITLES_REPORT, ROOT))


def main() -> None:
    if not os.path.isfile(CATALOG_PATH):
        raise SystemExit(f"Missing catalog: {CATALOG_PATH}")
    catalog = json.load(open(CATALOG_PATH, encoding="utf-8"))
    articles = catalog["articles"]
    by_stem: dict[str, list[int]] = {}
    for index, article in enumerate(articles):
        by_stem.setdefault(stem_of(article["path"]), []).append(index)

    assigned: dict[int, str] = {}
    rejected: list[str] = []
    stray: list[str] = []
    txt_count = 0
    for name in sorted(os.listdir(ATTACH)):
        if not name.lower().endswith(".txt"):
            continue
        txt_count += 1
        stem = name[:-4]
        index = None
        suffixed = re.fullmatch(r"(.+)__(\d+)", stem)
        if suffixed:
            base, raw_id = suffixed.group(1), int(suffixed.group(2))
            if 0 <= raw_id < len(articles) and stem_of(articles[raw_id]["path"]) == base:
                index = raw_id
        elif stem.isdigit():
            raw_id = int(stem)
            if 0 <= raw_id < len(articles):
                index = raw_id
        else:
            hits = by_stem.get(stem, [])
            if len(hits) == 1:
                index = hits[0]
        if index is None:
            stray.append(name)
            continue
        text = read_txt(os.path.join(ATTACH, name))
        if not titles_close(first_line(text), articles[index]["title"]):
            rejected.append(f"{name} -> {articles[index]['title']}")
            continue
        if index in assigned:
            rejected.append(f"duplicate {name} for id {index}; kept {assigned[index]}")
            continue
        assigned[index] = name

    label_by_section = {name: (slug, label) for slug, name, label in SECTION_LABELS}
    trees: dict[str, dict] = {}
    search: list[list] = []
    body_count = 0
    pair_count = 0
    english_count = 0
    largest = (0, "")
    read_ids = existing_read_ids()
    cleanup_log: list[tuple] = []
    clear_output()
    os.makedirs(BODIES, exist_ok=True)

    for index, article in enumerate(articles):
        section = article["section"]
        if section in SKIP_SECTIONS:
            continue
        slug, label = label_by_section.get(section, (slug_of(section), folder_label(section)))
        if section not in trees:
            trees[section] = new_node("", label)
        parts = article["path"].replace("\\", "/").split("/")
        node = trees[section]
        for folder in parts[1:-1]:
            child = next((item for item in node["dirs"] if item["name"] == folder), None)
            if child is None:
                child = new_node(folder, folder_label(folder))
                node["dirs"].append(child)
            node = child
        has_body = index in assigned
        blocks: list[dict] = []
        title = TITLE_OVERRIDES.get(index, article["title"])
        if has_body:
            paras = paragraphs(read_txt(os.path.join(ATTACH, assigned[index])))
            cleaned, title = clean_text(paras, article["title"], index, cleanup_log)
            if not cleaned and paras:
                # Nothing but the title: show it once rather than "text missing".
                cleaned = [paras[0]]
                cleanup_log.append((index, "kept", paras[0]))
            blocks = to_blocks(cleaned)
            has_body = len(blocks) > 0
        if has_body:
            payload = json.dumps({"blocks": blocks}, ensure_ascii=False, separators=(",", ":"))
            out = body_path(index)
            dump_checked(out, payload)
            size = len(payload.encode("utf-8"))
            if size > largest[0]:
                largest = (size, out)
            body_count += 1
            pair_count += sum(1 for block in blocks if block["t"] == "pair")
            english_count += sum(1 for block in blocks if block["t"] == "en")
        node["docs"].append(
            {
                "id": index,
                "title": title,
                "chars": article["characters"],
                "body": has_body,
            }
        )
        search.append([slug, index, title, 1 if has_body else 0])
        if (index + 1) % 4000 == 0:
            print(f"built {index + 1}/{len(articles)}", flush=True)

    section_meta = []
    known = {name for _, name, _ in SECTION_LABELS}
    ordered = [name for _, name, _ in SECTION_LABELS if name in trees]
    ordered.extend(name for name in trees if name not in known)
    for name in ordered:
        slug, label = label_by_section.get(name, (slug_of(name), folder_label(name)))
        count, bodies = recount(trees[name])
        file_payload = {
            "slug": slug,
            "name": name,
            "label": label,
            "count": count,
            "bodies": bodies,
            "tree": trees[name],
        }
        encoded = json.dumps(file_payload, ensure_ascii=False, separators=(",", ":"))
        out = os.path.join(SECTIONS, f"{slug}.json")
        dump_checked(out, encoded)
        size = len(encoded.encode("utf-8"))
        if size > largest[0]:
            largest = (size, out)
        section_meta.append(
            {"slug": slug, "name": name, "label": label, "count": count, "bodies": bodies}
        )

    search_payload = json.dumps(search, ensure_ascii=False, separators=(",", ":"))
    dump_checked(SEARCH_PATH, search_payload)
    search_size = len(search_payload.encode("utf-8"))
    if search_size > largest[0]:
        largest = (search_size, SEARCH_PATH)

    reads = []
    id_to_slug = {row[1]: row[0] for row in search}
    titles = {row[1]: row[2] for row in search}
    for read_id in read_ids:
        if read_id not in id_to_slug:
            continue
        article = articles[read_id]
        section_label = label_by_section.get(article["section"], (None, folder_label(article["section"])))[1]
        reads.append(
            {
                "slug": id_to_slug[read_id],
                "id": read_id,
                "title": titles[read_id],
                "label": section_label,
                "chars": article["characters"],
            }
        )

    catalog_obj = {
        "articleCount": len(search),
        "bodyCount": body_count,
        "sections": section_meta,
        "reads": reads,
    }
    catalog_ts = (
        "export type SectionMeta = {\n"
        "  slug: string;\n"
        "  name: string;\n"
        "  label: string;\n"
        "  count: number;\n"
        "  bodies: number;\n"
        "};\n\n"
        "export type ReadLink = {\n"
        "  slug: string;\n"
        "  id: number;\n"
        "  title: string;\n"
        "  label: string;\n"
        "  chars: number;\n"
        "};\n\n"
        "export const catalog = "
        + json.dumps(catalog_obj, ensure_ascii=False, indent=2)
        + " as {\n"
        "  articleCount: number;\n"
        "  bodyCount: number;\n"
        "  sections: SectionMeta[];\n"
        "  reads: ReadLink[];\n"
        "};\n"
    )
    dump_checked(CATALOG_TS, catalog_ts)

    write_cleanup_reports(cleanup_log, trees, label_by_section)

    title_only = len(search) - body_count
    print("articles", len(search))
    print("txt files", txt_count)
    print("bodies", body_count)
    print("title only", title_only)
    print("pairs", pair_count)
    print("english blocks", english_count)
    print("stray txt", len(stray))
    print("rejected", len(rejected))
    print("largest", largest[0], os.path.relpath(largest[1], ROOT) if largest[1] else "")
    if stray:
        print("stray sample", stray[:12])
    if rejected:
        print("rejected sample", rejected[:12])


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:
        sys.exit(1)
