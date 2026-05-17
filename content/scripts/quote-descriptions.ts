#!/usr/bin/env bun
// One-off cleanup: some video frontmatters have `description:` lines that
// contain a bare colon (e.g. "UI: Data") followed by a space. YAML treats that
// as a key-value separator and the file fails to parse. Re-emit any such
// description through gray-matter so it gets quoted/folded properly.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const VIDEOS_DIR = join(__dirname, "..", "videos");

async function walk(dir: string): Promise<string[]> {
	const out: string[] = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...(await walk(full)));
		else if (entry.isFile() && /\.md$/.test(entry.name)) out.push(full);
	}
	return out;
}

let fixed = 0;
for (const path of await walk(VIDEOS_DIR)) {
	const raw = await readFile(path, "utf8");
	let parsed;
	try {
		parsed = matter(raw);
	} catch (error) {
		console.log(`UNPARSEABLE: ${path} — ${(error as Error).message}`);
		continue;
	}
	const desc = (parsed.data as { description?: unknown }).description;
	if (typeof desc !== "string") continue;
	// gray-matter.stringify always emits a YAML-safe representation; if the
	// current on-disk file already has a safely-quoted form, the rewrite
	// is a no-op except for the description line.
	const out = matter.stringify(parsed.content, parsed.data);
	if (out !== raw) {
		await writeFile(path, out, "utf8");
		fixed++;
		console.log(`fixed ${path}`);
	}
}
console.log(`\nDone. fixed=${fixed}`);
