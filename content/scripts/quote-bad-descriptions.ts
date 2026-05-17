#!/usr/bin/env bun
// Quote any frontmatter `description:` value that contains an unquoted ": "
// (colon-space) sequence — YAML treats that as a mapping key separator and
// the file fails to parse.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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
	// Look for the description line in the frontmatter
	const m = raw.match(/^(description: )([^'>|"].*: .*)$/m);
	if (!m) continue;
	const value = m[2];
	// Don't double-escape single quotes inside the value
	const escaped = value.replace(/'/g, "''");
	const newDesc = `description: '${escaped}'`;
	const out = raw.replace(/^description: [^'>|"].*: .*$/m, newDesc);
	if (out !== raw) {
		await writeFile(path, out, "utf8");
		fixed++;
		console.log(`fixed ${path}`);
	}
}
console.log(`\nDone. fixed=${fixed}`);
