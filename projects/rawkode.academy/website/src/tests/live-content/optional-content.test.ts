import { describe, expect, it, vi } from "vitest";
import { ContentError, optionalContent } from "@/lib/live-content/collections";

describe("optionalContent", () => {
	it("passes the loaded value through", async () => {
		await expect(optionalContent(Promise.resolve([1, 2]), [])).resolves.toEqual(
			[1, 2],
		);
	});

	it("renders the fallback when the content layer is unavailable", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		await expect(
			optionalContent(
				Promise.reject(new ContentError("Loading videos failed", "videos")),
				[],
			),
		).resolves.toEqual([]);
		expect(warn).toHaveBeenCalledOnce();
	});

	it("still throws anything that is not a content outage", async () => {
		await expect(
			optionalContent(Promise.reject(new TypeError("bug")), []),
		).rejects.toThrow(TypeError);
	});
});
