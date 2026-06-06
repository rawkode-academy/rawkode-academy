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
			(candidate) => candidate.videoId === "7f1dfedcbf38a19375306862",
		);

		expect(job).toMatchObject({
			videoId: "7f1dfedcbf38a19375306862",
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
		});
		expect(
			parseArgs([
				"bun",
				"script",
				"--dry-run",
				"--force",
				"--concurrency",
				"2",
				"--max",
				"5",
			]),
		).toMatchObject({
			concurrency: 2,
			dryRun: true,
			force: true,
			max: 5,
		});
	});
});
