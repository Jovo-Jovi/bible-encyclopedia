// Decodes the images stored as base64 text (public/**/name.png.b64 -> name.png)
// before `vite build`, so icons, decorations and the share card ship as real files.
//
// public/data is skipped: the encyclopedia JSON is committed as plain files and
// regenerated only by scripts/build-encyclopedia.py. Old packed copies
// (*.gz.b64) are never decoded, so they can't overwrite the current text.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const publicDir = path.resolve(import.meta.dirname, "..", "public");
const skipDirs = new Set([path.join(publicDir, "data")]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirs.has(full)) found.push(...(await walk(full)));
    } else {
      found.push(full);
    }
  }
  return found;
}

const files = await walk(publicDir);
let wrote = 0;

for (const file of files) {
  if (!file.endsWith(".b64") || file.includes(".gz.b64")) continue;
  const text = await readFile(file, "utf8");
  try {
    await writeFile(file.slice(0, -4), Buffer.from(text.replace(/\s/g, ""), "base64"));
    wrote += 1;
  } catch (err) {
    console.warn(`[unpack] skipped ${file}: ${err.message}`);
  }
}

console.log(`[unpack] wrote ${wrote} files`);
