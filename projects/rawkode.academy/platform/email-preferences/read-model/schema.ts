import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import drizzlePlugin from "@pothos/plugin-drizzle";
import federationPlugin from "@pothos/plugin-federation";
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import type { GraphQLSchema } from "graphql";
import * as dataSchema from "../data-model/schema";

// TODO: This should be shared across all services
interface Context {
	jwt: {
		payload: {
			sub: string;
			given_name: string;
			family_name: string;
			picture: string;
			email: string;
		};
	};
}

export interface PothosTypes {
	Context: Context;
	DrizzleSchema: typeof dataSchema;
}

export interface Env {
	DB: D1Database;
}

function checkAuthorization(personId: string, ctx: Context): void {
	// Verify JWT exists and has a valid sub
	if (!ctx?.jwt?.payload?.sub) {
		throw new Error("Unauthorized: Invalid or missing authentication");
	}

	// Only allow users to access their own data
	if (personId !== ctx.jwt.payload.sub) {
		throw new Error("Unauthorized: Cannot access other users' data");
	}
}

export const getSchema = (env: Env): GraphQLSchema => {
	const db = drizzle(env.DB, { schema: dataSchema });

	const builder = new schemaBuilder<PothosTypes>({
		plugins: [directivesPlugin, drizzlePlugin, federationPlugin],
		drizzle: {
			client: db,
			schema: dataSchema,
		},
	});

	const actionEnum = builder.enumType("EmailPreferenceAction", {
		values: ["SUBSCRIBED", "UNSUBSCRIBED"] as const,
	});

	const emailPreferenceRef = builder.drizzleObject("emailPreferencesTable", {
		name: "EmailPreference",
		fields: (t) => ({
			userId: t.exposeString("userId"),
			channel: t.exposeString("channel"),
			audience: t.exposeString("audience"),
			createdAt: t.string({
				resolve: (pref) => pref.createdAt?.toISOString() ?? "",
			}),
		}),
	});

	const emailPreferenceEventRef = builder.drizzleObject(
		"emailPreferenceEventsTable",
		{
			name: "EmailPreferenceEvent",
			fields: (t) => ({
				id: t.exposeString("id"),
				userId: t.exposeString("userId"),
				channel: t.exposeString("channel"),
				audience: t.exposeString("audience"),
				action: t.field({
					type: actionEnum,
					resolve: (event) =>
						event.action === "unsubscribed" ? "UNSUBSCRIBED" : "SUBSCRIBED",
				}),
				occurredAt: t.string({
					resolve: (event) => event.occurredAt?.toISOString() ?? "",
				}),
			}),
		},
	);

	builder
		.externalRef("Person", builder.selection<{ id: string }>("id"))
		.implement({
			externalFields: (t) => ({
				id: t.string(),
			}),
			fields: (t) => ({
				emailPreferences: t.field({
					type: [emailPreferenceRef],
					args: {
						channel: t.arg({ type: "String" }),
						audience: t.arg({ type: "String" }),
					},
					resolve: async (person, args, ctx) => {
						checkAuthorization(person.id, ctx);

						return db.query.emailPreferencesTable.findMany({
							where: and(
								eq(dataSchema.emailPreferencesTable.userId, person.id),
								args.channel
									? eq(dataSchema.emailPreferencesTable.channel, args.channel)
									: undefined,
								args.audience
									? eq(dataSchema.emailPreferencesTable.audience, args.audience)
									: undefined,
							),
							orderBy: desc(dataSchema.emailPreferencesTable.createdAt),
						});
					},
				}),
				emailPreferenceEvents: t.field({
					type: [emailPreferenceEventRef],
					args: {
						channel: t.arg({ type: "String" }),
						audience: t.arg({ type: "String" }),
						limit: t.arg({ type: "Int" }),
					},
					resolve: async (person, args, ctx) => {
						checkAuthorization(person.id, ctx);

						return db.query.emailPreferenceEventsTable.findMany({
							where: and(
								eq(dataSchema.emailPreferenceEventsTable.userId, person.id),
								args.channel
									? eq(
											dataSchema.emailPreferenceEventsTable.channel,
											args.channel,
										)
									: undefined,
								args.audience
									? eq(
											dataSchema.emailPreferenceEventsTable.audience,
											args.audience,
										)
									: undefined,
							),
							orderBy: desc(dataSchema.emailPreferenceEventsTable.occurredAt),
							limit: Math.min(args.limit ?? 50, 100),
						});
					},
				}),
			}),
		});

	return builder.toSubGraphSchema({
		linkUrl: "https://specs.apollo.dev/federation/v2.6",
		federationDirectives: [
			"@extends",
			"@external",
			"@key",
			"@authenticated",
			"@requiresScopes",
		],
	});
};
