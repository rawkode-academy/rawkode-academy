import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../../drizzle/schema";
import { type Resolver } from "../generated/index";

const resolver: Resolver["Query.events"] = async () => {
	console.log("1");
	const client = createClient({
		url: process.env.TURSO_URL as string,
		authToken: process.env.TURSO_TOKEN as string,
	});
	console.log("2");

	const db = drizzle(client, { schema });
	console.log("3");

	const events = await db.query.eventsTable.findMany();
	console.log("4");
	console.log(JSON.stringify(events, null, 2));

	return events;
};

export default resolver;
