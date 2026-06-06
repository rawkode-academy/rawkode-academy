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
		const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
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
									id: "SteveKlabnik",
									name: "Steve Klabnik",
								},
							],
							episode: {
								show: {
									id: "rawkode-live",
									name: "Rawkode Live",
									hosts: [
										{
											id: "Rawkode",
											name: "Rawkode",
										},
									],
								},
							},
						},
						episodeByVideoId: null,
					},
				}),
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		const video = await getStudioContentVideo(
			{ RAWKODE_GRAPHQL_URL: "https://content.example/graphql" } as StudioEnv,
			"video-123",
		);

		const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}")) as {
			query?: string;
		};
		expect(request.query).not.toContain("githubHandle");
		expect(request.query).not.toContain("avatarUrl");
		expect(video?.guests[0]).toMatchObject({
			githubHandle: "steveklabnik",
			id: "steveklabnik",
			avatarUrl: null,
		});
		expect(video?.slug).toBe("future-episode");
		expect(video?.show?.hosts[0]).toMatchObject({
			githubHandle: "rawkode",
			id: "rawkode",
			avatarUrl: null,
		});
	});

	it("lists content events from all videos with normalized participants", async () => {
		const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
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
										id: "GuestHandle",
										name: "Guest Person",
									},
								],
								episode: {
									show: {
										id: "rawkode-live",
										name: "Rawkode Live",
										hosts: [
											{
												id: "Rawkode",
												name: "Rawkode",
											},
										],
									},
								},
							},
						],
					},
				}),
			),
		);
		vi.stubGlobal("fetch", fetchMock);

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
		const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}")) as {
			query?: string;
		};
		expect(request.query).not.toContain("githubHandle");
		expect(request.query).not.toContain("avatarUrl");
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
							id: body.variables?.username,
							name: "Rawkode Academy",
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
		const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? "{}")) as {
			query?: string;
		};
		expect(request.query).not.toContain("githubHandle");
		expect(request.query).not.toContain("avatarUrl");
		expect(person).toEqual({
			avatarUrl: null,
			githubHandle: "rawkode",
			id: "rawkode",
			name: "Rawkode Academy",
		});
	});
});
