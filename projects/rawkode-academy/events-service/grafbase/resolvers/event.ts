import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../../drizzle/schema";
import { type Resolver } from "../generated/index";
import { GraphQLError } from "graphql";

const resolver: Resolver["Query.eventById"] = async (_, { id }) => {
	const client = createClient({
		url: process.env.TURSO_URL as string,
		authToken: process.env.TURSO_TOKEN as string,
	});

	const db = drizzle(client, { schema });

	const event = await db.query.eventsTable.findFirst({
		where: (table, { eq }) => eq(table.id, id),
	});

	if (!event) {
		throw new GraphQLError(`Could not find event with id '${id}'`);
	}

	return event;
};

export default resolver;
