import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudioEnv } from "../env";
import {
	getStudioContentEvents,
	getStudioContentPersonByGithub,
	getStudioContentVideo,
} from "./content";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("Studio content graph", () => {
	it("uses GitHub handles as person IDs when resolving content videos", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				new Response(
					JSON.stringify({
						data: {
							videoByID: {
								id: "video-123",
								slug: "future-episode",
								title: "Future episode",
								publishedAt: null,
								guests: [
									{
										id: "steve-klabnik",
										name: "Steve Klabnik",
										githubHandle: "SteveKlabnik",
										avatarUrl: "https://example.com/steve.png",
									},
								],
								episode: {
									show: {
										id: "rawkode-live",
										name: "Rawkode Live",
										hosts: [
											{
												id: "rawkode-person",
												name: "Rawkode",
												githubHandle: "Rawkode",
												avatarUrl: "https://example.com/rawkode.png",
											},
										],
									},
								},
							},
							episodeByVideoId: null,
						},
					}),
				),
			),
		);

		const video = await getStudioContentVideo(
			{ RAWKODE_GRAPHQL_URL: "https://content.example/graphql" } as StudioEnv,
			"video-123",
		);

		expect(video?.guests[0]).toMatchObject({
			githubHandle: "steveklabnik",
			id: "steveklabnik",
		});
		expect(video?.slug).toBe("future-episode");
		expect(video?.show?.hosts[0]).toMatchObject({
			githubHandle: "rawkode",
			id: "rawkode",
		});
	});

	it("lists content events from all videos with normalized participants", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				new Response(
					JSON.stringify({
						data: {
							getAllVideos: [
								{
									id: "video-2",
									slug: "later-event",
									title: "Later event",
									publishedAt: "2026-08-02T10:00:00.000Z",
									guests: [],
									episode: null,
								},
								{
									id: "video-1",
									slug: "first-event",
									title: "First event",
									publishedAt: "2026-08-01T10:00:00.000Z",
									guests: [
										{
											id: "guest-person",
											name: "Guest Person",
											githubHandle: "GuestHandle",
											avatarUrl: null,
										},
									],
									episode: {
										show: {
											id: "rawkode-live",
											name: "Rawkode Live",
											hosts: [
												{
													id: "rawkode-person",
													name: "Rawkode",
													githubHandle: "Rawkode",
													avatarUrl: null,
												},
											],
										},
									},
								},
							],
						},
					}),
				),
			),
		);

		await expect(
			getStudioContentEvents({
				RAWKODE_GRAPHQL_URL: "https://content.example/graphql",
			} as StudioEnv),
		).resolves.toMatchObject([
			{
				id: "video-1",
				guests: [{ githubHandle: "guesthandle", id: "guesthandle" }],
				show: {
					hosts: [{ githubHandle: "rawkode", id: "rawkode" }],
				},
			},
			{
				id: "video-2",
			},
		]);
	});

	it("resolves people by normalized GitHub handle", async () => {
		const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body ?? "{}")) as {
				variables?: { username?: string };
			};
			return new Response(
				JSON.stringify({
					data: {
						personByGithub: {
							id: "rawkode-person",
							name: "Rawkode Academy",
							githubHandle: body.variables?.username,
							avatarUrl: "https://example.com/rawkode.png",
						},
					},
				}),
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		const person = await getStudioContentPersonByGithub(
			{ RAWKODE_GRAPHQL_URL: "https://content.example/graphql" } as StudioEnv,
			" @Rawkode ",
		);

		expect(fetchMock).toHaveBeenCalledWith(
			"https://content.example/graphql",
			expect.objectContaining({
				method: "POST",
			}),
		);
		expect(person).toEqual({
			avatarUrl: "https://example.com/rawkode.png",
			githubHandle: "rawkode",
			id: "rawkode",
			name: "Rawkode Academy",
		});
	});
});
