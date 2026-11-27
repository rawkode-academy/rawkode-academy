import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import federationPlugin from "@pothos/plugin-federation";
import { and, asc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { GraphQLSchema } from "graphql";
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

export const getSchema = (env: { DB: D1Database }): GraphQLSchema => {
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

	const CollaboratorRef = builder.objectRef<s.Collaborator>("Collaborator");
	builder.objectType(CollaboratorRef, {
		fields: (t) => ({
			id: t.exposeID("id"),
			name: t.exposeString("name"),
			websiteUrl: t.exposeString("websiteUrl"),
			logoUrl: t.string({ nullable: true, resolve: (r) => r.logoUrl }),
			// The identity organisation this company's staff belong to.
			organizationId: t.string({ nullable: true, resolve: (r) => r.organizationId }),
			videos: t.field({
				type: [VideoRef],
				resolve: async (collaborator, _args, context) =>
					(await activeLinks(context))
						.filter((link) => link.collaborator.id === collaborator.id)
						.map((link) => ({ id: link.videoId })),
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

	return builder.toSubGraphSchema(subgraph);
};
