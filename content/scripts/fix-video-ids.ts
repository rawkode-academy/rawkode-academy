#!/usr/bin/env bun
// Fix video markdown files whose `id:` field was YAML-folded to "<cuid> <slug>"
// (an upstream import joined two lines into one folded scalar). Truncate id to
// just the leading cuid.
//
// Idempotent: if id already looks like a single token (no whitespace), the
// file is untouched.

import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const VIDEOS_DIR = join(__dirname, "..", "videos");

async function walk(dir: string): Promise<string[]> {
	const out: string[] = [];
	const entries = await readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...(await walk(full)));
		else if (entry.isFile() && /\.md$/.test(entry.name)) out.push(full);
	}
	return out;
}

let fixed = 0;
let scanned = 0;
for (const path of await walk(VIDEOS_DIR)) {
	scanned++;
	const raw = await readFile(path, "utf8");
	const parsed = matter(raw);
	const id = (parsed.data as { id?: unknown }).id;
	if (typeof id !== "string") continue;
	if (!/\s/.test(id)) continue;
	const cleanId = id.split(/\s+/)[0];
	const newData = { ...(parsed.data as Record<string, unknown>), id: cleanId };
	const out = matter.stringify(parsed.content, newData);
	await writeFile(path, out, "utf8");
	console.log(
		`fixed ${path}\n  id: ${JSON.stringify(id)} -> ${JSON.stringify(cleanId)}`,
	);
	fixed++;
}
console.log(`\nDone. scanned=${scanned} fixed=${fixed}`);
