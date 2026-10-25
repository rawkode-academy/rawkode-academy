import { WorkerEntrypoint } from "cloudflare:workers";
import { validateCloudEvent } from "./cloudevents";
import type { DataBuffer } from "./durable-objects/data-buffer";
import {
	type AnalyticsRow,
	type CloudEventInput,
	rowFromCloudEvent,
	rowFromException,
	rowFromMetric,
	rowFromWebEvent,
	toStreamRecord,
	type WebContext,
	type WebEvent,
} from "./events";

export interface EventsStream {
	send(records: Record<string, unknown>[]): Promise<void>;
}

export interface Env {
	DATA_BUFFER: DurableObjectNamespace<DataBuffer>;
	POSTHOG_PROJECT_TOKEN: SecretsStoreSecret;
	POSTHOG_HOST: string;
	/** Basin stream `analytics_events`; absent until basin/provision.sh has run. */
	EVENTS?: EventsStream;
}

const MAX_WEB_EVENTS_PER_BATCH = 50;


export interface TrackEventResult {
	success: boolean;
	error?: string;
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

		// Browser events from the website's /api/e. These go to the Basin stream
		// only: posthog-js already sends them to PostHog during the dual-run.
		if (url.pathname === "/ingest" && request.method === "POST") {
			const body = (await request.json().catch(() => null)) as {
				events?: unknown;
				context?: WebContext;
			} | null;
			if (!body || !Array.isArray(body.events)) {
				return Response.json(
					{ success: false, error: "Expected { events: [] }" },
					{ status: 400 },
				);
			}
			const accepted = await this.ingestWebEvents(
				body.events as WebEvent[],
				body.context ?? {},
			);
			return Response.json({ success: true, accepted });
		}

		// CloudEvent tracking endpoint (compatible with analytics worker)
		if (url.pathname === "/track" && request.method === "POST") {
			try {
				const body = (await request.json()) as {
					event?: unknown;
					attributes?: string[];
				};

				const event = body.event ?? body;
				const attributes = body.event ? body.attributes : undefined;

				const result = await this.trackEvent(event, { attributes });

				return Response.json(result, {
					status: result.success ? 200 : 400,
				});
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";
				console.error("Track endpoint error", { error: errorMessage });
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
		const validation = validateCloudEvent(event);

		if (!validation.valid) {
			console.error("CloudEvent validation failed", {
				error: validation.error,
				event,
			});
			return { success: false, error: validation.error };
		}

		const id = this.env.DATA_BUFFER.idFromName("buffer-events");
		const buffer = this.env.DATA_BUFFER.get(id);

		const json = validation.event.toJSON();
		await buffer.addEvent(json, options?.attributes);
		this.stream([rowFromCloudEvent(json as unknown as CloudEventInput)]);

		return { success: true };
	}

	async trackMetric(
		name: string,
		value: number,
		attributes: Record<string, string>,
	): Promise<TrackEventResult> {
		const id = this.env.DATA_BUFFER.idFromName("buffer-metrics");
		const buffer = this.env.DATA_BUFFER.get(id);

		await buffer.addMetric({ name, value, attributes });
		this.stream([rowFromMetric({ name, value, attributes })]);

		return { success: true };
	}

	async ingestWebEvents(
		events: WebEvent[],
		context: WebContext,
	): Promise<number> {
		const rows = events
			.slice(0, MAX_WEB_EVENTS_PER_BATCH)
			.map((event) => rowFromWebEvent(event, context))
			.filter((row): row is AnalyticsRow => row !== null);
		if (rows.length > 0) await this.sendRows(rows);
		return rows.length;
	}

	/** Fire-and-forget: the stream must never fail a PostHog/Grafana write. */
	private stream(rows: AnalyticsRow[]): void {
		this.ctx.waitUntil(this.sendRows(rows));
	}

	private async sendRows(rows: AnalyticsRow[]): Promise<void> {
		if (!this.env.EVENTS) return;
		try {
			await this.env.EVENTS.send(rows.map(toStreamRecord));
		} catch (error) {
			console.error("Basin stream send failed", {
				error: error instanceof Error ? error.message : String(error),
				count: rows.length,
			});
		}
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
		this.stream([rowFromException(exceptionData)]);

		return { success: true };
	}
}

export { DataBuffer } from "./durable-objects/data-buffer";
export type { CloudEvent } from "./cloudevents";

export default class extends PostHogCollector {
	async tail(events: TraceItem[]): Promise<void> {
		const id = this.env.DATA_BUFFER.idFromName("buffer-tail");
		const buffer = this.env.DATA_BUFFER.get(id);

		for (const trace of events) {
			// Extract request info from fetch events
			const eventInfo = trace.event as
				| { request?: { url?: string; method?: string; cf?: { colo?: string } } }
				| undefined;

			// Serialize TraceItem to a plain object for Durable Object storage
			const serializedTrace = {
				scriptName: trace.scriptName,
				outcome: trace.outcome,
				eventTimestamp: trace.eventTimestamp,
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
