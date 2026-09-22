import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// Resolve the absolute directory for content files inside this package.
// We check if we are inside the package structure and locate the root of the package.
// Since the content files (technologies, articles, etc.) will be siblings to src/ or package.json,
// we resolve relative to package.json.

export async function resolveContentDir(subpath: string = ""): Promise<string> {
  return resolveContentDirSync(subpath);
}

export function resolveContentDirSync(subpath: string = ""): string {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve("@rawkodeacademy/content/package.json");
  const root = dirname(pkgPath);
  // Always return the collection's own directory, even when it does not
  // exist yet or has emptied out. Falling back to the content root would
  // hand a glob loader every entry in the repository, so an empty
  // collection would swallow other collections' files and fail their schema.
  return join(root, subpath);
}
