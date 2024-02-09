import { createClient } from '@libsql/client/web'
import { GraphQLError } from "graphql";
import { type Resolver } from '../generated/index'

const resolver: Resolver['Query.rsvpsForEvent'] = async (_, args) => {
	if (!args.eventId) {
		throw new GraphQLError("No event ID provided")
	}

	const client = createClient({
		url: process.env.TURSO_URL || "",
		authToken: process.env.TURSO_TOKEN || "",
	})


	try {
		const { rows } = await client.execute('select eventID, userID from rsvp')

		const count = rows.length;
		console.log(count)
		console.log(rows)
		const learnerIds = rows.map(row => row.userId)
		console.log(learnerIds)

		return {
			count,
			learnerIds,
		}
	} catch (err) {
		console.log("3")
		console.log(err)
		console.log("error reported")
		return {
			count: 0,
			learnerIds: [],
		}
	}
}

export default resolver;
