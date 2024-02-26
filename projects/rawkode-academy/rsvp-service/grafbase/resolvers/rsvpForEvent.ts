import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import { GraphQLError } from "graphql";
import * as schema from "../../drizzle/schema";
import { type Resolver } from "../generated/index";
import * as jwt from "jsonwebtoken";

const resolver: Resolver["Mutation.rsvpForEvent"] = async (
	_,
	args,
	context
) => {
	if (!args.eventId) {
		throw new GraphQLError("No event ID provided");
	}

	const token = context.request.headers["authorization"];
	if (!token) {
		throw new GraphQLError("No valid JWT provided");
	}

	const user = jwt.decode(token.replace("Bearer ", ""), {
		json: true,
	});

	if (!user || !user.sub) {
		throw new GraphQLError("Couldn't extract user information from JWT");
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
			userId: user.sub,
		})
		.onConflictDoNothing({
			target: [schema.rsvpTable.eventId, schema.rsvpTable.userId],
		});

	return true;
};

export default resolver;
