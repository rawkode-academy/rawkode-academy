import { describe, expect, test } from "bun:test";
import { acceptReviewedChunk } from "./vtt-chunk";

const original = [
	"WEBVTT",
	"",
	"00:00:01.000 --> 00:00:02.000",
	"Datumctl is great",
	"",
	"00:00:02.000 --> 00:00:03.000",
	"Bye",
].join("\n");

describe("acceptReviewedChunk", () => {
	test("accepts a clean correction", () => {
		const fixed = original.replace("Datumctl", "datumctl");
		expect(acceptReviewedChunk(original, fixed)).toBe(fixed);
	});

	test("strips code fences and preamble", () => {
		const wrapped = `\`\`\`\nCorrected WebVTT chunk:\n${original.replace("Datumctl", "datumctl")}\n\`\`\``;
		const result = acceptReviewedChunk(original, wrapped);
		expect(result).not.toContain("```");
		expect(result).not.toContain("Corrected");
		expect(result).toContain("datumctl is great");
	});

	test("falls back to the original when the chunk is repeated", () => {
		expect(acceptReviewedChunk(original, `${original}\n${original}`)).toBe(
			original,
		);
	});

	test("falls back when timings change or the response is not text", () => {
		expect(
			acceptReviewedChunk(original, original.replace("00:00:02.000 -->", "00:00:02.500 -->")),
		).toBe(original);
		expect(acceptReviewedChunk(original, undefined)).toBe(original);
	});
});
