import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import federationPlugin from "@pothos/plugin-federation";
import { and, asc, desc, eq, gt, lte, or, type SQLWrapper, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { GraphQLSchema } from "graphql";
import {
	DateTimeResolver,
	JSONObjectResolver,
	JSONResolver,
} from "graphql-scalars";
import * as s from "../data-model/schema";

type Video = s.Video;

export interface PothosTypes {
	Context: Record<string, unknown>;
	Scalars: {
		DateTime: { Input: Date; Output: Date };
		JSON: { Input: unknown; Output: unknown };
		RichTextDocument: {
			Input: s.RichTextDocument;
			Output: s.RichTextDocument;
		};
	};
}

const cdn = "https://content.rawkode.academy/videos";

export const getSchema = (
	env: { DB: D1Database },
	now: () => Date = () => new Date(),
): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: s });
	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, federationPlugin],
	});
	builder.addScalarType("DateTime", DateTimeResolver);
	builder.addScalarType("JSON", JSONResolver);
	// The rich-text document format shared by every content service.
	builder.addScalarType("RichTextDocument", JSONObjectResolver, {
		description:
			'A TipTap/ProseMirror JSON document ({"type":"doc","content":[...]}), see @rawkodeacademy/rich-text.',
	});

	const v = s.videosTable;
	const published = () => lte(v.publishedAt, now());
	const byId = (id: string) => db.select().from(v).where(eq(v.id, id)).get();

	const VideoTypeEnum = builder.enumType("VideoType", {
		values: ["live", "recorded"] as const,
	});
	const VideoCategoryEnum = builder.enumType("VideoCategory", {
		values: [
			"editorial",
			"tutorial",
			"review",
			"interview",
			"announcement",
		] as const,
	});

	// Nested types are prefixed with Video so they cannot clash with other
	// subgraphs in the supergraph.
	const VideoResourceTypeEnum = builder.enumType("VideoResourceType", {
		values: ["url", "file", "embed"] as const,
	});
	const VideoResourceCategoryEnum = builder.enumType("VideoResourceCategory", {
		values: ["slides", "code", "documentation", "demos", "other"] as const,
	});

	const VideoResourceRef = builder.objectRef<s.Resource>("VideoResource");
	builder.objectType(VideoResourceRef, {
		fields: (t) => ({
			id: t.string({ nullable: true, resolve: (r) => r.id }),
			title: t.exposeString("title"),
			description: t.string({ nullable: true, resolve: (r) => r.description }),
			type: t.field({ type: VideoResourceTypeEnum, resolve: (r) => r.type }),
			url: t.string({ nullable: true, resolve: (r) => r.url }),
			filePath: t.string({ nullable: true, resolve: (r) => r.filePath }),
			embedConfig: t.field({
				type: "JSON",
				nullable: true,
				resolve: (r) => r.embedConfig,
			}),
			category: t.field({
				type: VideoResourceCategoryEnum,
				resolve: (r) => r.category,
			}),
		}),
	});

	const VideoRealtimeKitRef = builder.objectRef<s.RealtimeKit>("VideoRealtimeKit");
	builder.objectType(VideoRealtimeKitRef, {
		fields: (t) => ({
			streamId: t.string({ nullable: true, resolve: (r) => r.streamId }),
			meetingId: t.string({ nullable: true, resolve: (r) => r.meetingId }),
			livestreamName: t.string({
				nullable: true,
				resolve: (r) => r.livestreamName,
			}),
			roomName: t.string({ nullable: true, resolve: (r) => r.roomName }),
		}),
	});

	// Just enough to tell which videos changed, without reading whole rows.
	const VideoVersionRef = builder.objectRef<Pick<Video, "id" | "updatedAt">>(
		"VideoVersion",
	);
	builder.objectType(VideoVersionRef, {
		fields: (t) => ({
			id: t.exposeString("id"),
			updatedAt: t.field({
				type: "DateTime",
				nullable: true,
				resolve: (r) => r.updatedAt,
			}),
		}),
	});

	const VideoRef = builder.objectRef<Video>("Video");
	builder.objectType(VideoRef, {
		fields: (t) => ({
			id: t.exposeString("id"),
			title: t.exposeString("title"),
			subtitle: t.string({ nullable: true, resolve: (r) => r.subtitle }),
			tagline: t.string({ nullable: true, resolve: (r) => r.tagline }),
			slug: t.exposeString("slug"),
			description: t.exposeString("description", {
				deprecationReason: "Markdown; use descriptionDoc.",
			}),
			// Null until the description is backfilled.
			descriptionDoc: t.field({
				type: "RichTextDocument",
				nullable: true,
				resolve: (r) => r.descriptionDoc,
			}),
			whatYouWillLearn: t.stringList({
				resolve: (r) => r.whatYouWillLearn ?? [],
			}),
			// A full timestamp: upcoming streams need the time, not just the day.
			publishedAt: t.field({ type: "DateTime", resolve: (r) => r.publishedAt }),
			updatedAt: t.field({
				type: "DateTime",
				nullable: true,
				resolve: (r) => r.updatedAt,
			}),
			duration: t.int({ nullable: true, resolve: (r) => r.duration }),
			audioFileSize: t.int({
				nullable: true,
				resolve: (r) => r.audioFileSize,
			}),
			type: t.field({
				type: VideoTypeEnum,
				nullable: true,
				resolve: (r) => r.type,
			}),
			category: t.field({
				type: VideoCategoryEnum,
				nullable: true,
				resolve: (r) => r.category,
			}),
			youtubeId: t.string({ nullable: true, resolve: (r) => r.youtubeId }),
			realtimeKit: t.field({
				type: VideoRealtimeKitRef,
				nullable: true,
				resolve: (r) => r.realtimeKit,
			}),
			resources: t.field({
				type: [VideoResourceRef],
				resolve: (r) => r.resources ?? [],
			}),
			streamUrl: t.string({
				resolve: (r) => `${cdn}/${r.id}/stream.m3u8`,
			}),
			thumbnailUrl: t.string({
				resolve: (r) => `${cdn}/${r.id}/thumbnail.webp`,
			}),
		}),
	});

	builder.asEntity(VideoRef, {
		key: builder.selection<{ id: string }>("id"),
		resolveReference: (ref) => byId(ref.id),
	});

	builder.queryType({
		fields: (t) => ({
			videoByID: t.field({
				type: VideoRef,
				nullable: true,
				args: { id: t.arg.string({ required: true }) },
				resolve: (_root, args) => byId(args.id),
			}),
			videoBySlug: t.field({
				type: VideoRef,
				nullable: true,
				args: { slug: t.arg.string({ required: true }) },
				resolve: (_root, args) =>
					db.select().from(v).where(eq(v.slug, args.slug)).get(),
			}),
			// Every video, upcoming streams included.
			getAllVideos: t.field({
				type: [VideoRef],
				resolve: () =>
					db.select().from(v).orderBy(desc(v.publishedAt), asc(v.id)).all(),
			}),
			// Every video's id and updatedAt, upcoming streams included, for change
			// detection. updatedAt is null for rows not touched since the import.
			getVideoVersions: t.field({
				type: [VideoVersionRef],
				resolve: () =>
					db
						.select({ id: v.id, updatedAt: v.updatedAt })
						.from(v)
						.orderBy(asc(v.id))
						.all(),
			}),
			getLatestVideos: t.field({
				type: [VideoRef],
				args: {
					limit: t.arg.int({ defaultValue: 15 }),
					offset: t.arg.int({ defaultValue: 0 }),
				},
				resolve: (_root, args) =>
					db
						.select()
						.from(v)
						.where(published())
						.orderBy(desc(v.publishedAt))
						.limit(args.limit ?? 15)
						.offset(args.offset ?? 0)
						.all(),
			}),
			getUpcomingVideos: t.field({
				type: [VideoRef],
				args: {
					limit: t.arg.int({ defaultValue: 15 }),
					offset: t.arg.int({ defaultValue: 0 }),
				},
				resolve: (_root, args) =>
					db
						.select()
						.from(v)
						.where(and(eq(v.type, "live"), gt(v.publishedAt, now())))
						.orderBy(asc(v.publishedAt))
						.limit(args.limit ?? 15)
						.offset(args.offset ?? 0)
						.all(),
			}),
			getRandomVideos: t.field({
				type: [VideoRef],
				args: { limit: t.arg.int({ defaultValue: 5 }) },
				resolve: (_root, args) =>
					db
						.select()
						.from(v)
						.where(published())
						.orderBy(sql`random()`)
						.limit(args.limit ?? 5)
						.all(),
			}),
			simpleSearch: t.field({
				type: [VideoRef],
				args: {
					term: t.arg.string({ required: true }),
					limit: t.arg.int({ defaultValue: 15 }),
				},
				resolve: (_root, args) => {
					// SQLite LIKE is case-insensitive for ASCII, matching the old
					// lower-cased substring search.
					const term = `%${args.term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
					const match = (column: SQLWrapper) =>
						sql`${column} like ${term} escape '\\'`;
					return db
						.select()
						.from(v)
						.where(
							and(published(), or(match(v.title), match(v.description), match(v.subtitle))),
						)
						.orderBy(desc(v.publishedAt))
						.limit(args.limit ?? 15)
						.all();
				},
			}),
		}),
	});

	return builder.toSubGraphSchema({
		linkUrl: "https://specs.apollo.dev/federation/v2.6",
		federationDirectives: ["@key"],
	});
};
