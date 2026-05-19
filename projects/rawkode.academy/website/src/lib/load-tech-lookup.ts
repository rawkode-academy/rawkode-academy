/**
 * Synchronously read every technology profile in the content collection
 * and produce a lookup `Map<lowercased-name, technology-id>` for use with
 * the `remarkTechAutolink` plugin at build time.
 *
 * Technology profiles use two layouts: bare `{id}.mdx` files, or
 * directories with an `index.mdx` plus logos. Both are handled.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { resolveContentDirSync } from "@rawkodeacademy/content/utils";

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

// Bun's @types/node default for `readdirSync(dir, { withFileTypes: true })`
// is `Dirent<NonSharedBuffer>[]`, but runtime returns string-named entries.
interface DirEntryName {
	name: string;
	isDirectory(): boolean;
	isFile(): boolean;
}

export function loadTechLookup(): Map<string, string> {
	const dir = resolveContentDirSync("technologies");
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
		const name = readTechName(mdxPath);
		if (!name) continue;
		const key = name.toLowerCase();
		if (!lookup.has(key)) {
			lookup.set(key, id);
		}
	}

	return lookup;
}
