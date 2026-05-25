// Thin helper for show plugins to query the federated GraphQL API server-side.

// The Hive gateway serves GraphQL at the root path (graphqlEndpoint: "/").
const GRAPHQL_ENDPOINT = "https://api.rawkode.academy/";

export async function queryShowsApi<T>(
	query: string,
	variables: Record<string, unknown> = {},
): Promise<T | null> {
	try {
		const response = await fetch(GRAPHQL_ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query, variables }),
		});
		if (!response.ok) return null;
		const json = (await response.json()) as { data?: T; errors?: unknown };
		return json.data ?? null;
	} catch {
		return null;
	}
}
