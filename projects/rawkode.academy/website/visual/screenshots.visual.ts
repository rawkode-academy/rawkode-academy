import { expect, test } from "@playwright/test";
import { hasTag, openStory, stories, themes } from "./stories";

// Pixels are opt-in: tag a story `visual` to give it a baseline in both
// colour schemes, and `visual-mobile` to add a 390px pass. Keep the set to
// primitives and a few composed specimens; axe already covers every story.
const visualStories = stories.filter((story) => hasTag(story, "visual"));

test.skip(
	process.platform !== "linux",
	"baselines are rendered on Linux with the pinned Chromium",
);

test("some stories carry the visual tag", () => {
	expect(visualStories.length).toBeGreaterThan(0);
});

for (const theme of themes) {
	for (const story of visualStories) {
		test(`${story.id} [${theme}] matches its baseline`, async ({ page }) => {
			await openStory(page, story.id, theme);
			await expect(page).toHaveScreenshot(`${story.id}-${theme}.png`, {
				fullPage: true,
			});
		});

		if (!hasTag(story, "visual-mobile")) continue;

		test(`${story.id} [${theme}, mobile] matches its baseline`, async ({
			page,
		}) => {
			await page.setViewportSize({ width: 390, height: 844 });
			await openStory(page, story.id, theme);
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= window.innerWidth,
				),
				"the story must not scroll sideways at 390px",
			).toBe(true);
			await expect(page).toHaveScreenshot(`${story.id}-${theme}-mobile.png`, {
				fullPage: true,
			});
		});
	}
}
