import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgPath = require.resolve("@rawkodeacademy/content/package.json");
const CONTENT_ROOT = dirname(pkgPath);

export { CONTENT_ROOT };

export function resolveContentDir(...segments: string[]): string {
  return segments.length === 0 ? CONTENT_ROOT : join(CONTENT_ROOT, ...segments);
}

export * as technologies from "./technologies";
