import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@rawkodeacademy/design-system", () => ({
	academyWatch: () => ({ upcomingThumbnail: "thumbnail" }),
}));
vi.mock("../components/video/CloudflareWhepPlayer.vue", () => ({
	default: { name: "WhepStub", props: ["playbackUrl"], render: () => null },
}));
vi.mock("../components/video/player.vue", () => ({
	default: { name: "FallbackStub", render: () => null },
}));

import LiveStreamGate from "../components/video/LiveStreamGate.vue";

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("live stream gate", () => {
	it("removes stale live playback when a refresh hangs and recovers on a later poll", async () => {
		vi.useFakeTimers();
		let finishOld!: (response: Response) => void;
		let firstSignal: AbortSignal | undefined;
		const fetchMock = vi.fn((_url: string, init: RequestInit) => {
			if (fetchMock.mock.calls.length === 1) {
				firstSignal = init.signal ?? undefined;
				return new Promise<Response>((resolve) => { finishOld = resolve; });
			}
			return Promise.resolve(new Response(JSON.stringify({ live: true, playbackUrl: "https://stream.test/new" })));
		});
		vi.stubGlobal("fetch", fetchMock);
		const wrapper = mount(LiveStreamGate, { props: {
			initialState: { live: true, playbackUrl: "https://stream.test/old", session: null },
			thumbnailUrl: "/thumbnail.png", title: "Show", videoSlug: "show",
		} });
		expect(wrapper.findComponent({ name: "WhepStub" }).props("playbackUrl")).toBe("https://stream.test/old");
		await vi.advanceTimersByTimeAsync(8_000);
		expect(firstSignal?.aborted).toBe(true);
		expect(wrapper.findComponent({ name: "WhepStub" }).exists()).toBe(false);
		expect(wrapper.find("img").exists()).toBe(true);
		finishOld(new Response(JSON.stringify({ live: true, playbackUrl: "https://stream.test/old" })));
		await Promise.resolve();
		expect(wrapper.findComponent({ name: "WhepStub" }).exists()).toBe(false);
		await vi.advanceTimersByTimeAsync(7_000);
		expect(wrapper.findComponent({ name: "WhepStub" }).props("playbackUrl")).toBe("https://stream.test/new");
		wrapper.unmount();
	});
});
