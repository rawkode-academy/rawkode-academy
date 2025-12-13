import { GraphQLClient } from "graphql-request";

const GRAPHQL_ENDPOINT =
	import.meta.env.GRAPHQL_ENDPOINT || "https://api.rawkode.academy/";

let client: GraphQLClient | null = null;

export function getGraphQLClient(): GraphQLClient {
	if (!client) {
		client = new GraphQLClient(GRAPHQL_ENDPOINT, {
			headers: {
				"Content-Type": "application/json",
			},
		});
	}
	return client;
}

export function getAuthenticatedClient(token?: string): GraphQLClient {
	const baseClient = getGraphQLClient();
	if (token) {
		return new GraphQLClient(GRAPHQL_ENDPOINT, {
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
		});
	}
	return baseClient;
}
