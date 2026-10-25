import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import federationPlugin from "@pothos/plugin-federation";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { GraphQLSchema } from "graphql";
import { DateTimeResolver, JSONObjectResolver } from "graphql-scalars";
import * as s from "../data-model/schema";

type Show = s.Show;

export interface PothosTypes {
	Context: Record<string, unknown>;
	Scalars: {
		DateTime: { Input: Date; Output: Date };
		RichTextDocument: {
			Input: s.RichTextDocument;
			Output: s.RichTextDocument;
		};
	};
}

export const getSchema = (env: { DB: D1Database }): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: s });
	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, federationPlugin],
	});

	builder.addScalarType("DateTime", DateTimeResolver);
	// The rich-text document format shared by every content service.
	builder.addScalarType("RichTextDocument", JSONObjectResolver, {
		description:
			'A TipTap/ProseMirror JSON document ({"type":"doc","content":[...]}), see @rawkodeacademy/rich-text.',
	});

	const byId = (id: string) =>
		db.select().from(s.showsTable).where(eq(s.showsTable.id, id)).get();

	// GraphQL enum values cannot contain "-", so the stored "coming-soon" is
	// served as coming_soon. Clients that kept the file values map it back.
	const ShowStatusEnum = builder.enumType("ShowStatus", {
		values: ["coming_soon", "active", "archived"] as const,
	});

	// iTunes metadata for shows published as a podcast.
	const PodcastRef = builder.objectRef<s.Podcast>("ShowPodcast").implement({
		fields: (t) => ({
			guid: t.string({ nullable: true, resolve: (p) => p.guid }),
			email: t.exposeString("email"),
			category: t.exposeString("category"),
			subcategory: t.string({ nullable: true, resolve: (p) => p.subcategory }),
			explicit: t.exposeBoolean("explicit"),
			copyright: t.string({ nullable: true, resolve: (p) => p.copyright }),
			artworkUrl: t.string({ nullable: true, resolve: (p) => p.artworkUrl }),
		}),
	});

	const SubscribeLinkRef = builder
		.objectRef<s.SubscribeLink>("ShowSubscribeLink")
		.implement({
			fields: (t) => ({
				platform: t.exposeString("platform"),
				url: t.exposeString("url"),
				icon: t.exposeString("icon"),
			}),
		});

	const ShowRef = builder.objectRef<Show>("Show");
	builder.objectType(ShowRef, {
		fields: (t) => ({
			id: t.exposeString("id"),
			name: t.exposeString("name"),
			description: t.string({
				nullable: true,
				deprecationReason: "Markdown; use descriptionDoc.",
				resolve: (r) => r.description,
			}),
			// Null when the show has no description or it is not backfilled yet.
			descriptionDoc: t.field({
				type: "RichTextDocument",
				nullable: true,
				resolve: (r) => r.descriptionDoc,
			}),
			tagline: t.string({ nullable: true, resolve: (r) => r.tagline }),
			status: t.field({
				type: ShowStatusEnum,
				resolve: (r) => (r.status === "coming-soon" ? "coming_soon" : r.status),
			}),
			published: t.exposeBoolean("published"),
			gameFormatUrl: t.string({
				nullable: true,
				resolve: (r) => r.gameFormatUrl,
			}),
			coverUrl: t.string({ nullable: true, resolve: (r) => r.coverUrl }),
			coverAlt: t.string({ nullable: true, resolve: (r) => r.coverAlt }),
			coverWidth: t.int({ nullable: true, resolve: (r) => r.coverWidth }),
			coverHeight: t.int({ nullable: true, resolve: (r) => r.coverHeight }),
			podcast: t.field({
				type: PodcastRef,
				nullable: true,
				resolve: (r) => r.podcast,
			}),
			subscribeLinks: t.field({
				type: [SubscribeLinkRef],
				resolve: (r) => r.subscribeLinks ?? [],
			}),
			// When the row last changed; null for rows never edited since seeding.
			updatedAt: t.field({
				type: "DateTime",
				nullable: true,
				resolve: (r) => r.updatedAt,
			}),
		}),
	});

	builder.asEntity(ShowRef, {
		key: builder.selection<{ id: string }>("id"),
		resolveReference: (ref) => byId(ref.id),
	});

	builder.queryType({
		fields: (t) => ({
			showById: t.field({
				type: ShowRef,
				nullable: true,
				args: { id: t.arg.string({ required: true }) },
				resolve: (_root, args) => byId(args.id),
			}),
			allShows: t.field({
				type: [ShowRef],
				resolve: () =>
					db.select().from(s.showsTable).orderBy(asc(s.showsTable.id)).all(),
			}),
		}),
	});

	return builder.toSubGraphSchema({
		linkUrl: "https://specs.apollo.dev/federation/v2.6",
		federationDirectives: ["@key"],
	});
};
