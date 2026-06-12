import { getCollection } from "astro:content";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPersonByGithub, listPeople } from "../subgraph/loaders/people";

const mockedGetCollection = vi.mocked(getCollection);

describe("people subgraph loader", () => {
	beforeEach(() => {
		mockedGetCollection.mockReset();
	});

	it("maps GitHub handles, profile URLs, and avatar URLs from content data", async () => {
		mockedGetCollection.mockResolvedValue([
			{
				id: "rawkode",
				body: "Rawkode biography",
				data: {
					name: "Rawkode",
					handles: {
						github: "Rawkode",
					},
					github: "https://github.com/Rawkode",
					avatarUrl: "https://avatars.githubusercontent.com/Rawkode",
					links: [
						{
							name: "Website",
							url: "https://rawkode.academy",
						},
					],
				},
			},
		] as never);

		const [person] = await listPeople();

		expect(person).toMatchObject({
			id: "rawkode",
			name: "Rawkode",
			forename: "Rawkode",
			surname: "",
			githubHandle: "Rawkode",
			githubUrl: "https://github.com/Rawkode",
			avatarUrl: "https://avatars.githubusercontent.com/Rawkode",
			biography: "Rawkode biography",
			links: [
				{
					name: "Website",
					url: "https://rawkode.academy",
				},
			],
		});
	});

	it("looks up people by normalized GitHub username", async () => {
		mockedGetCollection.mockResolvedValue([
			{
				id: "rawkode",
				body: "",
				data: {
					name: "Rawkode",
					handles: {
						github: "Rawkode",
					},
					github: "https://github.com/Rawkode",
				},
			},
		] as never);

		await expect(getPersonByGithub("@Rawkode")).resolves.toMatchObject({
			id: "rawkode",
			githubHandle: "Rawkode",
			githubUrl: "https://github.com/Rawkode",
		});
	});
});
