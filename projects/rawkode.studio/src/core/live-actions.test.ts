import { describe, expect, it } from "vitest";
import { createLiveEvent } from "./event-factory";
import {
	configureDestination,
	endLive,
	goLive,
	importRecording,
	inviteGuest,
	prepareLiveInput,
	startPreview,
} from "./live-actions";

const now = new Date("2026-06-04T12:00:00.000Z");

describe("live event actions", () => {
	it("creates scheduled Rawkode Live events with default scenes and destinations", () => {
		const event = createLiveEvent({
			title: "Rawkode Live: Cloudflare Studio",
			scheduledStart: now.toISOString(),
		}, now);

		expect(event.status).toBe("scheduled");
		expect(event.showId).toBe("rawkode-live");
		expect(event.recording.mode).toBe("program-plus-tracks");
		expect(event.destinations.map((destination) => destination.platform)).toEqual([
			"youtube",
			"twitch",
			"linkedin",
		]);
		expect(event.scenePresets.map((scene) => scene.layout)).toContain("screen-share");
	});

	it("prepares a local fallback input when Cloudflare credentials are absent", async () => {
		const event = createLiveEvent({ title: "Rawkode Live" }, now);
		const prepared = await prepareLiveInput(event, null, now);

		expect(prepared.status).toBe("ready");
		expect(prepared.playbackUrls.streamEmbed).toBeNull();
		expect(prepared.playbackUrls.rtmps).toBeNull();
		expect(prepared.recording.status).toBe("armed");
	});

	it("tracks preview, live, and ended lifecycle transitions", () => {
		const ready = {
			...createLiveEvent({ title: "Rawkode Live" }, now),
			status: "ready" as const,
		};

		const preview = startPreview(ready, now);
		const live = goLive({
			...preview,
			destinations: preview.destinations.map((destination) =>
				destination.platform === "youtube" ? { ...destination, enabled: true, health: "ready" as const } : destination
			),
		}, now);
		const ended = endLive(live, now);

		expect(preview.status).toBe("preview");
		expect(live.status).toBe("live");
		expect(live.actualStart).toBe(now.toISOString());
		expect(live.recording.status).toBe("recording");
		expect(live.destinations.find((destination) => destination.platform === "youtube")?.health).toBe("live");
		expect(ended.status).toBe("ended");
		expect(ended.recording.status).toBe("processing");
	});

	it("configures destination state from environment without a Cloudflare client", async () => {
		const event = createLiveEvent({ title: "Rawkode Live" }, now);
		const updated = await configureDestination(
			event,
			"youtube",
			true,
			{
				YOUTUBE_RTMP_URL: "rtmp://a.rtmp.youtube.com/live2",
				YOUTUBE_STREAM_KEY: "secret",
			} as Env,
			null,
			now,
		);

		const youtube = updated.destinations.find((destination) => destination.platform === "youtube");
		expect(youtube?.enabled).toBe(true);
		expect(youtube?.health).toBe("ready");
		expect(youtube?.rtmpUrl).toBe("rtmp://a.rtmp.youtube.com/live2");
	});

	it("adds guests and imports completed recordings", () => {
		const event = createLiveEvent({ title: "Rawkode Live" }, now);
		const withGuest = inviteGuest(event, { displayName: "Guest Engineer" }, now);
		const imported = importRecording(withGuest, { cloudflareVideoUid: "video-uid" }, now);

		expect(withGuest.participants.some((participant) => participant.displayName === "Guest Engineer")).toBe(true);
		expect(imported.status).toBe("imported");
		expect(imported.cloudflareVideoUid).toBe("video-uid");
		expect(imported.recording.programRecordingUid).toBe("video-uid");
	});
});
