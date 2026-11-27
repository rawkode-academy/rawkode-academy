export interface GatewayEnv {
	GATEWAY: Fetcher;
}

export class GatewayError extends Error {
	constructor(
		message: string,
		readonly code?: string,
	) {
		super(message);
	}
}

/** One GraphQL call to the federated API, as the signed-in member. */
export const gql = async <T>(
	env: GatewayEnv,
	accessToken: string,
	query: string,
	variables: Record<string, unknown> = {},
): Promise<T> => {
	const response = await env.GATEWAY.fetch("https://internal/", {
		method: "POST",
		headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
		body: JSON.stringify({ query, variables }),
	});
	if (!response.ok) throw new GatewayError(`The API answered ${response.status}`);
	const body = (await response.json()) as { data?: T; errors?: { message: string; extensions?: { code?: string } }[] };
	if (body.errors?.length) throw new GatewayError(body.errors[0].message, body.errors[0].extensions?.code);
	return body.data as T;
};
