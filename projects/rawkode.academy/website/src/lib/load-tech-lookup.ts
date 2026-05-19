/**
 * Synchronously read every technology profile in the given directory and
 * produce a lookup `Map<lowercased-name, technology-id>` for use with the
 * `remarkTechAutolink` plugin at build time.
 *
 * The technologies collection lives in two physical layouts depending on
 * the entry — some are bare files (`{id}.mdx`), some are directories with
 * an `index.mdx` (so the directory can also hold logos and assets). We
 * handle both.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

function readTechName(mdxPath: string): string | undefined {
	try {
		const raw = readFileSync(mdxPath, "utf-8");
		const fm = matter(raw).data as { name?: unknown };
		if (typeof fm.name === "string") {
			const trimmed = fm.name.trim();
			if (trimmed.length > 0) return trimmed;
		}
	} catch {
		// unreadable; skip
	}
	return undefined;
}

// Bun's @types/node defaults `readdirSync(dir, { withFileTypes: true })` to
// `Dirent<NonSharedBuffer>[]`, but at runtime we get string paths because
// no `encoding: 'buffer'` is passed. Capture both with a minimal alias and
// route everything through the string-only shape we actually use.
interface DirEntryName {
	name: string;
	isDirectory(): boolean;
	isFile(): boolean;
}

export function loadTechLookup(dir: string): Map<string, string> {
	const lookup = new Map<string, string>();
	let entries: DirEntryName[];
	try {
		entries = readdirSync(dir, {
			withFileTypes: true,
			encoding: "utf8",
		}) as unknown as DirEntryName[];
	} catch {
		return lookup;
	}

	for (const entry of entries) {
		let mdxPath: string;
		let id: string;
		if (entry.isDirectory()) {
			mdxPath = join(dir, entry.name, "index.mdx");
			id = entry.name;
		} else if (entry.isFile() && entry.name.endsWith(".mdx")) {
			mdxPath = join(dir, entry.name);
			id = entry.name.replace(/\.mdx$/, "");
		} else {
			continue;
		}
		// `readTechName` already swallows ENOENT, so no need to pre-flight
		// with a statSync.
		const name = readTechName(mdxPath);
		if (!name) continue;
		const key = name.toLowerCase();
		// First win on conflicts; technology IDs are unique so collisions
		// would only happen if two profiles declared the same display name.
		if (!lookup.has(key)) {
			lookup.set(key, id);
		}
	}

	return lookup;
}
