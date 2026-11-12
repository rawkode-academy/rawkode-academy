import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { graphql } from "graphql";
import { getSchema } from "../read-model/schema";
import { exec, migratedD1, loadFixtures } from "./d1";

let db: Awaited<ReturnType<typeof migratedD1>>;
const query = async (source: string) => {
	const result = await graphql({ schema: getSchema({ DB: db.DB }), source, contextValue: {} });
	if (result.errors) throw result.errors[0];
	return result.data as Record<string, any>;
};

beforeAll(async () => {
	db = await migratedD1(join(import.meta.dir, ".."));
	await loadFixtures(db.DB);
});
afterAll(() => db.dispose());

describe("technologies read model", () => {
	it("lists every technology, sorted by id", async () => {
		const { getTechnologies } = await query("{ getTechnologies(limit: 1000) { id } }");
		expect(getTechnologies).toHaveLength(21);
		const ids = getTechnologies.map((t: { id: string }) => t.id);
		expect(ids).toEqual([...ids].sort());
	});

	it("serves every technology from allTechnologies, ignoring the page size", async () => {
		const { allTechnologies, getTechnologies } = await query("{ allTechnologies { id } getTechnologies(limit: 1000) { id } }");
		expect(allTechnologies).toHaveLength(21);
		expect(allTechnologies).toEqual(getTechnologies);
	});

	it("pages like the website subgraph: sorted by id, 15 by default", async () => {
		const { first, second } = await query("{ first: getTechnologies { id } second: getTechnologies(offset: 15, limit: 2) { id } }");
		expect(first).toHaveLength(15);
		const { all } = await query("{ all: getTechnologies(limit: 17) { id } }");
		expect(second).toEqual(all.slice(15, 17));
	});

	it("serves a profile with logos from the CDN", async () => {
		const { technologyById } = await query(`{ technologyById(id: "kubernetes") {
			id name icon logo website source documentation license status category
			learningResources { official } } }`);
		expect(technologyById).toMatchObject({
			id: "kubernetes",
			name: "Kubernetes",
			icon: "https://content.rawkode.academy/technologies/kubernetes/icon.svg",
			logo: "https://content.rawkode.academy/technologies/kubernetes/icon.svg",
			website: "https://kubernetes.io/",
			source: "https://github.com/kubernetes/kubernetes",
			license: "Apache-2.0",
			status: "stable",
		});
		expect(Array.isArray(technologyById.learningResources?.official ?? [])).toBe(true);
	});

	it("falls back like the website: no icon flag means no icon, but a logo URL", async () => {
		const { technologyById } = await query(`{ technologyById(id: "acorn") { icon logo documentation } }`);
		expect(technologyById.icon).toBeNull();
		expect(technologyById.logo).toBe("https://content.rawkode.academy/logos/technologies/acorn.svg");
	});

	it("serves every logo variant flagged in logos", async () => {
		const { technologyById } = await query(`{ technologyById(id: "kubernetes") {
			icon horizontalLogo stackedLogo logos { icon horizontal stacked } } }`);
		expect(technologyById).toEqual({
			icon: "https://content.rawkode.academy/technologies/kubernetes/icon.svg",
			horizontalLogo: "https://content.rawkode.academy/technologies/kubernetes/horizontal.svg",
			stackedLogo: "https://content.rawkode.academy/technologies/kubernetes/stacked.svg",
			logos: { icon: true, horizontal: true, stacked: true },
		});
	});

	it("serves no URL for a missing variant, and false flags when logos is unset", async () => {
		const { acorn, apko } = await query(`{
			acorn: technologyById(id: "acorn") { icon horizontalLogo stackedLogo logos { icon horizontal stacked } }
			apko: technologyById(id: "apko") { icon horizontalLogo stackedLogo logos { icon horizontal stacked } } }`);
		expect(acorn).toEqual({
			icon: null,
			horizontalLogo: "https://content.rawkode.academy/technologies/acorn/horizontal.svg",
			stackedLogo: null,
			logos: { icon: false, horizontal: true, stacked: false },
		});
		expect(apko).toEqual({
			icon: null,
			horizontalLogo: null,
			stackedLogo: null,
			logos: { icon: false, horizontal: false, stacked: false },
		});
	});

	it("serves the cncf, community, matrix and seo profile", async () => {
		const { technologyById } = await query(`{ technologyById(id: "kubernetes") {
			cncf { status accepted incubating graduated archived devStatsUrl personas tags integrations releaseRate }
			community { twitter youtube slack discord chat blog mailingList githubDiscussions }
			matrix { status grouping confidence trajectory firstUsed lastUsed makesMeFeel why spicyTake }
			seo { title description } } }`);
		expect(technologyById.cncf).toEqual({
			status: "graduated",
			accepted: "2016-03-10",
			incubating: "2016-03-10",
			graduated: "2018-03-06",
			archived: null,
			devStatsUrl: "https://k8s.devstats.cncf.io/",
			personas: [],
			tags: [],
			integrations: [],
			releaseRate: null,
		});
		expect(technologyById.community).toEqual({
			twitter: "https://twitter.com/kubernetesio",
			youtube: "https://www.youtube.com/channel/UCZ2bu0qutTOM0tHYa_jkIwg",
			slack: "http://slack.k8s.io/",
			discord: null,
			chat: null,
			blog: "http://blog.kubernetes.io/",
			mailingList: "https://groups.google.com/forum/#!forum/kubernetes-dev",
			githubDiscussions: null,
		});
		expect(technologyById.matrix).toMatchObject({
			status: "advocate",
			grouping: "plumbing",
			confidence: "deep-experience",
			trajectory: "rising",
			firstUsed: "2017-03",
			lastUsed: "Present",
			makesMeFeel: "🚀",
		});
		expect(technologyById.matrix.spicyTake).toContain("Java");
		expect(technologyById.seo).toEqual({
			title: "Kubernetes Tutorials, Guides, and Best Practices",
			description: expect.stringContaining("Learn Kubernetes"),
		});
	});

	it("serves cncf lists, and null for profile sections a technology lacks", async () => {
		const { backstage, rust } = await query(`{
			backstage: technologyById(id: "backstage") { cncf { status graduated personas integrations } community { twitter discord } seo { title } }
			rust: technologyById(id: "rust") { cncf { status } community { blog } matrix { status grouping } seo { title } } }`);
		expect(backstage).toEqual({
			cncf: {
				status: "incubating",
				graduated: null,
				personas: ["Developers", "SREs"],
				integrations: ["Kubernetes", "GitHub", "GitLab", "Bitbucket", "Azure DevOps", "Jenkins", "and more with plugins"],
			},
			community: { twitter: null, discord: "https://discord.gg/backstage-687207715902193673" },
			seo: null,
		});
		expect(rust).toEqual({ cncf: null, community: null, matrix: { status: "learn", grouping: null }, seo: null });
	});

	it("resolves Technology entities for the gateway", async () => {
		const { _entities } = await query(`{ _entities(representations: [{ __typename: "Technology", id: "kubernetes" }]) { ... on Technology { name } } }`);
		expect(_entities).toEqual([{ name: "Kubernetes" }]);
	});
});

describe("technologies updatedAt", () => {
	it("is null until a row is edited, then an ISO timestamp", async () => {
		const fresh = await migratedD1(join(import.meta.dir, ".."));
		await loadFixtures(fresh.DB);
		const read = async () => {
			const result = await graphql({
				schema: getSchema({ DB: fresh.DB }),
				source: `{ technologyById(id: "kubernetes") { updatedAt } }`,
				contextValue: {},
			});
			if (result.errors) throw result.errors[0];
			return (result.data as Record<string, any>).technologyById.updatedAt;
		};
		expect(await read()).toBeNull();
		await fresh.DB.prepare("UPDATE technologies SET updated_at = ? WHERE id = 'kubernetes'").bind(Date.UTC(2026, 9, 23, 17, 32, 30)).run();
		// Served as a Date; JSON (the HTTP response) carries it as ISO 8601.
		expect(JSON.stringify(await read())).toBe('"2026-10-23T17:32:30.000Z"');
		await fresh.dispose();
	});
});

describe("technologies migrations", () => {
	it("upgrade a database created by the original service", async () => {
		const old = await migratedD1(join(import.meta.dir, ".."), "0000_acoustic_expediter.sql");
		await old.DB.prepare("INSERT INTO technologies (id, name, description) VALUES ('legacy', 'Legacy', 'Old')").run();
		await exec(old.DB, await readFile(join(import.meta.dir, "../data-model/migrations/0001_content_fields.sql"), "utf8"));
		expect(await old.DB.prepare("SELECT name, description FROM technologies WHERE id = 'legacy'").first()).toEqual({ name: "Legacy", description: "Old" });
		await loadFixtures(old.DB);
		expect((await old.DB.prepare("SELECT count(*) AS n FROM technologies").first<{ n: number }>())?.n).toBe(22);
		await old.dispose();
	});
});
