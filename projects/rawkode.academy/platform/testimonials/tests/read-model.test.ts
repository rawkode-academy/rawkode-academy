import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { graphql } from "graphql";
import { getSchema } from "../read-model/schema";
import { migratedD1, loadFixtures } from "./d1";

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

describe("testimonials read model", () => {
	it("lists every testimonial, sorted by id, keeping the original ids", async () => {
		const { allTestimonials } = await query("{ allTestimonials { id } }");
		const ids = allTestimonials.map((t: { id: string }) => t.id);
		expect(ids).toHaveLength(12);
		expect(ids).toEqual([...ids].sort());
		expect(ids).toContain("brain-ketelsen");
	});

	it("serves the type, the verbatim quote and the embedded author", async () => {
		const { allTestimonials } = await query("{ allTestimonials { id type quote author { name title image link } updatedAt } }");
		const solomon = allTestimonials.find((t: { id: string }) => t.id === "solomon-hykes");
		expect(solomon).toMatchObject({ type: "maintainer", author: { name: "Solomon Hykes", title: "Co-Founder of Docker & Dagger", link: null } });
		expect(solomon.quote).toContain("day before 😁. Your");
		expect(solomon.quote).toContain("interaction.\n\nI encourage");
		expect(solomon.quote.endsWith("better.\n")).toBe(true);
		// DateTime serialises to an ISO 8601 string on the wire.
		expect(JSON.parse(JSON.stringify(solomon.updatedAt))).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
		const mikkel = allTestimonials.find((t: { id: string }) => t.id === "mikkel-hegnhoj");
		expect(mikkel).toMatchObject({ type: "partner", author: { name: "Mikkel Mørk Hegnhøj", link: "https://fermyon.com" } });
	});

	it("returns a null updatedAt when it is not set", async () => {
		await db.DB.prepare("UPDATE testimonials SET updated_at = NULL WHERE id = 'hugo-santos'").run();
		const { allTestimonials } = await query("{ allTestimonials { id updatedAt } }");
		expect(allTestimonials.find((t: { id: string }) => t.id === "hugo-santos").updatedAt).toBeNull();
	});

	it("resolves Testimonial entities for the gateway", async () => {
		const { _entities } = await query(`{ _entities(representations: [{ __typename: "Testimonial", id: "brain-ketelsen" }]) { ... on Testimonial { author { name } } } }`);
		expect(_entities).toEqual([{ author: { name: "Brian J Ketelsen" } }]);
	});
});
