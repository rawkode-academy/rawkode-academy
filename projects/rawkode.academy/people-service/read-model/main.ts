import {
	createRemoteJwksSigningKeyProvider,
	extractFromHeader,
	useJWT,
} from "@graphql-yoga/plugin-jwt";
import { createClient } from "@libsql/client";
import schemaBuilder from "@pothos/core";
import directivesPlugin from "@pothos/plugin-directives";
import drizzlePlugin from "@pothos/plugin-drizzle";
import federationPlugin from "@pothos/plugin-federation";
import { drizzle } from "drizzle-orm/libsql";
import { createYoga } from "graphql-yoga";
import * as dataSchema from "../data-model/schema.ts";
import { eq } from "drizzle-orm";

if (!Deno.env.has("LIBSQL_URL")) {
	Deno.env.set("LIBSQL_URL", "http://localhost:2000");
}

if (!Deno.env.has("LIBSQL_TOKEN")) {
	Deno.env.set("LIBSQL_TOKEN", "");
}

const client = createClient({
	url: Deno.env.get("LIBSQL_URL") || "",
	authToken: Deno.env.get("LIBSQL_TOKEN"),
});

const db = drizzle(client, { schema: dataSchema });

// TODO: This should be shared across all services
interface Context {
	jwt: {
		payload: {
			sub: string;
			given_name: string;
			family_name: string;
			picture: string;
			email: string;
		}
	};
}

export interface PothosTypes {
	Context: Context;
	DrizzleSchema: typeof dataSchema;
}

const builder = new schemaBuilder<PothosTypes>({
	plugins: [directivesPlugin, drizzlePlugin, federationPlugin],
	drizzle: {
		client: db,
	},
});

const personRef = builder.drizzleObject("peopleTable", {
	name: "person",
	fields: (t) => ({
		id: t.exposeString("id"),
		forename: t.exposeString("forename"),
		surname: t.exposeString("surname"),
		email: t.exposeString("email", {
			requiresScopes: [["system"]],
		}),
	}),
});

builder.asEntity(personRef, {
	key: builder.selection<{ id: string }>("id"),
	resolveReference: async (user) =>
		await db.query.peopleTable.findFirst({
			where: eq(dataSchema.peopleTable.id, user.id),
		}).execute(),
});

builder.queryType({
	fields: (t) => ({
		me: t.field({
			type: personRef,
			resolve: async (_root, _args, ctx) => await db.query.peopleTable.findFirst({
				where: eq(dataSchema.peopleTable.id, ctx.jwt.payload.sub),
			}).execute(),
		}),
	}),
});

const yoga = createYoga({
	schema: builder.toSubGraphSchema({
		linkUrl: "https://specs.apollo.dev/federation/v2.6",
		federationDirectives: ["@key", "@authenticated", "@requiresScopes"],
	}),
	plugins: [
		useJWT({
			singingKeyProviders: [
				createRemoteJwksSigningKeyProvider({ jwksUri: "https://zitadel.rawkode.academy/oauth/v2/keys" }),
			],
			tokenLookupLocations: [
				extractFromHeader({ name: "authorization", prefix: "Bearer" }),
			],
			// tokenVerification: {
			//   audience: 'my-audience',
			// },
			extendContext: true,
			reject: {
				missingToken: false,
				invalidToken: false,
			},
		}),
	],
});

Deno.serve({
	onListen: ({ hostname, port, transport }) => {
		console.log(`Listening on ${transport}://${hostname}:${port}`);
	},
}, yoga.fetch);
