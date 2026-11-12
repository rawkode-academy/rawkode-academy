import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const playback = vi.hoisted(() => ({ connect: vi.fn(), dispose: vi.fn() }));
vi.mock("@rawkodeacademy/live-viewer", () => ({ createWhepPlayback: () => playback }));
vi.mock("@rawkodeacademy/design-system", () => ({
	academyWatch: () => ({ livePlayer: "player", livePlayerVideo: "video", livePlayerStatus: "status" }),
}));

import CloudflareWhepPlayer from "../components/video/CloudflareWhepPlayer.vue";

describe("WHEP player component", () => {
	it("switches to the new URL and disposes playback on unmount", async () => {
		const wrapper = mount(CloudflareWhepPlayer, { props: {
			playbackUrl: "https://stream.test/old", title: "Show",
		} });
		expect(playback.connect).toHaveBeenCalledWith("https://stream.test/old");
		await wrapper.setProps({ playbackUrl: "https://stream.test/new" });
		expect(playback.connect).toHaveBeenLastCalledWith("https://stream.test/new");
		wrapper.unmount();
		expect(playback.dispose).toHaveBeenCalledOnce();
	});
});
