import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../../drizzle/schema";
import { type Resolver } from "../generated/index";

const resolver: Resolver["Query.youtubeVideos"] = async () => {
	const client = createClient({
		url: import.meta.env.TURSO_URL as string,
		authToken: import.meta.env.TURSO_TOKEN as string,
	});

	const db = drizzle(client, { schema });

	return (await db.query.youtubeVideoTable.findMany({})).map((video) => ({
		...video,
		date: video.date.toISOString(),
	}));
};

export default resolver;
