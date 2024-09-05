import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../../drizzle/schema";
import { type Resolver } from "../generated/index";
import { GraphQLError } from "graphql";

const resolver: Resolver["Mutation.createTechnology"] = async (_, { id }) => {
	const client = createClient({
		url: process.env.TURSO_URL as string,
		authToken: process.env.TURSO_TOKEN as string,
	});

	const db = drizzle(client, { schema });

	const technology = await db.query.technologiesTable.findFirst({
		where: (table, { eq }) => eq(table.id, id),
	});

	if (!technology) {
		throw new GraphQLError(`Could not find technology with id '${id}'`);
	}

	return technology;
};

export default resolver;
