import { createClient } from "@libsql/client/http";
import { drizzle } from "drizzle-orm/libsql";
import { GraphQLError } from "graphql";
import * as schema from "../../drizzle/schema";
import { type Resolver } from "../generated/index";

const resolver: Resolver["Query.rsvpsForEvent"] = async (_, args) => {
	if (!args.eventId) {
		throw new GraphQLError("No event ID provided");
	}

	const client = createClient({
		url: process.env.TURSO_URL as string,
		authToken: process.env.TURSO_TOKEN as string,
	});

	const db = drizzle(client, { schema });

	try {
		const rsvps = await db.query.rsvpTable.findMany({
			where: (rsvps, { eq }) => eq(rsvps.eventId, args.eventId),
			columns: {
				eventId: false,
				createdAt: false,
				userId: true,
			}
		});

		const count = rsvps.length;
		const learnerIds = rsvps.map((rsvp) => rsvp.userId);

		return {
			count,
			learnerIds,
		};
	} catch (err) {
		console.log(`Failed to get rsvps for event ${args.eventId}`);
		console.log(err);

		return {
			count: 0,
			learnerIds: [],
		};
	}
};

export default resolver;
