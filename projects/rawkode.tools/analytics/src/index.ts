import { WorkerEntrypoint } from "cloudflare:workers";
import { validateCloudEvent } from "./cloudevents";
import type { EventBuffer } from "./durable-objects/event-buffer";

export interface Env {
	EVENT_BUFFER: DurableObjectNamespace<EventBuffer>;
	GRAFANA_OTLP_ENDPOINT: string;
	GRAFANA_OTLP_USERNAME: string;
	GRAFANA_OTLP_TOKEN: string;
}

export interface TrackEventResult {
	success: boolean;
	error?: string;
}

export interface TrackEventOptions {
	region?: string;
	cf?: {
		colo?: string;
		continent?: string;
		country?: string;
	};
	/** Fields from event.data to promote to OTLP attributes */
	attributes?: string[];
}

export class Analytics extends WorkerEntrypoint<Env> {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/health") {
			return new Response("ok", { headers: { "Content-Type": "text/plain" } });
		}

		if (url.pathname === "/track" && request.method === "POST") {
			try {
				const body = (await request.json()) as {
					event?: unknown;
					attributes?: string[];
				};

				// Support both { event, attributes } wrapper and raw CloudEvent
				const event = body.event ?? body;
				const attributes = body.event ? body.attributes : undefined;

				const cf = request.cf as IncomingRequestCfProperties;
				const region = this.getRegionFromCf(cf);

				const result = await this.trackEvent(event, { region, attributes });

				return Response.json(result, {
					status: result.success ? 200 : 400,
				});
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";
				console.error("Track endpoint error", { error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
				return Response.json(
					{ success: false, error: errorMessage },
					{ status: 400 },
				);
			}
		}

		return new Response("Not Found", { status: 404 });
	}

	async trackEvent(
		event: unknown,
		options?: TrackEventOptions,
	): Promise<TrackEventResult> {
		console.log("trackEvent called", { event, options });

		const validation = validateCloudEvent(event);

		if (!validation.valid) {
			console.error("CloudEvent validation failed", { error: validation.error, event });
			return { success: false, error: validation.error };
		}

		let region = options?.region;
		if (!region && options?.cf) {
			region = this.getRegionFromCfData(options.cf);
		}
		region = region || "global";

		console.log("Storing event in buffer", { region, bufferId: `buffer-${region}` });

		const bufferId = `buffer-${region}`;
		const id = this.env.EVENT_BUFFER.idFromName(bufferId);
		const buffer = this.env.EVENT_BUFFER.get(id);

		// Convert CloudEvent class instance to plain object for serialization
		const plainEvent = JSON.parse(JSON.stringify(validation.event));
		await buffer.addEvent(plainEvent, options?.attributes);

		console.log("Event stored successfully");
		return { success: true };
	}

	private getRegionFromCf(cf: IncomingRequestCfProperties | undefined): string {
		if (!cf) return "global";

		const continentMap: Record<string, string> = {
			NA: "us",
			SA: "latam",
			EU: "eu",
			AS: "apac",
			OC: "apac",
			AF: "emea",
		};

		const continent = cf.continent as string;
		return continentMap[continent] || (cf.colo as string) || "global";
	}

	private getRegionFromCfData(cf: TrackEventOptions["cf"]): string {
		const continentMap: Record<string, string> = {
			NA: "us",
			SA: "latam",
			EU: "eu",
			AS: "apac",
			OC: "apac",
			AF: "emea",
		};

		if (cf?.continent) {
			return continentMap[cf.continent] || cf.continent.toLowerCase();
		}
		if (cf?.colo) {
			return cf.colo.toLowerCase();
		}
		return "global";
	}
}

export { EventBuffer } from "./durable-objects/event-buffer";
export type { CloudEvent } from "./cloudevents";

export default Analytics;
