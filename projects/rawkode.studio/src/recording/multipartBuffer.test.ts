import { describe, expect, it } from "vitest";
import {
	appendRecordingUploadChunk,
	createRecordingUploadBuffer,
	flushRecordingUploadRemainder,
} from "./multipartBuffer";

function blobOf(size: number, value: string): Blob {
	return new Blob([value.repeat(size)], { type: "video/webm" });
}

describe("recording multipart upload buffer", () => {
	it("slices irregular recorder chunks into uniform non-final parts", async () => {
		const buffer = createRecordingUploadBuffer("video/webm");
		const partSizeBytes = 8;
		const parts = [
			...appendRecordingUploadChunk(buffer, blobOf(5, "a"), partSizeBytes),
			...appendRecordingUploadChunk(buffer, blobOf(4, "b"), partSizeBytes),
			...appendRecordingUploadChunk(buffer, blobOf(7, "c"), partSizeBytes),
			...appendRecordingUploadChunk(buffer, blobOf(3, "d"), partSizeBytes),
		];
		const finalPart = flushRecordingUploadRemainder(buffer);

		expect(parts.map((part) => part.size)).toEqual([8, 8]);
		expect(finalPart?.size).toBe(3);
		expect(await parts[0]?.text()).toBe("aaaaabbb");
		expect(await parts[1]?.text()).toBe("bccccccc");
		expect(await finalPart?.text()).toBe("ddd");
	});
});
