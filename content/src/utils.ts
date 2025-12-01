import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { stat } from "node:fs/promises";
import { statSync } from "node:fs";

// Resolve the absolute directory for content files inside this package.
// We check if we are inside the package structure and locate the root of the package.
// Since the content files (technologies, articles, etc.) will be siblings to src/ or package.json,
// we resolve relative to package.json.

export async function resolveContentDir(subpath: string = ""): Promise<string> {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve("@rawkodeacademy/content/package.json");
  const root = dirname(pkgPath);
  const targetDir = join(root, subpath);
  try {
    const s = await stat(targetDir);
    if (s.isDirectory()) return targetDir;
  } catch {}
  return root;
}

export function resolveContentDirSync(subpath: string = ""): string {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve("@rawkodeacademy/content/package.json");
  const root = dirname(pkgPath);
  const targetDir = join(root, subpath);
  try {
    const s = statSync(targetDir);
    if (s.isDirectory()) return targetDir;
  } catch {}
  return root;
}
