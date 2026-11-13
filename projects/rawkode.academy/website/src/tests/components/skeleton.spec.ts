import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(TEST_DIR, "../../..");
const COMPONENTS_DIR = resolve(PROJECT_ROOT, "src/components/common");

const readComponent = (name: string): string =>
	readFileSync(resolve(COMPONENTS_DIR, name), "utf-8");

describe("Skeleton Components", () => {
	it("provide accessible loading semantics", () => {
		for (const name of ["SkeletonText.vue", "SkeletonComment.vue"]) {
			const source = readComponent(name);
			expect(source).toContain('role="status"');
			expect(source).toContain("sr-only");
			expect(source).toContain("ariaLabel");
		}
	});
});
