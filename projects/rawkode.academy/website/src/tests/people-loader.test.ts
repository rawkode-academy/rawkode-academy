const { getAllCollection } = vi.hoisted(() => ({ getAllCollection: vi.fn() }));
vi.mock("@/lib/payload-content", () => ({ getAllCollection }));
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPersonByGithub, listPeople } from "../subgraph/loaders/people";

const mockedGetAllCollection = vi.mocked(getAllCollection);

describe("people subgraph loader", () => {
	beforeEach(() => {
		mockedGetAllCollection.mockReset();
	});

	it("maps GitHub handles, profile URLs, and avatar URLs from content data", async () => {
		mockedGetAllCollection.mockResolvedValue([
			{
				id: "person-rawkode-payload-cuid",
				slug: "rawkode",
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
			id: "person-rawkode-payload-cuid",
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
		mockedGetAllCollection.mockResolvedValue([
			{
				id: "person-rawkode-payload-cuid",
				slug: "rawkode",
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
			id: "person-rawkode-payload-cuid",
			githubHandle: "Rawkode",
			githubUrl: "https://github.com/Rawkode",
		});
	});
});
