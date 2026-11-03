import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import federationPlugin from "@pothos/plugin-federation";
import { asc, eq, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { GraphQLSchema } from "graphql";
import { DateTimeResolver } from "graphql-scalars";
import * as s from "../data-model/schema";

type Person = s.Person;

export interface PeopleReadContext {
	request?: Request;
}

export interface PothosTypes {
	Context: PeopleReadContext;
	Scalars: {
		DateTime: { Input: Date; Output: Date };
	};
}

// Same rule the website used to match a GitHub username to a person id.
export function normalizeGithubHandle(handle: string): string {
	return handle
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

const url = (prefix: string, handle: string | null) =>
	handle ? `${prefix}${handle}` : null;

export const getSchema = (env: { DB: D1Database }): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: s });
	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, federationPlugin],
	});

	builder.addScalarType("DateTime", DateTimeResolver);

	const byId = (id: string) =>
		db.select().from(s.peopleTable).where(eq(s.peopleTable.id, id)).get();

	const byGithub = async (username: string): Promise<Person | undefined> => {
		const normalized = normalizeGithubHandle(username);
		if (!normalized) return undefined;
		const direct = await byId(normalized);
		if (direct) return direct;
		// Handles are stored as written; compare them the same normalised way.
		const candidates = await db
			.select()
			.from(s.peopleTable)
			.where(isNotNull(s.peopleTable.github))
			.all();
		return candidates.find(
			(person) =>
				person.github && normalizeGithubHandle(person.github) === normalized,
		);
	};

	const PersonRef = builder.objectRef<Person>("Person");
	builder.objectType(PersonRef, {
		fields: (t) => ({
			id: t.exposeString("id"),
			name: t.exposeString("name"),
			forename: t.exposeString("forename"),
			surname: t.exposeString("surname"),
			githubHandle: t.string({ nullable: true, resolve: (p) => p.github }),
			githubUrl: t.string({
				nullable: true,
				resolve: (p) => url("https://github.com/", p.github),
			}),
			avatarUrl: t.string({
				nullable: true,
				resolve: (p) => url("https://avatars.githubusercontent.com/", p.github),
			}),
			twitterHandle: t.string({ nullable: true, resolve: (p) => p.twitter }),
			twitterUrl: t.string({
				nullable: true,
				resolve: (p) => url("https://x.com/", p.twitter),
			}),
			blueskyHandle: t.string({ nullable: true, resolve: (p) => p.bluesky }),
			blueskyUrl: t.string({
				nullable: true,
				resolve: (p) => url("https://bsky.app/profile/", p.bluesky),
			}),
			linkedinHandle: t.string({ nullable: true, resolve: (p) => p.linkedin }),
			linkedinUrl: t.string({
				nullable: true,
				resolve: (p) => url("https://www.linkedin.com/in/", p.linkedin),
			}),
			mastodonUrl: t.string({ nullable: true, resolve: (p) => p.mastodon }),
			websiteUrl: t.string({ nullable: true, resolve: (p) => p.website }),
			youtubeUrl: t.string({ nullable: true, resolve: (p) => p.youtube }),
			// When the people row last changed; null for rows never edited since
			// seeding. Biography and links live in their own services and are not
			// covered by this timestamp.
			updatedAt: t.field({
				type: "DateTime",
				nullable: true,
				resolve: (p) => p.updatedAt,
			}),
		}),
	});

	builder.asEntity(PersonRef, {
		key: builder.selection<{ id: string }>("id"),
		resolveReference: (ref) => byId(ref.id),
	});

	builder.queryType({
		fields: (t) => ({
			personById: t.field({
				type: PersonRef,
				nullable: true,
				args: { id: t.arg.string({ required: true }) },
				resolve: (_root, args) => byId(args.id),
			}),
			personByGithub: t.field({
				type: PersonRef,
				nullable: true,
				args: { username: t.arg.string({ required: true }) },
				resolve: (_root, args) => byGithub(args.username),
			}),
			allPeople: t.field({
				type: [PersonRef],
				resolve: () =>
					db.select().from(s.peopleTable).orderBy(asc(s.peopleTable.id)).all(),
			}),
			// The gateway forwards the signed-in member's GitHub username.
			me: t.field({
				type: PersonRef,
				nullable: true,
				resolve: (_root, _args, ctx) => {
					const username = ctx.request?.headers.get("X-Gateway-User-Username");
					return username ? byGithub(username) : null;
				},
			}),
		}),
	});

	return builder.toSubGraphSchema({
		linkUrl: "https://specs.apollo.dev/federation/v2.6",
		federationDirectives: ["@key"],
	});
};
