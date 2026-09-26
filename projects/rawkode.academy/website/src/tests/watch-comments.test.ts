import { afterEach, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import VideoComments from "../components/video/comments.vue";

const wrappers: VueWrapper[] = [];
afterEach(() => {
	for (const wrapper of wrappers.splice(0)) wrapper.unmount();
	vi.mocked(fetch).mockReset();
});

it("shows compact empty comments without a Discord discussion link", async () => {
	vi.mocked(fetch).mockResolvedValue(
		new Response(
			JSON.stringify({
				comments: [],
				discordInviteUrl: "https://discord.gg/example",
			}),
			{ headers: { "content-type": "application/json" } },
		),
	);
	const wrapper = mount(VideoComments, {
		props: { videoId: "fixture", headingLevel: 2 },
	});
	wrappers.push(wrapper);
	expect(wrapper.get("h2").text()).toBe("Comments");
	await flushPromises();
	expect(wrapper.get("h2").text()).toBe("Comments (0)");
	expect(wrapper.findAll("p").map((p) => p.text())).toEqual([
		"No comments yet. Be the first to start the discussion.",
	]);
	expect(wrapper.findAll("a")).toHaveLength(0);
	expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/comments/fixture");
});

it.each([
	2, 3,
] as const)("nests author headings under an H%i discussion", async (headingLevel) => {
	vi.mocked(fetch).mockResolvedValue(
		new Response(
			JSON.stringify({
				comments: [
					{
						id: 1,
						author: "Fixture author",
						content: "A useful explanation.",
						timestamp: "2026-01-01T00:00:00Z",
					},
				],
			}),
			{ headers: { "content-type": "application/json" } },
		),
	);
	const wrapper = mount(VideoComments, {
		props: { videoId: "fixture", headingLevel },
	});
	wrappers.push(wrapper);
	await flushPromises();
	expect(wrapper.get(`h${headingLevel}`).text()).toBe("Comments (1)");
	expect(wrapper.get(`h${headingLevel + 1}`).text()).toBe("Fixture author");
	expect(wrapper.text()).toContain("A useful explanation.");
	expect(wrapper.text()).not.toContain("No comments yet");
	expect(wrapper.find("a").exists()).toBe(false);
});
