import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { hasTag, openStory, stories, themes } from "./stories";

// Page-level best-practice rules (landmarks, one h1) mean nothing on an
// isolated specimen, so only the WCAG A and AA rule sets run.
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const theme of themes) {
	for (const story of stories) {
		// Opt a story out with `tags: ["!a11y"]` and a comment saying why.
		if (hasTag(story, "!a11y")) continue;

		test(`${story.id} [${theme}] has no WCAG A/AA violations`, async ({
			page,
		}) => {
			const { externalRequests, pageErrors } = await openStory(
				page,
				story.id,
				theme,
			);
			expect(externalRequests, "stories must not use the network").toEqual([]);
			expect(pageErrors).toEqual([]);

			const results = await new AxeBuilder({ page })
				.include("#storybook-root")
				.withTags(WCAG_TAGS)
				.analyze();

			expect(
				results.violations.map((violation) => ({
					rule: violation.id,
					impact: violation.impact,
					help: violation.help,
					targets: violation.nodes.map((node) => node.target.join(" ")),
				})),
			).toEqual([]);
		});
	}
}
