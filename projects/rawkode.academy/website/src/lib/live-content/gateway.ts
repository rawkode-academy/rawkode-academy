// GraphQL transport to the federation gateway: the API service binding in
// production, a plain fetch to GRAPHQL_ENDPOINT otherwise.
import { type ContentEnv, DEFAULT_GRAPHQL_ENDPOINT } from "./env";

export class GatewayError extends Error {
	constructor(
		message: string,
		readonly status?: number,
	) {
		super(message);
		this.name = "GatewayError";
	}
}

/**
 * Upper bound for one gateway request. A hung gateway must not hold every
 * page render until the Worker's wall-clock limit: fail fast so the caller
 * serves the last-good copy from KV.
 */
export const GATEWAY_TIMEOUT_MS = 8_000;

interface GraphQLResponse<T> {
	data?: T | null;
	errors?: { message: string; path?: (string | number)[] }[];
}

/**
 * Use the API service binding when it works. In local runs (astro dev,
 * astro preview) the binding exists but has no worker behind it, so fall
 * back to fetching the public endpoint.
 */
async function send(
	env: ContentEnv,
	endpoint: string,
	init: RequestInit,
): Promise<Response> {
	if (env.API) {
		try {
			const response = await env.API.fetch(new Request(endpoint, init));
			if (response.status < 500 || !(await isUnboundLocalService(response))) {
				return response;
			}
		} catch (error) {
			if (init.signal?.aborted) throw error;
			console.warn(
				"[content] API binding failed; fetching the endpoint instead",
				error,
			);
		}
	}
	return fetch(endpoint, init);
}

async function isUnboundLocalService(response: Response): Promise<boolean> {
	const text = await response
		.clone()
		.text()
		.catch(() => "");
	return /running locally|local dev session|no such service|couldn.t find/i.test(
		text,
	);
}

export async function queryGateway<T>(
	env: ContentEnv,
	query: string,
	variables: Record<string, unknown> = {},
	operationName?: string,
	timeoutMs: number = GATEWAY_TIMEOUT_MS,
): Promise<T> {
	const endpoint = env.GRAPHQL_ENDPOINT || DEFAULT_GRAPHQL_ENDPOINT;
	const signal = AbortSignal.timeout(timeoutMs);
	const init: RequestInit = {
		method: "POST",
		signal,
		headers: {
			"content-type": "application/json",
			accept: "application/graphql-response+json, application/json",
		},
		body: JSON.stringify({ query, variables, operationName }),
	};
	let response: Response;
	try {
		response = await send(env, endpoint, init);
	} catch (error) {
		if (signal.aborted) {
			throw new GatewayError(
				`Gateway ${operationName ?? "query"} timed out after ${timeoutMs}ms`,
			);
		}
		throw error;
	}
	if (!response.ok) {
		const detail = await response.text().catch(() => "");
		throw new GatewayError(
			`Gateway ${operationName ?? "query"} failed: HTTP ${response.status} ${detail.slice(0, 200)}`,
			response.status,
		);
	}
	const payload = (await response.json()) as GraphQLResponse<T>;
	if (payload.errors?.length) {
		// Partial data from a failing subgraph would silently drop fields that
		// pages rely on; fail so the caller can fall back to the last good copy.
		throw new GatewayError(
			`Gateway ${operationName ?? "query"} errors: ${payload.errors
				.map((e) => `${e.message}${e.path ? ` (${e.path.join(".")})` : ""}`)
				.join("; ")
				.slice(0, 500)}`,
		);
	}
	if (!payload.data) {
		throw new GatewayError(
			`Gateway ${operationName ?? "query"} returned no data`,
		);
	}
	return payload.data;
}
