import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../../drizzle/schema";
import { type Resolver } from "../generated/index";

const resolver: Resolver["Query.hostsForShow"] = async (_, args) => {
	const { showId } = args;

	const client = createClient({
		url: process.env.TURSO_URL as string,
		authToken: process.env.TURSO_TOKEN as string,
	});

	const db = drizzle(client, { schema });

	try {
		const rows = await db.query.showHostsTable.findMany({
			where: (table, { eq }) => eq(table.showId, showId),
		});

		return {
			hostIds: rows.map((row) => row.hostId),
		};
	} catch (err) {
		console.log(err);
		return [];
	}
};

export default resolver;
