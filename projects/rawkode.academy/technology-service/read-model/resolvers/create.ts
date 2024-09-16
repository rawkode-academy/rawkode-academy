import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../../drizzle/schema.ts";
import { type Resolver } from "../generated/index.ts";

const resolver: Resolver["Mutation.createTechnology"] = async (_, input) => {
	const client = createClient({
		url: process.env.TURSO_URL as string,
		authToken: process.env.TURSO_TOKEN as string,
	});

	const db = drizzle(client, { schema });

	type newTechnology = typeof schema.technologiesTable.$inferInsert;

	const technology = await db.insert(schema.technologiesTable).values({
		...input,
	});

	return input;
};

export default resolver;
