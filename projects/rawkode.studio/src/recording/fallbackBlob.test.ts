import { describe, expect, it } from "vitest";
import { createRecordingFallbackBlob } from "./fallbackBlob";

describe("recording fallback blob", () => {
	it("builds a blob from ordered chunk blobs instead of wrapper objects", async () => {
		const blob = createRecordingFallbackBlob(
			[
				{ chunk: new Blob(["second"], { type: "video/webm" }), chunkIndex: 1 },
				{ chunk: new Blob(["first"], { type: "video/webm" }), chunkIndex: 0 },
			],
			"video/webm",
		);

		expect(blob?.type).toBe("video/webm");
		expect(await blob?.text()).toBe("firstsecond");
	});
});
