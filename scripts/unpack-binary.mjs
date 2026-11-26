import { gunzipSync } from "node:zlib";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(full)));
    else found.push(full);
  }
  return found;
}

const files = await walk(root);
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

const groups = new Map();
for (const file of files) {
  const name = path.basename(file);
  const match = name.match(/^(.*)\.gz\.b64(?:\.(\d+))?$/);
  if (!match) continue;
  const key = path.join(path.dirname(file), match[1]);
  const list = groups.get(key) ?? [];
  list.push(file);
  groups.set(key, list);
}

for (const [target, parts] of groups) {
  parts.sort();
  try {
    const text = (await Promise.all(parts.map((part) => readFile(part, "utf8")))).join("");
    const json = gunzipSync(Buffer.from(text.replace(/\s/g, ""), "base64"));
    await writeFile(target, json);
    wrote += 1;
  } catch (err) {
    console.warn(`[unpack] skipped ${target}: ${err.message}`);
  }
}

if (wrote) console.log(`[unpack] wrote ${wrote} files`);
