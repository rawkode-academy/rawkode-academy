import { describe, expect, it } from "vitest";
import type { StudioLayer, StudioSource } from "../types";
import { getRequiredProgrammeAudioSourceIds, hasRequiredTakeoverMedia } from "./takeoverReadiness";

const layer = (sourceId: string, type: "camera" | "screen", enabled = true): StudioLayer => ({
	id: `layer-${sourceId}`, name: sourceId, type, sourceId, enabled, opacity: 1,
	bounds: { x: 0, y: 0, width: 100, height: 100 },
});

function stream(video: boolean, audio: boolean): MediaStream {
	return {
		getVideoTracks: () => video ? [{ readyState: "live", enabled: true }] : [],
		getAudioTracks: () => audio ? [{ readyState: "live", enabled: true }] : [],
	} as unknown as MediaStream;
}

function videoElements(streams: ReadonlyMap<string, MediaStream>): Map<string, HTMLVideoElement> {
	return new Map([...streams].map(([id, source]) => [id, {
		srcObject: source, readyState: 2, videoWidth: 320, videoHeight: 180,
	} as HTMLVideoElement]));
}

describe("takeover media readiness", () => {
	it("requires each enabled programme camera and screen and each unmuted audio source", () => {
		const layers = [layer("camera-a", "camera"), layer("screen-b", "screen")];
		const streams = new Map([["camera-a", stream(true, true)], ["screen-b", stream(true, false)]]);
		expect(hasRequiredTakeoverMedia(layers, streams, ["camera-a", "screen-b"], videoElements(streams))).toBe(false);
		streams.set("screen-b", stream(true, true));
		expect(hasRequiredTakeoverMedia(layers, streams, ["camera-a", "screen-b"], videoElements(streams))).toBe(true);
		streams.delete("camera-a");
		expect(hasRequiredTakeoverMedia(layers, streams, ["screen-b"], videoElements(streams))).toBe(false);
	});

	it("ignores disabled layers but rejects ended or disabled tracks", () => {
		const layers = [layer("hidden", "camera", false), layer("visible", "camera")];
		const unavailable = {
			getVideoTracks: () => [{ readyState: "live", enabled: false }],
			getAudioTracks: () => [{ readyState: "ended", enabled: true }],
		} as unknown as MediaStream;
		const streams = new Map([["visible", unavailable]]);
		expect(hasRequiredTakeoverMedia(layers, streams, ["visible"], videoElements(streams))).toBe(false);
		expect(hasRequiredTakeoverMedia([layer("hidden", "camera", false)], new Map(), [], new Map())).toBe(true);
	});

	it("requires a drawable frame and rejects a muted track", () => {
		const muted = {
			getVideoTracks: () => [{ readyState: "live", enabled: true, muted: true }],
			getAudioTracks: () => [],
		} as unknown as MediaStream;
		const streams = new Map([["camera", muted]]);
		expect(hasRequiredTakeoverMedia([layer("camera", "camera")], streams, [], videoElements(streams))).toBe(false);
		streams.set("camera", stream(true, true));
		const videos = videoElements(streams);
		videos.set("camera", { srcObject: streams.get("camera"), readyState: 2, videoWidth: 0, videoHeight: 180 } as HTMLVideoElement);
		expect(hasRequiredTakeoverMedia([layer("camera", "camera")], streams, [], videos)).toBe(false);
	});

	it("lets operators explicitly mute video-only sources while retaining their pictures", () => {
		const sources: StudioSource[] = [
			{ id: "camera", name: "Camera", type: "camera", status: "ready" },
			{ id: "screen", name: "Screen", type: "screen", status: "ready" },
			{ id: "other-screen", name: "Other", type: "screen", status: "ready" },
		];
		expect(getRequiredProgrammeAudioSourceIds(sources, ["camera", "screen", "other-screen"], "screen", {
			screen: { gain: 1, muted: true },
		})).toEqual(["camera"]);
	});
});
