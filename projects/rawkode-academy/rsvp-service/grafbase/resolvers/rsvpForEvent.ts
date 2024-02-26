import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import { GraphQLError } from "graphql";
import * as schema from "../../drizzle/schema";
import { type Resolver } from "../generated/index";

const resolver: Resolver["Mutation.rsvpForEvent"] = async (_, args) => {
	if (!args.eventId) {
		throw new GraphQLError("No event ID provided");
	}

	const client = createClient({
		url: process.env.TURSO_URL as string,
		authToken: process.env.TURSO_TOKEN as string,
	});

	const db = drizzle(client, { schema });

	await db
		.insert(schema.rsvpTable)
		.values({
			eventId: args.eventId,
			userId: "user-id",
		})
		.onConflictDoNothing({
			target: [schema.rsvpTable.eventId, schema.rsvpTable.userId],
		});

	return true;
};

export default resolver;
