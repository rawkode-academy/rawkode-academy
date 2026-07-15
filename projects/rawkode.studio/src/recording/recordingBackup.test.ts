import { describe, expect, it } from "vitest";
import { buildRecordingBackupSummaries } from "./recordingBackup";

describe("recording backup discovery", () => {
	it("combines persisted metadata with IndexedDB chunk keys", () => {
		const summaries = buildRecordingBackupSummaries(
			[
				{
					chunkCount: 1,
					contentType: "video/webm;codecs=vp9,opus",
					createdAt: 100,
					id: "newer",
					sizeBytes: 12,
					updatedAt: 300,
				},
				{
					chunkCount: 0,
					contentType: "video/webm",
					createdAt: 50,
					id: "empty",
					sizeBytes: 0,
					updatedAt: 50,
				},
			],
			[
				["newer", 0],
				["newer", 1],
				["legacy", 0],
			] as IDBValidKey[],
		);

		expect(summaries).toEqual([
			{
				chunkCount: 2,
				contentType: "video/webm;codecs=vp9,opus",
				createdAt: 100,
				id: "newer",
				isLegacy: false,
				sizeBytes: 12,
				updatedAt: 300,
			},
			{
				chunkCount: 1,
				contentType: "video/webm",
				createdAt: null,
				id: "legacy",
				isLegacy: true,
				sizeBytes: null,
				updatedAt: null,
			},
		]);
	});

	it("orders recoverable recordings by their latest write", () => {
		const summaries = buildRecordingBackupSummaries(
			[
				{
					chunkCount: 1,
					contentType: "video/webm",
					createdAt: 100,
					id: "older",
					sizeBytes: 5,
					updatedAt: 200,
				},
				{
					chunkCount: 1,
					contentType: "video/webm",
					createdAt: 150,
					id: "newer",
					sizeBytes: 5,
					updatedAt: 400,
				},
			],
			[["older", 0], ["newer", 0]] as IDBValidKey[],
		);

		expect(summaries.map((summary) => summary.id)).toEqual(["newer", "older"]);
	});
});
