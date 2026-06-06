import { describe, expect, it } from "vitest";
import {
	getRecordingHandoffStatusLabel,
	getRecordingHandoffStatusUrl,
	parseRecordingHandoff,
} from "./handoff";

describe("recording handoff display helpers", () => {
	it("links completed uploads back to the session recordings page", () => {
		expect(
			getRecordingHandoffStatusUrl({
				studioSessionId: "rawkode-live next",
			}),
		).toBe("/studio/rawkode-live%20next/recordings");
	});

	it("uses the server recording id in the uploaded status label", () => {
		expect(
			getRecordingHandoffStatusLabel({
				recordingId: "recording-2026-06-06T02-00-00",
			}),
		).toBe("Uploaded recording-2026-06-06T02-00-00");
	});

	it("parses the server recording handoff response", () => {
		expect(
			parseRecordingHandoff({
				recordingId: "recording-1",
				readyMarkerKey: "studio/recordings/session-1/recording-1/ready.json",
				studioSessionId: "session-1",
				outputPrefix: "videos/video-1/",
				videoId: "video-1",
				sourceVerified: true,
			}),
		).toEqual({
			recordingId: "recording-1",
			readyMarkerKey: "studio/recordings/session-1/recording-1/ready.json",
			studioSessionId: "session-1",
			outputPrefix: "videos/video-1/",
			videoId: "video-1",
		});
	});

	it("rejects completed upload responses without handoff metadata", () => {
		expect(() => parseRecordingHandoff({ recordingId: "recording-1" })).toThrow(
			"Recording handoff missing readyMarkerKey.",
		);
	});
});
