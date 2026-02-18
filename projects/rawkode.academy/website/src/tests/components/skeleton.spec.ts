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
		const skeleton = readComponent("Skeleton.vue");
		const skeletonText = readComponent("SkeletonText.vue");
		const skeletonCard = readComponent("SkeletonCard.vue");
		const skeletonList = readComponent("SkeletonList.vue");

		for (const source of [skeleton, skeletonText, skeletonCard, skeletonList]) {
			expect(source).toContain('role="status"');
			expect(source).toContain("sr-only");
			expect(source).toContain("ariaLabel");
		}
	});

	it("keeps deterministic structure for card and list variants", () => {
		const skeletonCard = readComponent("SkeletonCard.vue");
		const skeletonList = readComponent("SkeletonList.vue");

		expect(skeletonCard).toContain('import SkeletonText from "./SkeletonText.vue";');
		expect(skeletonCard).toContain("showDescription");
		expect(skeletonCard).toContain("showFooter");

		expect(skeletonList).toContain('v-for="index in items"');
		expect(skeletonList).toContain("getTitleWidth");
		expect(skeletonList).toContain("getSubtitleWidth");
	});
});
