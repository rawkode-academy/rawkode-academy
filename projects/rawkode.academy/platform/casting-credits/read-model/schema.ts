import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import drizzlePlugin from "@pothos/plugin-drizzle";
import federationPlugin from "@pothos/plugin-federation";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import type { GraphQLSchema } from "graphql";
import * as dataSchema from "../data-model/schema";

export interface PothosTypes {
	DrizzleSchema: typeof dataSchema;
}

interface CastingCredit {
	personId: string;
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

	const personRef = builder
		.externalRef("Person", builder.selection<{ id: string }>("id"))
		.implement({
			externalFields: (t) => ({
				id: t.string(),
			}),
		});

	const videoRef = builder.externalRef(
		"Video",
		builder.selection<{ id: string }>("id"),
	);

	const castingCreditRef = builder
		.objectRef<CastingCredit>("CastingCredit")
		.implement({
			fields: (t) => ({
				person: t.field({
					type: personRef,
					resolve: (credit) => ({ id: credit.personId }),
				}),
			}),
		});

	videoRef.implement({
		externalFields: (t) => ({
			id: t.string(),
		}),
		fields: (t) => ({
			creditsForRole: t.field({
				type: [castingCreditRef],
				args: {
					role: t.arg({
						type: "String",
						required: true,
					}),
				},
				resolve: (video, args) =>
					db
						.select({
							personId: dataSchema.castingCreditsTable.personId,
						})
						.from(dataSchema.castingCreditsTable)
						.where(
							and(
								eq(dataSchema.castingCreditsTable.videoId, video.id),
								eq(dataSchema.castingCreditsTable.role, args.role),
							),
						),
			}),
		}),
	});

	return builder.toSubGraphSchema({
		linkUrl: "https://specs.apollo.dev/federation/v2.6",
		federationDirectives: ["@extends", "@external", "@key"],
	});
};
