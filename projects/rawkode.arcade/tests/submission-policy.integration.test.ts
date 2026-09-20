import { describe, expect, test } from "vitest";
import { allowsMultipleSubmissions } from "../src/lib/submission-policy";

describe("live submission policy", () => {
	test("keeps Merge Conflict teams open for multiple survey answers", () => {
		expect(allowsMultipleSubmissions("contestant", "merge-conflict")).toBe(true);
		expect(allowsMultipleSubmissions("audience", "merge-conflict")).toBe(false);
		expect(allowsMultipleSubmissions("contestant", "principal-engineer")).toBe(false);
	});
});
