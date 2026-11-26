"""Copy encyclopedia article texts into attachments/ as one UTF-8 .txt per title.

The catalog index is written to attachments/catalog-2.json. Article id is the
index in "articles". Texts come from the extracted encyclopedia. The heresy
app is reported against those same titles and is not copied over an article
that already has its encyclopedia text.
"""

from __future__ import annotations

import json
import os
import re
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENCY = r"C:\Users\Marco\Desktop\extracted-apps\bible-encyclopedia"
BIDAA = r"C:\Users\Marco\Desktop\extracted-apps\bidaa-wa-hartaqat"
ATTACH = os.path.join(ROOT, "attachments")
SKIP = {"no_file.html"}
ORPHAN_PHRASES = ("أفلوطين", "بلاجيوس", "ماسون", "ملخص المورمون")
TITLE_TRANS = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ة": "ه", "ى": "ي", "ؤ": "و", "ئ": "ي"})


def norm(value: str) -> str:
    value = value.replace("\u0640", "")
    value = re.sub(r"[\u064B-\u0652\u0670]", "", value)
    value = value.translate(TITLE_TRANS)
    value = re.sub(r"[^\u0600-\u06FFa-zA-Z0-9\s]", " ", value)
    return re.sub(r"\s+", " ", value).strip().lower()


def source_path(article: dict) -> str:
    parts = article["text"].replace("\\", "/").split("/")
    return os.path.join(ENCY, *parts)


def read_source(path: str) -> bytes:
    candidates = [path]
    if not os.path.isfile(path):
        candidates.append("\\\\?\\" + os.path.abspath(path))
    for candidate in candidates:
        if os.path.isfile(candidate):
            with open(candidate, "rb") as handle:
                data = handle.read()
            if data.startswith(b"\xef\xbb\xbf"):
                data = data[3:]
            return data.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
    raise FileNotFoundError(path)


def first_line(data: bytes) -> str:
    for raw in data.split(b"\n"):
        line = raw.decode("utf-8").strip()
        if line:
            return line
    return ""


def stem_of(path: str) -> str:
    return os.path.splitext(os.path.basename(path.replace("\\", "/")))[0]


def bidaa_key(title: str) -> str:
    value = norm(title)
    value = re.sub(r"^(بدعه|هرطقه)\s+", "", value)
    value = re.sub(r"\s+\d+$", "", value)
    return re.sub(r"\s+", " ", value).strip()


def main() -> None:
    catalog = json.load(open(os.path.join(ENCY, "catalog.json"), encoding="utf-8"))
    articles = catalog["articles"]
    os.makedirs(ATTACH, exist_ok=True)
    slim = [
        {
            "title": article["title"],
            "section": article["section"],
            "path": article["path"].replace("\\", "/"),
            "characters": article["characters"],
        }
        for article in articles
    ]
    with open(os.path.join(ATTACH, "catalog-2.json"), "w", encoding="utf-8", newline="\n") as handle:
        json.dump({"articles": slim}, handle, ensure_ascii=False, separators=(",", ":"))

    stems: dict[str, list[int]] = defaultdict(list)
    for index, article in enumerate(articles):
        stems[stem_of(article["path"])].append(index)

    written = 0
    long_paths = 0
    title_fixed = 0
    decoded_cp = 0
    skipped = 0
    phrase_hits = {phrase: [] for phrase in ORPHAN_PHRASES}
    largest = 0

    for index, article in enumerate(articles):
        if article["section"] in SKIP:
            skipped += 1
            continue
        path = source_path(article)
        if not os.path.isfile(path):
            long_paths += 1
        data = read_source(path)
        try:
            data.decode("utf-8")
        except UnicodeDecodeError:
            text = data.decode("cp1256")
            data = text.encode("utf-8")
            decoded_cp += 1
        title = article["title"].strip()
        if first_line(data) != title:
            text = data.decode("utf-8")
            lines = text.split("\n")
            for line_index, line in enumerate(lines):
                if line.strip():
                    lines[line_index] = title
                    break
            else:
                lines.insert(0, title)
            data = "\n".join(lines).encode("utf-8")
            title_fixed += 1
        if not data.endswith(b"\n"):
            data += b"\n"
        if len(data) > largest:
            largest = len(data)
        if len(data) > 100 * 1024 * 1024:
            raise SystemExit(f"Stopped: article {index} is over 100 MB.")
        text_for_scan = None
        for phrase in ORPHAN_PHRASES:
            if len(phrase_hits[phrase]) >= 5:
                continue
            raw = phrase.encode("utf-8")
            if raw in data:
                if text_for_scan is None:
                    text_for_scan = data.decode("utf-8")
                phrase_hits[phrase].append(index)
        stem = stem_of(article["path"])
        name = f"{stem}.txt" if len(stems[stem]) == 1 else f"{stem}__{index}.txt"
        with open(os.path.join(ATTACH, name), "wb") as handle:
            handle.write(data)
        written += 1
        if written % 4000 == 0:
            print(f"staged {written}", flush=True)

    bidaa = json.load(open(os.path.join(BIDAA, "catalog.json"), encoding="utf-8"))
    keys: dict[str, list[int]] = defaultdict(list)
    for index, article in enumerate(articles):
        if article["section"] in SKIP:
            continue
        keys[bidaa_key(article["title"])].append(index)
        keys[norm(article["title"])].append(index)
    def lookup(title: str) -> list[int]:
        key = bidaa_key(title)
        hits = list(dict.fromkeys(keys.get(key, []) + keys.get(norm(title), [])))
        if hits or len(key) < 8:
            return hits
        extra: list[int] = []
        for catalog_key, ids in keys.items():
            if catalog_key.startswith(key) and (len(catalog_key) == len(key) or catalog_key[len(key)] == " "):
                extra.extend(ids)
            elif key.startswith(catalog_key) and len(catalog_key) >= 10 and (
                len(key) == len(catalog_key) or key[len(catalog_key)] == " "
            ):
                extra.extend(ids)
        return list(dict.fromkeys(extra))

    placed = []
    homeless = []
    for article in bidaa["articles"]:
        hits = lookup(article["title"])
        section_11 = [hit for hit in hits if articles[hit]["section"].startswith("11-")]
        chosen = section_11[0] if section_11 else (hits[0] if hits else None)
        if chosen is None:
            homeless.append(article["title"])
        else:
            placed.append((article["title"], chosen, articles[chosen]["title"]))

    print("catalog", len(articles))
    print("written", written)
    print("skipped section", skipped)
    print("long paths", long_paths)
    print("titles adjusted", title_fixed)
    print("cp1256", decoded_cp)
    print("largest txt", largest)
    print("bidaa", len(bidaa["articles"]))
    print("bidaa placed beside existing text", len(placed))
    print("bidaa without catalog title", len(homeless))
    for title in homeless:
        print(" homeless:", title)
    for phrase, hits in phrase_hits.items():
        print(" phrase", phrase, hits)


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:
        sys.exit(1)
