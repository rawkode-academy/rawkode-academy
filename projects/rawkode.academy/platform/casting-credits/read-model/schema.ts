import type { D1Database } from "@cloudflare/workers-types";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import federationPlugin from "@pothos/plugin-federation";
import { and, asc, eq, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { GraphQLSchema } from "graphql";
import * as s from "../data-model/schema";

export interface PothosTypes {
	Context: Record<string, unknown>;
}

const subgraph = {
	linkUrl: "https://specs.apollo.dev/federation/v2.6",
	federationDirectives: ["@extends", "@external", "@key"],
};

const ROLE_ENUM = {
	HOST: { value: "host" },
	CO_HOST: { value: "co_host" },
	GUEST: { value: "guest" },
	AUTHOR: { value: "author" },
} as const;

const SUBJECT_TYPE_ENUM = {
	VIDEO: { value: "video" },
	SHOW: { value: "show" },
	EPISODE: { value: "episode" },
	COURSE: { value: "course" },
} as const;

export const getSchema = (env: { DB: D1Database }): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: s });
	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, federationPlugin],
	});
	const t = s.castingCreditsTable;

	const Role = builder.enumType("CastingRole", { values: ROLE_ENUM });
	const SubjectType = builder.enumType("CastingSubjectType", { values: SUBJECT_TYPE_ENUM });

	const PersonRef = builder.externalRef("Person", builder.selection<{ id: string }>("id"));
	const VideoRef = builder.externalRef("Video", builder.selection<{ id: string }>("id"));
	const ShowRef = builder.externalRef("Show", builder.selection<{ id: string }>("id"));
	const CourseRef = builder.externalRef("Course", builder.selection<{ id: string }>("id"));

	const Credit = builder.objectRef<s.CastingCredit>("CastingCredit");
	Credit.implement({
		fields: (f) => ({
			role: f.field({ type: Role, nullable: false, resolve: (c) => c.role }),
			position: f.exposeInt("position", { nullable: false }),
			subjectType: f.field({ type: SubjectType, nullable: false, resolve: (c) => c.subjectType }),
			subjectId: f.exposeString("subjectId", { nullable: false }),
			person: f.field({ type: PersonRef, nullable: false, resolve: (c) => ({ id: c.personId }) }),
		}),
	});

	const forSubject = (subjectType: s.CastingSubjectType, subjectId: string, role?: s.CastingRole | null) => {
		const conditions: SQL[] = [eq(t.subjectType, subjectType), eq(t.subjectId, subjectId)];
		if (role) conditions.push(eq(t.role, role));
		return db
			.select()
			.from(t)
			.where(and(...conditions))
			.orderBy(asc(t.position), asc(t.personId))
			.all();
	};

	const subjectFields = (subjectType: s.CastingSubjectType) => (f: any) => ({
		// Credits in billing order; pass a role to narrow to one.
		castingCredits: f.field({
			type: [Credit],
			nullable: false,
			args: { role: f.arg({ type: Role, required: false }) },
			resolve: (subject: { id: string }, args: { role?: s.CastingRole | null }) =>
				forSubject(subjectType, subject.id, args.role),
		}),
	});

	for (const [ref, type] of [
		[VideoRef, "video"],
		[ShowRef, "show"],
		[CourseRef, "course"],
	] as const) {
		ref.implement({
			externalFields: (f) => ({ id: f.string() }),
			fields: subjectFields(type),
		});
	}

	PersonRef.implement({
		externalFields: (f) => ({ id: f.string() }),
		fields: (f) => ({
			// Everything this person is credited on; includes scheduled streams.
			castingCredits: f.field({
				type: [Credit],
				nullable: false,
				args: {
					subjectType: f.arg({ type: SubjectType, required: false }),
					role: f.arg({ type: Role, required: false }),
				},
				resolve: (person, args) => {
					const conditions: SQL[] = [eq(t.personId, person.id)];
					if (args.subjectType) conditions.push(eq(t.subjectType, args.subjectType));
					if (args.role) conditions.push(eq(t.role, args.role));
					return db
						.select()
						.from(t)
						.where(and(...conditions))
						.orderBy(asc(t.subjectType), asc(t.subjectId))
						.all();
				},
			}),
		}),
	});

	return builder.toSubGraphSchema(subgraph);
};
