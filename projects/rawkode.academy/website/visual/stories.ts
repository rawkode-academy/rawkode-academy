import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";

interface IndexEntry {
	id: string;
	title: string;
	name: string;
	type: "story" | "docs";
	tags?: string[];
}

const indexPath = fileURLToPath(
	new URL("../storybook-static/index.json", import.meta.url),
);
const index = JSON.parse(readFileSync(indexPath, "utf-8")) as {
	entries: Record<string, IndexEntry>;
};

/** Every story in the build, so a new story is covered without new test code. */
export const stories = Object.values(index.entries).filter(
	(entry) => entry.type === "story",
);
export const themes = ["light", "dark"] as const;
export type Theme = (typeof themes)[number];

export const hasTag = (story: IndexEntry, tag: string) =>
	story.tags?.includes(tag) ?? false;

/**
 * Opens one story in one colour scheme and waits until it is safe to inspect:
 * rendered and played to the end without Storybook's error display, theme
 * applied, fonts and images settled. Any request that leaves the local server is aborted and returned,
 * so a story that reaches for the network fails instead of flaking.
 */
export async function openStory(page: Page, id: string, theme: Theme) {
	const externalRequests: string[] = [];
	const pageErrors: string[] = [];
	page.on("pageerror", (error) => pageErrors.push(error.message));
	await page.route("**/*", (route) => {
		const url = new URL(route.request().url());
		if (url.hostname === "127.0.0.1" || !url.protocol.startsWith("http")) {
			return route.continue();
		}
		externalRequests.push(url.origin);
		return route.abort();
	});

	await page.goto(
		`/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`,
	);
	// The preview decorator renders a <style> first, so wait for real content.
	await page
		.locator("body.sb-show-main #storybook-root > :not(style)")
		.first()
		.waitFor({ state: "attached" });
	// Wait for the render to end, play function included, so axe and the
	// screenshot see the state the story exists to reach. A play function
	// that throws ends in `errored`.
	const phase = await page
		.waitForFunction(() => {
			const preview = (
				window as unknown as {
					__STORYBOOK_PREVIEW__?: { currentRender?: { phase?: string } };
				}
			).__STORYBOOK_PREVIEW__;
			const current = preview?.currentRender?.phase;
			return current === "finished" || current === "errored" ? current : false;
		})
		.then((handle) => handle.jsonValue());
	expect(phase, "the story, and its play function, must finish").toBe(
		"finished",
	);
	await expect(page.locator("body")).not.toHaveClass(/sb-show-errordisplay/);
	await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));

	await page.evaluate(async () => {
		const images = Array.from(document.images);
		for (const image of images) image.loading = "eager";
		await Promise.all(
			images.map((image) =>
				image.complete
					? undefined
					: new Promise((resolve) => {
							image.addEventListener("load", resolve, { once: true });
							image.addEventListener("error", resolve, { once: true });
						}),
			),
		);
		await document.fonts.ready;
	});
	// A story that falls back to a system font would give a baseline that
	// differs per machine, so the vendored Red Hat files must be loadable.
	const loaded = await page.evaluate(async () => {
		const families = ["Display", "Text", "Mono"].map(
			(role) => `16px "Red Hat ${role} Variable"`,
		);
		await Promise.all(families.map((font) => document.fonts.load(font)));
		// fonts.check() is true for an unknown family, so read the faces.
		const ready = new Set(
			Array.from(document.fonts)
				.filter((face) => face.status === "loaded")
				.map((face) => face.family.replace(/["']/g, "")),
		);
		return families.filter((font) => !ready.has(font.slice(6, -1)));
	});
	expect(loaded, "vendored Red Hat fonts that failed to load").toEqual([]);

	return { externalRequests, pageErrors };
}
