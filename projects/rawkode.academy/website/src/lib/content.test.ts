import { getCollection } from "astro:content";
import { describe, expect, it, vi } from "vitest";
import { getLatestContent } from "./content";

const publishedAt = new Date("2026-06-20T00:00:00.000Z");

async function excerpt(description: string | undefined) {
	const story = {
		id: "2026-06-20-runc-1-5-prometheus-3-13-talos",
		data: { title: "Release updates", description, publishedAt },
	};
	vi.mocked(getCollection).mockImplementation(async (name, predicate) => {
		const values = name === "news" ? [story] : [];
		const filter = predicate as ((entry: typeof story) => boolean) | undefined;
		return (filter ? values.filter(filter) : values) as never;
	});
	const items = await getLatestContent(12, publishedAt);
	expect(items).toHaveLength(1);
	expect(items[0]).toMatchObject({
		href: `/news/${story.id}`,
		title: story.data.title,
		kind: "News",
		publishedAt: publishedAt.toISOString(),
	});
	// News has no story-specific artwork, so the ledger row is text-led.
	expect(items[0]).not.toHaveProperty("mediaSrc");
	expect(story.data.description).toBe(description);
	return items[0]?.description;
}

describe("latest-content excerpt word boundaries", () => {
	it("does not leave the June 20 Talos excerpt ending with a fragment of fixed", async () => {
		const description =
			"runc cut its first stable 1.5 release with libpathrs hardening and a new support policy, Prometheus opened a 3.13.0 release candidate with new PromQL functions, and Talos v1.12.9 fixed an etcd client resource leak.";
		const result = await excerpt(description);
		expect(result).toBe(
			"runc cut its first stable 1.5 release with libpathrs hardening and a new support policy, Prometheus opened a 3.13.0 release candidate with new PromQL functions, and Talos v1.12.9…",
		);
		expect(result?.length).toBeLessThanOrEqual(181);
	});

	it("drops a partial final word rather than chopping it", async () => {
		const prefix = "word ".repeat(35).trim();
		expect(await excerpt(`${prefix} Kubernetes release notes`)).toBe(
			`${prefix}…`,
		);
	});

	it("retains a complete word exactly at the length boundary", async () => {
		const prefix = `${"word ".repeat(35)}cloud`;
		expect(prefix).toHaveLength(180);
		expect(await excerpt(`${prefix} release notes`)).toBe(`${prefix}…`);
		expect(await excerpt(prefix)).toBe(prefix);
	});

	it("preserves a short complete first sentence and normalizes whitespace", async () => {
		expect(
			await excerpt("  A\n complete\t sentence. " + "More detail ".repeat(30)),
		).toBe("A complete sentence.");
		expect(await excerpt("  Short\tcopy\nwithout punctuation  ")).toBe(
			"Short copy without punctuation",
		);
	});

	it.each([
		undefined,
		"",
		" \n\t ",
	])("keeps the existing empty-copy fallback for %j", async (input) => {
		expect(await excerpt(input)).toBe(
			"Practical cloud native education from Rawkode Academy.",
		);
	});

	it("keeps an oversized whitespace-free token bounded instead of returning an empty excerpt", async () => {
		expect(await excerpt("x".repeat(200))).toBe(`${"x".repeat(180)}…`);
	});
});
