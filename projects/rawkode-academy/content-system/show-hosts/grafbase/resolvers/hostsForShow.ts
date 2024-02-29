import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../../drizzle/schema";

interface Show {
	id: string;
}

const resolver = async ({ id }: Show) => {
	const client = createClient({
		url: process.env.TURSO_URL as string,
		authToken: process.env.TURSO_TOKEN as string,
	});

	const db = drizzle(client, { schema });

	const rows = await db.query.showHostsTable.findMany({
		where: (table, { eq }) => eq(table.showId, id),
	});

	return rows.map((row) => row.hostId);
};

export default resolver;
