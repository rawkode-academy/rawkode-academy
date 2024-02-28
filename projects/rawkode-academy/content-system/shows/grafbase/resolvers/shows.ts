import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../../drizzle/schema";
import { type Resolver } from "../generated/index";

const resolver: Resolver["Query.shows"] = async () => {
	const client = createClient({
		url: process.env.TURSO_URL as string,
		authToken: process.env.TURSO_TOKEN as string,
	});

	const db = drizzle(client, { schema });

	try {
		return await db.query.showsTable.findMany({});
	} catch (err) {
		console.log(err);
		return [];
	}
};

export default resolver;
