import type { Transport } from "@graphql-mesh/transport-common";
import { print } from "graphql";

/**
 * Map subgraph names (as they appear in the supergraph) to service binding keys.
 * The keys must match the binding names in wrangler.jsonc.
 */
export const SUBGRAPH_BINDING_MAP: Record<string, keyof Env> = {
	people: "PEOPLE",
	technologies: "TECHNOLOGIES",
	shows: "SHOWS",
	videos: "VIDEOS",
	"video-guests": "VIDEO_GUESTS",
	"video-technologies": "VIDEO_TECHNOLOGIES",
	"show-hosts": "SHOW_HOSTS",
	episodes: "EPISODES",
	chapters: "CHAPTERS",
	"people-links": "PEOPLE_LINKS",
	"people-biographies": "PEOPLE_BIOGRAPHIES",
	"transcription-terms": "TRANSCRIPTION_TERMS",
	// Editorial content
	articles: "ARTICLES",
	news: "NEWS",
	changelog: "CHANGELOG",
	adrs: "ADRS",
	testimonials: "TESTIMONIALS",
	courses: "COURSES",
	// User interaction services (dynamic data)
	"emoji-reactions": "EMOJI_REACTIONS",
	"email-preferences": "EMAIL_PREFERENCES",
	"watch-history": "WATCH_HISTORY",
	// Show domain services
	brackets: "BRACKETS",
	// Generic platform services
	leaderboard: "LEADERBOARD",
	achievements: "ACHIEVEMENTS",
};

export interface ServiceBindingTransportContext {
	env: Env;
	user?: {
		id: string;
		email: string;
		name?: string;
		username?: string | null;
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
export function createServiceBindingTransport(env: Env): Transport {
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
				const query = typeof document === "string" ? document : print(document);

				// Build headers with auth context for subgraph
				const headers: HeadersInit = {
					"Content-Type": "application/json",
				};

				// Forward user context to subgraph if available
				const ctx = context as ServiceBindingTransportContext | undefined;
				if (ctx?.user) {
					headers["X-Gateway-User-Id"] = ctx.user.id;
					headers["X-Gateway-User-Email"] = ctx.user.email;
					if (ctx.user.username) {
						headers["X-Gateway-User-Username"] = ctx.user.username;
					}
					if (ctx.user.name) {
						headers["X-Gateway-User-Name"] = ctx.user.name;
					}
				}

				const response = await serviceBinding.fetch("https://internal/", {
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
