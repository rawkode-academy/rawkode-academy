import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../../drizzle/schema";

interface Root {
	id: string;
}

const resolver = async ({ id }: Root) => {
	const client = createClient({
		url: process.env.TURSO_URL as string,
		authToken: process.env.TURSO_TOKEN as string,
	});

	const db = drizzle(client, { schema });

	try {
		const rows = await db.query.showHostsTable.findMany({
			where: (table, { eq }) => eq(table.hostId, id),
		});

		return rows.map((row) => row.showId);
	} catch (err) {
		console.log(err);
		return [];
	}
};

export default resolver;
