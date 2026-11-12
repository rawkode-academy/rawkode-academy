import { describe, expect, it } from "vitest";
import {
	type RecordingBackupChunkRow,
	type RecordingBackupMetadataRow,
	summarizeRecordingBackupRows,
} from "./recordingBackup";

function chunkRow(
	recordingId: string,
	chunkIndex: number,
	size: number,
	overrides: Partial<RecordingBackupChunkRow> = {},
): RecordingBackupChunkRow {
	return {
		chunk: new Blob([new Uint8Array(size)], { type: "video/webm" }),
		chunkIndex,
		contentType: "video/webm;codecs=vp9,opus",
		createdAt: 1_000,
		recordingId,
		...overrides,
	};
}

describe("summarizeRecordingBackupRows", () => {
	it("groups chunks into newest-first recoverable recordings", () => {
		const summaries = summarizeRecordingBackupRows([
			chunkRow("older", 1, 7, { createdAt: 100 }),
			chunkRow("newer", 0, 11, { createdAt: 200 }),
			chunkRow("older", 0, 5, { createdAt: 100 }),
		]);

		expect(summaries).toEqual([
			{
				chunkCount: 1,
				contentType: "video/webm;codecs=vp9,opus",
				createdAt: 200,
					id: "newer",
					integrity: "unfinalized",
					size: 11,
			},
			{
				chunkCount: 2,
				contentType: "video/webm;codecs=vp9,opus",
				createdAt: 100,
					id: "older",
					integrity: "unfinalized",
					size: 12,
			},
		]);
	});

	it("can discover recordings written before metadata was added", () => {
		const [summary] = summarizeRecordingBackupRows([
			chunkRow("legacy", 0, 3, {
				contentType: undefined,
				createdAt: undefined,
			}),
		]);

			expect(summary).toEqual({
			chunkCount: 1,
			contentType: "video/webm",
			createdAt: 0,
				id: "legacy",
				integrity: "unfinalized",
				size: 3,
		});
	});

	it("uses the first chunk's type even when rows arrive out of order", () => {
		const [summary] = summarizeRecordingBackupRows([
			chunkRow("recording", 2, 3, { contentType: "video/incorrect" }),
			chunkRow("recording", 0, 4, { contentType: "video/webm" }),
		]);

		expect(summary?.contentType).toBe("video/webm");
	});

	it("marks finalized contiguous recordings complete", () => {
		const metadata: RecordingBackupMetadataRow = {
			contentType: "video/webm",
			createdAt: 100,
			expectedChunkCount: 2,
			finalized: true,
			id: "recording",
		};

		const [summary] = summarizeRecordingBackupRows([
			chunkRow("recording", 1, 7),
			chunkRow("recording", 0, 5),
		], [metadata]);

		expect(summary).toMatchObject({
			chunkCount: 2,
			integrity: "complete",
			size: 12,
		});
	});

	it("detects missing chunks using finalization metadata", () => {
		const [summary] = summarizeRecordingBackupRows([
			chunkRow("recording", 0, 5),
			chunkRow("recording", 2, 7),
		], [{
			contentType: "video/webm",
			createdAt: 100,
			expectedChunkCount: 3,
			finalized: true,
			id: "recording",
		}]);

		expect(summary?.integrity).toBe("gapped");
	});

	it("marks recorder failures unfinalized even when chunks are contiguous", () => {
		const [summary] = summarizeRecordingBackupRows([
			chunkRow("recording", 0, 5),
		], [{
			contentType: "video/webm",
			createdAt: 100,
			errorMessage: "Encoder failed",
			expectedChunkCount: 1,
			finalized: false,
			id: "recording",
		}]);

		expect(summary?.integrity).toBe("unfinalized");
	});
});
