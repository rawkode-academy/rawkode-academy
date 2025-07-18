import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

export interface WebContainerFiles {
	[path: string]: string;
}

export interface LoadWebContainerFilesOptions {
	excludeDirs?: string[];
	excludeFiles?: string[];
}

const DEFAULT_EXCLUDE_DIRS = [
	"node_modules",
	".git",
	"dist",
	"build",
	".cache",
	"coverage",
	".next",
	".nuxt",
];
const DEFAULT_EXCLUDE_FILES = [
	"*.lock",
	".*",
	"Thumbs.db",
	".DS_Store",
	"*.log",
	"*.map",
	"*.min.js",
	"*.min.css",
];

function shouldExcludeFile(
	fileName: string,
	excludePatterns: string[],
): boolean {
	return excludePatterns.some((pattern) => {
		if (pattern.startsWith("*")) {
			return fileName.endsWith(pattern.slice(1));
		}
		if (pattern.endsWith("*")) {
			return fileName.startsWith(pattern.slice(0, -1));
		}
		return fileName === pattern;
	});
}

export async function loadWebContainerFiles(
	baseDir: string,
	options: LoadWebContainerFilesOptions = {},
): Promise<WebContainerFiles> {
	const files: WebContainerFiles = {};
	const excludeDirs = options.excludeDirs || DEFAULT_EXCLUDE_DIRS;
	const excludeFiles = options.excludeFiles || DEFAULT_EXCLUDE_FILES;

	async function walkDir(dir: string) {
		const entries = await readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(dir, entry.name);

			if (entry.isDirectory()) {
				if (!excludeDirs.includes(entry.name)) {
					await walkDir(fullPath);
				}
			} else if (entry.isFile()) {
				if (!shouldExcludeFile(entry.name, excludeFiles)) {
					const relativePath = relative(baseDir, fullPath);
					const content = await readFile(fullPath, "utf-8");
					files[relativePath] = content;
				}
			}
		}
	}

	await walkDir(baseDir);
	return files;
}
