import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import federationPlugin from "@pothos/plugin-federation";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { GraphQLSchema } from "graphql";
import { DateTimeResolver } from "graphql-scalars";
import * as s from "../data-model/schema";

type Testimonial = s.Testimonial;

export interface PothosTypes {
	Context: Record<string, unknown>;
	Scalars: {
		DateTime: { Input: Date; Output: Date };
	};
}

export const getSchema = (env: { DB: D1Database }): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: s });
	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, federationPlugin],
	});

	builder.addScalarType("DateTime", DateTimeResolver);

	const byId = (id: string) =>
		db
			.select()
			.from(s.testimonialsTable)
			.where(eq(s.testimonialsTable.id, id))
			.get();

	const TestimonialTypeEnum = builder.enumType("TestimonialType", {
		values: ["maintainer", "partner", "viewer"] as const,
	});

	// The author is embedded in the testimonial, not a Person.
	const TestimonialAuthorRef = builder.objectRef<Testimonial>("TestimonialAuthor");
	builder.objectType(TestimonialAuthorRef, {
		fields: (t) => ({
			name: t.exposeString("authorName"),
			title: t.exposeString("authorTitle"),
			image: t.exposeString("authorImage"),
			link: t.string({ nullable: true, resolve: (r) => r.authorLink }),
		}),
	});

	const TestimonialRef = builder.objectRef<Testimonial>("Testimonial");
	builder.objectType(TestimonialRef, {
		fields: (t) => ({
			id: t.exposeString("id"),
			type: t.field({ type: TestimonialTypeEnum, resolve: (r) => r.type }),
			quote: t.exposeString("quote"),
			author: t.field({ type: TestimonialAuthorRef, resolve: (r) => r }),
			updatedAt: t.field({
				type: "DateTime",
				nullable: true,
				resolve: (r) => r.updatedAt,
			}),
		}),
	});

	builder.asEntity(TestimonialRef, {
		key: builder.selection<{ id: string }>("id"),
		resolveReference: (ref) => byId(ref.id),
	});

	builder.queryType({
		fields: (t) => ({
			allTestimonials: t.field({
				type: [TestimonialRef],
				resolve: () =>
					db
						.select()
						.from(s.testimonialsTable)
						.orderBy(asc(s.testimonialsTable.id))
						.all(),
			}),
		}),
	});

	return builder.toSubGraphSchema({
		linkUrl: "https://specs.apollo.dev/federation/v2.6",
		federationDirectives: ["@key"],
	});
};
