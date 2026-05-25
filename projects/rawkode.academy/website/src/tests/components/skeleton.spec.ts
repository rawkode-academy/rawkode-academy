import { describe, expect, it } from "vitest";
import { createProjectFileReader } from "../read-project-file";

const readProjectFile = createProjectFileReader(import.meta.url, "../../..");

const readComponent = (name: string): string =>
	readProjectFile(`src/components/common/${name}`);

describe("Skeleton Components", () => {
	it("provide accessible loading semantics", () => {
		const components = [
			"SkeletonText.vue",
			"SkeletonComment.vue",
			"SkeletonTranscript.vue",
			"SkeletonList.tsx",
		].map(readComponent);

		for (const source of components) {
			expect(source).toContain('role="status"');
			expect(source).toContain("sr-only");
			expect(source).toMatch(/aria-label|ariaLabel/);
		}
	});

	it("keeps deterministic structure for comment, transcript, and list variants", () => {
		const skeletonComment = readComponent("SkeletonComment.vue");
		const skeletonTranscript = readComponent("SkeletonTranscript.vue");
		const skeletonList = readComponent("SkeletonList.tsx");

		expect(skeletonComment).toContain(
			'import SkeletonText from "./SkeletonText.vue";',
		);
		expect(skeletonComment).toContain("lastLineWidth");

		expect(skeletonTranscript).toContain("getTimestampWidth");
		expect(skeletonTranscript).toContain("getParagraphLines");
		expect(skeletonTranscript).toContain("getLastLineWidth");

		expect(skeletonList).toContain("Array.from({ length: items })");
		expect(skeletonList).toContain("getTitleWidth");
		expect(skeletonList).toContain("showSubtitle");
		expect(skeletonList).toContain("showAction");
	});
});
