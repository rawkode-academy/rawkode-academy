type GraphQLResult<T> = { data?: T; errors?: unknown[] };

export async function queryReadModel<T>(
	binding: Fetcher,
	query: string,
	variables?: Record<string, unknown>,
): Promise<T> {
	const response = await binding.fetch("https://read-model/", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ query, variables }),
	});

	if (!response.ok) {
		throw new Error(`read-model query failed with ${response.status}`);
	}

	const json = (await response.json()) as GraphQLResult<T>;

	if (json.errors && json.errors.length > 0) {
		throw new Error(`read-model returned GraphQL errors: ${JSON.stringify(json.errors)}`);
	}

	if (!json.data) {
		throw new Error("read-model returned no data");
	}

	return json.data;
}
