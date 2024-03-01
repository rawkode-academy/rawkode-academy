import { createClient } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../../drizzle/schema";
import { getSecrets } from "../../utils/secrets";
import { type Resolver } from "../generated/index";

const secrets = await getSecrets();

const resolver: Resolver["Query.shows"] = async () => {
	const client = createClient({
		url: secrets.tursoUrl,
		authToken: secrets.tursoToken,
	});

	const db = drizzle(client, { schema });

	return await db.query.showsTable.findMany({});
};

export default resolver;
