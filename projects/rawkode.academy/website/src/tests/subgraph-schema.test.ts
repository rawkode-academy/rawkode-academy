import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("website content subgraph schema", () => {
	it("exposes GitHub-backed person lookup fields for Studio", () => {
		const sdl = readFileSync(
			join(process.cwd(), "src/subgraph/schema.gql"),
			"utf8",
		);

		expect(sdl).toContain("avatarUrl: String");
		expect(sdl).toContain("githubHandle: String");
		expect(sdl).toContain("githubUrl: String");
		expect(sdl).toContain("personByGithub(username: String!): Person");
		expect(sdl).toContain("getUpcomingVideos(limit: Int = 15, offset: Int = 0): [Video!]");
		expect(sdl).toContain("me: Person");
	});
});
