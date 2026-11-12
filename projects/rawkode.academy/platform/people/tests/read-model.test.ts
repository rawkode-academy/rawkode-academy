import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { graphql } from "graphql";
import { getSchema } from "../read-model/schema";
import { migratedD1, loadFixtures } from "./d1";

let db: Awaited<ReturnType<typeof migratedD1>>;
const query = async (source: string, headers: Record<string, string> = {}) => {
	const result = await graphql({
		schema: getSchema({ DB: db.DB }),
		source,
		contextValue: { request: new Request("https://people.internal/", { headers }) },
	});
	if (result.errors) throw result.errors[0];
	return result.data as Record<string, any>;
};

beforeAll(async () => {
	db = await migratedD1(join(import.meta.dir, ".."));
	await loadFixtures(db.DB);
});
afterAll(() => db.dispose());

describe("people read model", () => {
	it("lists every person", async () => {
		const { allPeople } = await query("{ allPeople { id } }");
		expect(allPeople).toHaveLength(6);
	});

	it("serves a person the way the website subgraph did", async () => {
		const { personById } = await query(`{ personById(id: "salaboy") {
			id name forename surname githubHandle githubUrl avatarUrl
			twitterUrl blueskyUrl linkedinUrl websiteUrl } }`);
		expect(personById).toEqual({
			id: "salaboy",
			name: "Mauricio Salatino",
			forename: "Mauricio",
			surname: "Salatino",
			githubHandle: "salaboy",
			githubUrl: "https://github.com/salaboy",
			avatarUrl: "https://avatars.githubusercontent.com/salaboy",
			twitterUrl: "https://x.com/salaboy",
			blueskyUrl: "https://bsky.app/profile/salaboy.com",
			linkedinUrl: "https://www.linkedin.com/in/salaboy",
			websiteUrl: "https://www.salaboy.com/",
		});
	});

	it("serves updatedAt as an ISO DateTime, null until the row changes", async () => {
		expect((await query(`{ personById(id: "salaboy") { updatedAt } }`)).personById.updatedAt).toBeNull();
		await db.DB.prepare("UPDATE people SET updated_at = 1792777295000 WHERE id = 'salaboy'").run();
		// graphql-scalars hands back a Date; the HTTP response carries it as JSON.
		const { personById } = await query(`{ personById(id: "salaboy") { updatedAt } }`);
		expect(JSON.parse(JSON.stringify(personById))).toEqual({ updatedAt: "2026-10-23T17:41:35.000Z" });
	});

	it("matches GitHub usernames by id first, then by handle", async () => {
		const { personByGithub } = await query(`{ personByGithub(username: "SalaBoy") { id } }`);
		expect(personByGithub).toEqual({ id: "salaboy" });
		const { nobody } = await query(`{ nobody: personByGithub(username: "   ") { id } }`);
		expect(nobody).toBeNull();
	});

	it("resolves me from the gateway's username header", async () => {
		expect((await query("{ me { id } }", { "X-Gateway-User-Username": "salaboy" })).me).toEqual({ id: "salaboy" });
		expect((await query("{ me { id } }")).me).toBeNull();
	});

	it("resolves Person entities for the gateway", async () => {
		const { _entities } = await query(`{ _entities(representations: [{ __typename: "Person", id: "salaboy" }]) { ... on Person { name } } }`);
		expect(_entities).toEqual([{ name: "Mauricio Salatino" }]);
	});
});

describe("people migrations", () => {
	it("upgrade a database created by the original service", async () => {
		const old = await migratedD1(join(import.meta.dir, ".."), "0000_shiny_korvac.sql");
		await old.DB.prepare("INSERT INTO people (id, forename, surname) VALUES ('legacy', 'Old', 'Row')").run();
		const { exec } = await import("./d1");
		const { readFile } = await import("node:fs/promises");
		await exec(old.DB, await readFile(join(import.meta.dir, "../data-model/migrations/0001_content_fields.sql"), "utf8"));
		expect(await old.DB.prepare("SELECT forename, surname, name FROM people WHERE id = 'legacy'").first()).toEqual({ forename: "Old", surname: "Row", name: "" });
		await loadFixtures(old.DB);
		await old.dispose();
	});
});
