import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	discoverThumbnailJobs,
	parseArgs,
	parseFrontmatter,
	thumbnailUrl,
} from "../scripts/content-test-helpers";

const repoRoot = resolve(import.meta.dirname, "../../../../..");

describe("content discovery", () => {
	it("parses frontmatter scalars, folded blocks, and lists", () => {
		const frontmatter = parseFrontmatter(`---
id: abc123
title: Hands-on Introduction to Iroh
tagline: Peer-to-peer apps, built from first principles
description: >-
  Brendan O'Brien joins Rawkode
  to introduce Iroh.
technologies:
  - iroh
guests:
  - b5
---
Body`);

		expect(frontmatter.id).toBe("abc123");
		expect(frontmatter.title).toBe("Hands-on Introduction to Iroh");
		expect(frontmatter.tagline).toBe(
			"Peer-to-peer apps, built from first principles",
		);
		expect(frontmatter.description).toBe(
			"Brendan O'Brien joins Rawkode to introduce Iroh.",
		);
		expect(frontmatter.technologies).toEqual(["iroh"]);
		expect(frontmatter.guests).toEqual(["b5"]);
	});

	it("discovers the Iroh session with local technology metadata", async () => {
		const { jobs } = await discoverThumbnailJobs(repoRoot, {
			commitSha: "test-sha",
		});
		const job = jobs.find(
			(candidate) => candidate.videoId === "ki0qbn121pdjly5f5vtvii1m",
		);

		expect(job).toMatchObject({
			videoId: "ki0qbn121pdjly5f5vtvii1m",
			tagline: "Peer-to-peer apps, built from first principles",
			source: {
				commitSha: "test-sha",
				trigger: "github-actions",
				contentPath:
					"content/videos/shows/rawkode-live/2026/hands-on-introduction-to-iroh.md",
			},
			technology: {
				id: "iroh",
				name: "Iroh",
			},
		});
		expect(job?.technology.iconSvg).toContain("<svg");
		expect(job?.technology.terms).toContain("peer-to-peer");
	});

	it("builds canonical public thumbnail URLs", () => {
		expect(thumbnailUrl("abc123")).toBe(
			"https://content.rawkode.academy/videos/abc123/thumbnail.webp",
		);
	});

	it("parses trigger CLI defaults and flags", () => {
		expect(parseArgs(["bun", "script"])).toMatchObject({
			concurrency: 10,
			dryRun: false,
			force: false,
			forceChangedContent: false,
		});
		expect(
			parseArgs([
				"bun",
				"script",
				"--dry-run",
				"--force",
				"--force-changed-content",
				"--concurrency",
				"2",
				"--max",
				"5",
				"--video-id",
				"abc123",
				"--video-id",
				"def456",
			]),
		).toMatchObject({
			concurrency: 2,
			dryRun: true,
			force: true,
			forceChangedContent: true,
			max: 5,
			videoIds: ["abc123", "def456"],
		});
	});
});
