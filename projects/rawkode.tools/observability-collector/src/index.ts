import { WorkerEntrypoint } from "cloudflare:workers";
import {
	eventBufferName,
	DELIVERY_BUFFER_NAMES,
	type Destination,
} from "./delivery-queue";
import { browserCloudEvent } from "./web-events";
import { validateCloudEvent } from "./cloudevents";
import type { DataBuffer } from "./durable-objects/data-buffer";
import { prepareCloudEvent, redactUserAgent, type WebContext } from "./events";

export interface EventsStream {
	send(records: Record<string, unknown>[]): Promise<void>;
}

export interface Env {
	DATA_BUFFER: DurableObjectNamespace<DataBuffer>;
	POSTHOG_PROJECT_TOKEN: SecretsStoreSecret;
	POSTHOG_HOST: string;
	/** Basin stream `analytics_events`; absent until the wrangler.jsonc binding is set. */
	EVENTS?: EventsStream;
}

export interface TrackEventResult {
	success: boolean;
	error?: string;
	receipt?: {
		version: 1;
		event_source: string;
		event_id: string;
		disposition: "persisted" | "filtered";
	};
}

export interface TrackEventOptions {
	/** Fields from event.data to promote to PostHog properties */
	attributes?: string[];
}

export interface ExceptionData {
	message: string;
	stack?: string;
	name?: string;
	properties?: Record<string, unknown>;
	distinctId?: string;
	timestamp: string;
}

export class PostHogCollector extends WorkerEntrypoint<Env> {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/health") {
			return new Response("ok", { headers: { "Content-Type": "text/plain" } });
		}

		// OTLP logs endpoint
		if (url.pathname === "/v1/logs" && request.method === "POST") {
			try {
				const body = await request.arrayBuffer();
				const contentType = request.headers.get("Content-Type") || "";

				const id = this.env.DATA_BUFFER.idFromName("buffer-logs");
				const buffer = this.env.DATA_BUFFER.get(id);
				await buffer.addLog(body, contentType);

				return Response.json({ success: true });
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";
				console.error("Log endpoint error", { error: errorMessage });
				return Response.json(
					{ success: false, error: errorMessage },
					{ status: 400 },
				);
			}
		}

		// CloudEvent tracking endpoint (compatible with analytics worker)
		if (url.pathname === "/track" && request.method === "POST") {
			let body: { event?: unknown; attributes?: string[] };
			try {
				body = await request.json();
				if (!body || typeof body !== "object") throw new Error("Invalid body");
			} catch {
				return Response.json(
					{ success: false, error: "Invalid JSON event" },
					{ status: 400 },
				);
			}
			try {
				const event = body.event ?? body;
				// Only the website RPC may emit browser events with trusted identity.
				if (
					event &&
					typeof event === "object" &&
					"source" in event &&
					event.source === "rawkode-academy-browser"
				) {
					return Response.json(
						{
							success: false,
							error: "Browser events require website ingestion",
						},
						{ status: 403 },
					);
				}
				const attributes = body.event ? body.attributes : undefined;

				const result = await this.trackEvent(event, { attributes });

				return Response.json(result, {
					status: result.success ? 200 : 400,
				});
			} catch {
				console.error("analytics.acceptance.failed", { retryable: true });
				return Response.json(
					{ success: false, error: "Durable acceptance unavailable" },
					{ status: 503 },
				);
			}
		}

		return new Response("Not Found", { status: 404 });
	}

	async trackEvent(
		event: unknown,
		options?: TrackEventOptions,
	): Promise<TrackEventResult> {
		const validation = validateCloudEvent(event);

		if (!validation.valid) {
			console.error("CloudEvent validation failed");
			return { success: false, error: validation.error };
		}

		const prepared = prepareCloudEvent(
			validation.event.toJSON() as Record<string, unknown>,
		);
		const receipt = {
			version: 1 as const,
			event_source: validation.event.source,
			event_id: validation.event.id,
		};
		// Filtered traffic is explicitly distinguished from persisted acceptance.
		if (!prepared)
			return {
				success: true,
				receipt: { ...receipt, disposition: "filtered" },
			};
		const json = redactUserAgent(prepared);
		if (!json.time) json.time = new Date().toISOString();

		const id = this.env.DATA_BUFFER.idFromName(
			eventBufferName(String(json.source), String(json.id)),
		);
		const buffer = this.env.DATA_BUFFER.get(id);
		await buffer.addEvent(json, options?.attributes);

		return { success: true, receipt: { ...receipt, disposition: "persisted" } };
	}

	/** Internal RPC health/replay; intentionally absent from the public fetch router. */
	async deliveryStatus() {
		return Promise.all(
			DELIVERY_BUFFER_NAMES.map(async (name) => {
				const buffer = this.env.DATA_BUFFER.get(
					this.env.DATA_BUFFER.idFromName(name),
				);
				return { name, destinations: await buffer.deliveryStatus() };
			}),
		);
	}

	async replayFailed(bufferName: string, destination: Destination) {
		if (!DELIVERY_BUFFER_NAMES.includes(bufferName))
			throw new Error("Invalid buffer");
		const buffer = this.env.DATA_BUFFER.get(
			this.env.DATA_BUFFER.idFromName(bufferName),
		);
		await buffer.replayFailed(destination);
	}

	async trackMetric(
		name: string,
		value: number,
		attributes: Record<string, string>,
	): Promise<TrackEventResult> {
		const id = this.env.DATA_BUFFER.idFromName("buffer-metrics");
		const buffer = this.env.DATA_BUFFER.get(id);

		await buffer.addMetric({ name, value, attributes });

		return { success: true };
	}

	/** Browser batches are RPC-only; each accepted event is durable before return. */
	async ingestWebEvents(
		events: unknown[],
		context: WebContext,
	): Promise<number> {
		if (!Array.isArray(events) || events.length > 50)
			throw new Error("Invalid browser batch");
		const normalized = events
			.map((event) => browserCloudEvent(event, context))
			.filter((event) => event !== null);
		const results = await Promise.all(
			normalized.map((event) => this.trackEvent(event)),
		);
		if (results.some((result) => !result.success))
			throw new Error("Browser event acceptance failed");
		console.log("analytics.web.accepted", {
			accepted: normalized.length,
			dropped: events.length - normalized.length,
		});
		return normalized.length;
	}

	async captureException(
		error: Error | string,
		properties?: Record<string, unknown>,
		distinctId?: string,
	): Promise<TrackEventResult> {
		const id = this.env.DATA_BUFFER.idFromName("buffer-exceptions");
		const buffer = this.env.DATA_BUFFER.get(id);

		const exceptionData: ExceptionData = {
			message: typeof error === "string" ? error : error.message,
			stack: typeof error === "string" ? undefined : error.stack,
			name: typeof error === "string" ? "Error" : error.name,
			properties,
			distinctId,
			timestamp: new Date().toISOString(),
		};

		await buffer.addException(exceptionData);

		return { success: true };
	}
}

export type { CloudEvent } from "./cloudevents";
export { DataBuffer } from "./durable-objects/data-buffer";

export default class extends PostHogCollector {
	async tail(events: TraceItem[]): Promise<void> {
		const id = this.env.DATA_BUFFER.idFromName("buffer-tail");
		const buffer = this.env.DATA_BUFFER.get(id);

		for (const trace of events) {
			// Extract request info from fetch events
			const eventInfo = trace.event as
				| {
						request?: { url?: string; method?: string; cf?: { colo?: string } };
				  }
				| undefined;

			// Serialize TraceItem to a plain object for Durable Object storage
			const serializedTrace = {
				scriptName: trace.scriptName ?? undefined,
				outcome: trace.outcome,
				eventTimestamp: trace.eventTimestamp ?? undefined,
				logs: trace.logs.map((log) => ({
					level: log.level,
					message: log.message,
					timestamp: log.timestamp,
				})),
				exceptions: trace.exceptions.map((ex) => ({
					message: ex.message,
					name: ex.name,
					timestamp: ex.timestamp,
				})),
				request: eventInfo?.request
					? {
							url: eventInfo.request.url,
							method: eventInfo.request.method,
							colo: eventInfo.request.cf?.colo,
						}
					: undefined,
			};

			await buffer.addTailEvent(serializedTrace);
		}
	}
}
