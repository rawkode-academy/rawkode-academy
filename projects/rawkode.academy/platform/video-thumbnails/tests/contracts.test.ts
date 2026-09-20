import { describe, expect, it } from "vitest";
import {
	githubAvatarUrl,
	guestLayout,
	thumbnailKey,
} from "../src/contracts";

describe("thumbnail contracts", () => {
	it("builds canonical R2 thumbnail keys", () => {
		expect(thumbnailKey("abc123")).toBe(
			"videos/abc123/thumbnail.webp",
		);
	});

	it("rejects unsafe video ids", () => {
		expect(() => thumbnailKey("../bad")).toThrow("Invalid video id");
	});

	it("builds GitHub avatar URLs", () => {
		expect(githubAvatarUrl("b5")).toBe("https://github.com/b5.png?size=512");
	});

	it("uses stable guest layouts for one to four guests", () => {
		expect(guestLayout(1)).toEqual({ count: 1, columns: 1, size: 174 });
		expect(guestLayout(2)).toEqual({ count: 2, columns: 2, size: 144 });
		expect(guestLayout(3)).toEqual({ count: 3, columns: 3, size: 124 });
		expect(guestLayout(4)).toEqual({ count: 4, columns: 2, size: 112 });
		expect(guestLayout(8)).toEqual({ count: 4, columns: 2, size: 112 });
	});
});
