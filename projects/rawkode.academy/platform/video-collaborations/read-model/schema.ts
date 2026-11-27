import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import federationPlugin from "@pothos/plugin-federation";
import { and, asc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { drizzle } from "drizzle-orm/d1";
import type { GraphQLSchema } from "graphql";
import {
	type AnalyticsSnapshot,
	type CollaboratorAnalytics,
	type Period,
	type VideoAnalytics,
	analyticsFor,
} from "../../../../../packages/guest-scope/partner";
import * as s from "../data-model/schema";

export interface PothosTypes {
	Context: Record<string, unknown>;
	// Fields are non-null unless they opt out with nullable: true.
	DefaultFieldNullability: false;
}

const subgraph = {
	linkUrl: "https://specs.apollo.dev/federation/v2.6",
	federationDirectives: ["@extends", "@external", "@key"],
};

const collaborators = s.collaboratorsTable;
const links = s.videoCollaborationsTable;

// Started (or no start), and not yet ended (or no end).
const isActive = (now: Date) =>
	and(
		or(isNull(links.startsAt), lte(links.startsAt, now)),
		or(isNull(links.endsAt), gt(links.endsAt, now)),
	);

const ADMIN_ROLE = "collab_admin";
export const ANNOUNCEMENT_MAX = 280;
const SNAPSHOT_KEY = "analytics:snapshot:v2";

type SnapshotVideos = AnalyticsSnapshot;

/** Staff, or anyone who belongs to the collaborator's organisation. */
export const mayViewAnalytics = (
	caller: { roles?: string[]; orgs?: { id: string; role: string }[] },
	organizationId: string | null,
) =>
	(caller.roles ?? []).includes(ADMIN_ROLE) ||
	(organizationId !== null && (caller.orgs ?? []).some((org) => org.id === organizationId));

export const getSchema = (env: { DB: D1Database; ANALYTICS_SNAPSHOT?: KVNamespace }): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: s });
	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, federationPlugin],
		defaultFieldNullability: false,
	});

	const VideoRef = builder.externalRef("Video", builder.selection<{ id: string }>("id"));

	// The schema is built once per isolate, so "active" is decided per request.
	// The table holds a few rows; one query per request serves every video in a list.
	type Link = { videoId: string; collaborator: s.Collaborator };
	const perRequest = new WeakMap<object, Promise<Link[]>>();
	const activeLinks = (context: object): Promise<Link[]> => {
		let rows = perRequest.get(context);
		if (!rows) {
			rows = db
				.select({ videoId: links.videoId, collaborator: collaborators })
				.from(links)
				.innerJoin(collaborators, eq(links.collaboratorId, collaborators.id))
				.where(isActive(new Date()))
				.orderBy(asc(collaborators.id), asc(links.videoId))
				.all();
			perRequest.set(context, rows);
		}
		return rows;
	};

	const PeriodRef = builder.objectRef<Period>("AnalyticsPeriod");
	builder.objectType(PeriodRef, {
		fields: (t) => ({
			d90: t.exposeInt("d90"),
			lifetime: t.exposeInt("lifetime"),
		}),
	});
	const VideoAnalyticsRef = builder.objectRef<VideoAnalytics>("VideoAnalytics");
	builder.objectType(VideoAnalyticsRef, {
		fields: (t) => ({
			id: t.exposeID("id"),
			title: t.exposeString("title"),
			slug: t.exposeString("slug"),
			siteViews: t.field({ type: PeriodRef, resolve: (r) => r.siteViews }),
			// Null when the video can't be tied to one YouTube video with certainty.
			youtubeViews: t.field({ type: PeriodRef, nullable: true, resolve: (r) => r.youtubeViews }),
			minutesWatched: t.field({ type: PeriodRef, nullable: true, resolve: (r) => r.minutesWatched }),
		}),
	});
	const CollaboratorAnalyticsRef = builder.objectRef<CollaboratorAnalytics>("CollaboratorAnalytics");
	builder.objectType(CollaboratorAnalyticsRef, {
		fields: (t) => ({
			generatedAt: t.exposeString("generatedAt"),
			siteViews: t.field({ type: PeriodRef, resolve: (r) => r.siteViews }),
			youtubeViews: t.field({ type: PeriodRef, resolve: (r) => r.youtubeViews }),
			minutesWatched: t.field({ type: PeriodRef, resolve: (r) => r.minutesWatched }),
			videos: t.field({ type: [VideoAnalyticsRef], resolve: (r) => r.videos }),
		}),
	});

	const CollaboratorRef = builder.objectRef<s.Collaborator>("Collaborator");
	builder.objectType(CollaboratorRef, {
		fields: (t) => ({
			id: t.exposeID("id"),
			name: t.exposeString("name"),
			websiteUrl: t.exposeString("websiteUrl"),
			logoUrl: t.string({ nullable: true, resolve: (r) => r.logoUrl }),
			// The identity organisation this company's staff belong to.
			organizationId: t.string({ nullable: true, resolve: (r) => r.organizationId }),
			// What the partner wants viewers to know; null when they have not set one.
			announcement: t.string({ nullable: true, resolve: (r) => r.announcement }),
			announcementUrl: t.string({ nullable: true, resolve: (r) => r.announcementUrl }),
			videos: t.field({
				type: [VideoRef],
				resolve: async (collaborator, _args, context) =>
					(await activeLinks(context))
						.filter((link) => link.collaborator.id === collaborator.id)
						.map((link) => ({ id: link.videoId })),
			}),
			// Views and watch time of this company's videos, refreshed daily. Only
			// staff and members of the company's organisation can read it.
			analytics: t.field({
				type: CollaboratorAnalyticsRef,
				nullable: true,
				resolve: async (collaborator, _args, context) => {
					const caller = context as { roles?: string[]; orgs?: { id: string; role: string }[] };
					if (!mayViewAnalytics(caller, collaborator.organizationId)) return null;
					const snapshot = await env.ANALYTICS_SNAPSHOT?.get<SnapshotVideos>(SNAPSHOT_KEY, { type: "json" });
					if (!snapshot) return null;
					const ids = (await activeLinks(context))
						.filter((link) => link.collaborator.id === collaborator.id)
						.map((link) => link.videoId);
					return analyticsFor(snapshot, ids);
				},
			}),
		}),
	});

	builder.asEntity(CollaboratorRef, {
		key: builder.selection<{ id: string }>("id"),
		resolveReference: (ref) =>
			db.select().from(collaborators).where(eq(collaborators.id, ref.id)).get(),
	});

	VideoRef.implement({
		externalFields: (f) => ({ id: f.string() }),
		fields: (f) => ({
			// Companies this video is made with; empty for most videos.
			collaborators: f.field({
				type: [CollaboratorRef],
				resolve: async (video, _args, context) =>
					(await activeLinks(context))
						.filter((link) => link.videoId === video.id)
						.map((link) => link.collaborator),
			}),
			isCollaboration: f.boolean({
				resolve: async (video, _args, context) =>
					(await activeLinks(context)).some((link) => link.videoId === video.id),
			}),
		}),
	});

	builder.queryType({
		fields: (t) => ({
			collaborator: t.field({
				type: CollaboratorRef,
				nullable: true,
				args: { id: t.arg.id({ required: true }) },
				resolve: (_root, args) =>
					db.select().from(collaborators).where(eq(collaborators.id, String(args.id))).get(),
			}),
			collaborators: t.field({
				type: [CollaboratorRef],
				resolve: () => db.select().from(collaborators).orderBy(asc(collaborators.id)).all(),
			}),
		}),
	});

	builder.mutationType({
		fields: (t) => ({
			// Partners (and staff) set the note shown with their videos. An empty
			// text clears it; the link is optional and must be https.
			setAnnouncement: t.field({
				type: CollaboratorRef,
				args: {
					collaboratorId: t.arg.id({ required: true }),
					text: t.arg.string({ required: true }),
					url: t.arg.string({ required: false }),
				},
				resolve: async (_root, args, context) => {
					const caller = context as { userId?: string | null; roles?: string[]; orgs?: { id: string; role: string }[] };
					if (!caller.userId) throw new GraphQLError("Sign in to continue");
					const id = String(args.collaboratorId);
					const collaborator = await db.select().from(collaborators).where(eq(collaborators.id, id)).get();
					if (!collaborator || !mayViewAnalytics(caller, collaborator.organizationId)) {
						throw new GraphQLError("You can't change this company's announcement");
					}
					const text = args.text.trim();
					if (text.length > ANNOUNCEMENT_MAX) {
						throw new GraphQLError(`Keep the announcement under ${ANNOUNCEMENT_MAX} characters`);
					}
					const url = text ? (args.url ?? "").trim() || null : null;
					if (url) {
						try {
							if (new URL(url).protocol !== "https:") throw new Error();
						} catch {
							throw new GraphQLError("The link must be an https URL");
						}
					}
					await db
						.update(collaborators)
						.set({ announcement: text || null, announcementUrl: url })
						.where(eq(collaborators.id, id));
					return { ...collaborator, announcement: text || null, announcementUrl: url };
				},
			}),
		}),
	});

	return builder.toSubGraphSchema(subgraph);
};
