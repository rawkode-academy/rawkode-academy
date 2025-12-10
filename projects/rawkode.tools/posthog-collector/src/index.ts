import { WorkerEntrypoint } from "cloudflare:workers";
import { validateCloudEvent } from "./cloudevents";
import type { DataBuffer } from "./durable-objects/data-buffer";

export interface Env {
	DATA_BUFFER: DurableObjectNamespace<DataBuffer>;
	POSTHOG_PROJECT_TOKEN: SecretsStoreSecret;
	POSTHOG_HOST: string;
}


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

		await buffer.addEvent(validation.event.toJSON(), options?.attributes);

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

		return { success: true };
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

export { DataBuffer } from "./durable-objects/data-buffer";
export type { CloudEvent } from "./cloudevents";

export default class extends PostHogCollector {
	async tail(events: TraceItem[]): Promise<void> {
		const id = this.env.DATA_BUFFER.idFromName("buffer-tail");
		const buffer = this.env.DATA_BUFFER.get(id);

		for (const trace of events) {
			await buffer.addTailEvent(trace);
		}
	}
}
