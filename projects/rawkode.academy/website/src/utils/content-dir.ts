import { createRequire } from "node:module";
import { statSync } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, join } from "node:path";

const workspaceContentRoot = join(process.cwd(), "../../../content");
const nodeModulesContentRoot = join(
	process.cwd(),
	"node_modules/@rawkodeacademy/content",
);
const fallbackRoots = [workspaceContentRoot, nodeModulesContentRoot];

function resolveContentPackageRoot(): string | undefined {
	try {
		const require = createRequire(import.meta.url);
		if (typeof require.resolve === "function") {
			return dirname(require.resolve("@rawkodeacademy/content/package.json"));
		}
	} catch {}

	for (const candidate of fallbackRoots) {
		try {
			if (statSync(candidate).isDirectory()) {
				return candidate;
			}
		} catch {}
	}

	return undefined;
}

// Cloudflare-style dev runtimes do not always expose require.resolve, so we
// fall back to the workspace content package when the package resolver is absent.
export function resolveWebsiteContentDirSync(subpath = ""): string {
	const root = resolveContentPackageRoot() ?? workspaceContentRoot;
	const targetDir = join(root, subpath);
	try {
		if (statSync(targetDir).isDirectory()) {
			return targetDir;
		}
	} catch {}
	return root;
}

export async function resolveWebsiteContentDir(subpath = ""): Promise<string> {
	const root = resolveContentPackageRoot() ?? workspaceContentRoot;
	const targetDir = join(root, subpath);
	try {
		const stats = await stat(targetDir);
		if (stats.isDirectory()) {
			return targetDir;
		}
	} catch {}
	return root;
}
