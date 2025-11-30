import type { Transport } from "@graphql-mesh/transport-common";
import { print } from "graphql";
import type { Env } from "../env.d.ts";

/**
 * Map subgraph names (as they appear in the supergraph) to service binding keys.
 * The keys must match the binding names in wrangler.jsonc.
 *
 * Content subgraphs are served by the website worker via its /graphql endpoint.
 * User interaction subgraphs remain as separate workers.
 */
export const SUBGRAPH_BINDING_MAP: Record<string, keyof Env> = {
	// Website serves all content subgraphs
	website: "WEBSITE",
	// User interaction services (dynamic data)
	"emoji-reactions": "EMOJI_REACTIONS",
	"video-likes": "VIDEO_LIKES",
	"email-preferences": "EMAIL_PREFERENCES",
};

export interface ServiceBindingTransportContext {
	env: Env;
	user?: {
		id: string;
		email: string;
		name?: string;
	};
}

/**
 * Custom transport that routes GraphQL requests through Cloudflare Service Bindings
 * instead of HTTP URLs for zero-latency worker-to-worker communication.
 *
 * Benefits:
 * - No network egress (stays within Cloudflare)
 * - No public URLs needed for subgraphs
 * - Automatic authentication between workers
 * - Lower latency than HTTP
 */
export function createServiceBindingTransport(
	env: Env,
): Transport {
	return {
		getSubgraphExecutor({ subgraphName }) {
			const bindingKey = SUBGRAPH_BINDING_MAP[subgraphName];

			if (!bindingKey) {
				throw new Error(
					`No service binding configured for subgraph: ${subgraphName}. ` +
						`Available subgraphs: ${Object.keys(SUBGRAPH_BINDING_MAP).join(", ")}`,
				);
			}

			const serviceBinding = env[bindingKey] as Fetcher;

			if (!serviceBinding) {
				throw new Error(
					`Service binding ${bindingKey} not found in environment for subgraph ${subgraphName}. ` +
						`Make sure it's configured in wrangler.jsonc.`,
				);
			}

			// Return executor function for this subgraph
			return async function executor(executionRequest) {
				const { document, variables, context } = executionRequest;

				// Serialize GraphQL query
				const query =
					typeof document === "string" ? document : print(document);

				// Build headers with auth context for subgraph
				const headers: HeadersInit = {
					"Content-Type": "application/json",
				};

				// Forward user context to subgraph if available
				const ctx = context as ServiceBindingTransportContext | undefined;
				if (ctx?.user) {
					headers["X-Gateway-User-Id"] = ctx.user.id;
					headers["X-Gateway-User-Email"] = ctx.user.email;
					if (ctx.user.name) {
						headers["X-Gateway-User-Name"] = ctx.user.name;
					}
				}

				// Execute via service binding
				// For the website subgraph, we need to hit the /graphql endpoint
				const url =
					subgraphName === "website"
						? "https://internal/graphql"
						: "https://internal/";
				const response = await serviceBinding.fetch(url, {
					method: "POST",
					headers,
					body: JSON.stringify({
						query,
						variables: variables || {},
					}),
				});

				if (!response.ok) {
					const errorText = await response.text();
					console.error(`Subgraph ${subgraphName} error:`, errorText);
					throw new Error(
						`Subgraph ${subgraphName} returned ${response.status}: ${errorText}`,
					);
				}

				return response.json();
			};
		},
	};
}
