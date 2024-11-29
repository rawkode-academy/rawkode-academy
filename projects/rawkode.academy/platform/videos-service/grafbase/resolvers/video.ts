import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../../drizzle/schema";
import { type Resolver } from "../generated/index";
import { GraphQLError } from "graphql";

const resolver: Resolver["Query.videoById"] = async (_, { id }) => {
	const client = createClient({
		url: process.env.TURSO_URL as string,
		authToken: process.env.TURSO_TOKEN as string,
	});

	const db = drizzle(client, { schema });

	const video = await db.query.videosTable.findFirst({
		where: (table, { eq }) => eq(table.id, id),
	});

	if (!video) {
		throw new GraphQLError(`Could not find video with id '${id}'`);
	}

	return video;
};

export default resolver;
