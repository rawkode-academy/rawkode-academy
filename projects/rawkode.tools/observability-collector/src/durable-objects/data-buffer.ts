import { DurableObject } from "cloudflare:workers";
import type { EventsStream, ExceptionData } from "../index";
import { DeliveryQueue, type Destination } from "../delivery-queue";

interface CloudEventData {
	specversion: string;
	id: string;
	source: string;
	type: string;
	time?: string;
	subject?: string;
	datacontenttype?: string;
	data?: unknown;
	/** Extension attributes carry request context, such as country and referrer. */
	[extension: string]: unknown;
}

const CORE_ATTRIBUTES = new Set([
	"specversion",
	"id",
	"source",
	"type",
	"time",
	"subject",
	"datacontenttype",
	"dataschema",
	"data",
	"data_base64",
]);

interface StoredEvent {
	event: CloudEventData;
	attributes?: string[];
}

interface StoredMetric {
	name: string;
	value: number;
	attributes: Record<string, string>;
	timestamp: number;
}

interface StoredLog {
	body: string; // base64 encoded
	contentType: string;
	timestamp: number;
}

// Serializable version of TraceItem for Durable Object storage
export interface SerializedTraceItem {
	scriptName?: string;
	outcome: string;
	eventTimestamp?: number;
	logs: Array<{
		level: string;
		message: unknown[];
		timestamp: number;
	}>;
	exceptions: Array<{
		message: string;
		name: string;
		timestamp: number;
	}>;
	request?: {
		url?: string;
		method?: string;
		colo?: string;
	};
}

interface StoredTailEvent {
	trace: SerializedTraceItem;
	timestamp: number;
}

// OTLP Log types for PostHog /i/v1/logs endpoint
interface OTLPAttribute {
	key: string;
	value: { stringValue: string };
}

interface OTLPLogRecord {
	timeUnixNano: string;
	severityNumber: number;
	severityText: string;
	body: { stringValue: string };
	attributes: OTLPAttribute[];
}

interface OTLPExportLogsServiceRequest {
	resourceLogs: Array<{
		resource: {
			attributes: OTLPAttribute[];
		};
		scopeLogs: Array<{
			scope: { name: string };
			logRecords: OTLPLogRecord[];
		}>;
	}>;
}

// Map Cloudflare log levels to OTLP severity
const LOG_LEVEL_TO_SEVERITY: Record<string, { number: number; text: string }> =
	{
		debug: { number: 5, text: "DEBUG" },
		log: { number: 9, text: "INFO" },
		info: { number: 9, text: "INFO" },
		warn: { number: 13, text: "WARN" },
		error: { number: 17, text: "ERROR" },
	};

// Extract Worker name from CloudEvent source
function getWorkerName(source: string | undefined): string {
	return source || "unknown";
}

export interface Env {
	EVENTS?: EventsStream;
	POSTHOG_PROJECT_TOKEN: SecretsStoreSecret;
	POSTHOG_HOST: string;
	GRAFANA_OTLP_TOKEN?: SecretsStoreSecret;
	GRAFANA_OTLP_HOST?: string;
	GRAFANA_INSTANCE_ID?: string;
}

type Delivery =
	| { kind: "event"; value: StoredEvent }
	| { kind: "metric"; value: StoredMetric }
	| { kind: "exception"; value: ExceptionData }
	| { kind: "log"; value: StoredLog }
	| { kind: "tail"; value: StoredTailEvent };

export class DataBuffer extends DurableObject<Env> {
	private queue() {
		return new DeliveryQueue<Delivery>(this.ctx.storage);
	}

	private destinations(kind: Delivery["kind"]): Destination[] {
		return [
			...(kind === "event" ? ["basin" as const] : []),
			"posthog",
			...(this.env.GRAFANA_OTLP_TOKEN && this.env.GRAFANA_OTLP_HOST
				? ["grafana" as const]
				: []),
		];
	}

	async addEvent(
		event: Record<string, unknown>,
		attributes?: string[],
	): Promise<void> {
		await this.queue().enqueue(
			{
				kind: "event",
				value: { event: event as unknown as CloudEventData, attributes },
			},
			this.destinations("event"),
		);
	}

	async addMetric(metric: Omit<StoredMetric, "timestamp">): Promise<void> {
		await this.queue().enqueue(
			{ kind: "metric", value: { ...metric, timestamp: Date.now() } },
			this.destinations("metric"),
		);
	}

	async addLog(body: ArrayBuffer, contentType: string): Promise<void> {
		const bytes = new Uint8Array(body);
		// Avoid spreading an unbounded request body onto the JavaScript stack.
		let binary = "";
		for (let offset = 0; offset < bytes.length; offset += 8192)
			binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
		await this.queue().enqueue(
			{
				kind: "log",
				value: { body: btoa(binary), contentType, timestamp: Date.now() },
			},
			this.destinations("log"),
		);
	}

	async addException(exception: ExceptionData): Promise<void> {
		await this.queue().enqueue(
			{ kind: "exception", value: exception },
			this.destinations("exception"),
		);
	}

	async addTailEvent(trace: SerializedTraceItem): Promise<void> {
		await this.queue().enqueue(
			{ kind: "tail", value: { trace, timestamp: Date.now() } },
			this.destinations("tail"),
		);
	}

	// RPC only: never expose queue contents, health or replay on public /track.
	async deliveryStatus() {
		return this.queue().status();
	}
	async replayFailed(destination: Destination) {
		if (!["basin", "posthog", "grafana"].includes(destination))
			throw new Error("Invalid destination");
		await this.queue().replay(destination);
	}

	async alarm(): Promise<void> {
		const queue = this.queue();
		await queue.migrate<StoredEvent>("events", (value) => ({
			payload: { kind: "event", value },
			destinations: this.destinations("event"),
		}));
		await queue.migrate<StoredMetric>("metrics", (value) => ({
			payload: { kind: "metric", value },
			destinations: this.destinations("metric"),
		}));
		await queue.migrate<ExceptionData>("exceptions", (value) => ({
			payload: { kind: "exception", value },
			destinations: this.destinations("exception"),
		}));
		await queue.migrate<StoredLog>("logs", (value) => ({
			payload: { kind: "log", value },
			destinations: this.destinations("log"),
		}));
		await queue.migrate<StoredTailEvent>("tail_events", (value) => ({
			payload: { kind: "tail", value },
			destinations: this.destinations("tail"),
		}));
		await queue.drain(async (destination, deliveries) => {
			const events = deliveries.flatMap((item) =>
				item.kind === "event" ? [item.value] : [],
			);
			const metrics = deliveries.flatMap((item) =>
				item.kind === "metric" ? [item.value] : [],
			);
			const exceptions = deliveries.flatMap((item) =>
				item.kind === "exception" ? [item.value] : [],
			);
			const logs = deliveries.flatMap((item) =>
				item.kind === "log" ? [item.value] : [],
			);
			const tails = deliveries.flatMap((item) =>
				item.kind === "tail" ? [item.value] : [],
			);
			if (destination === "basin") {
				if (!this.env.EVENTS) throw new Error("Basin stream is not bound");
				await this.env.EVENTS.send(
					events.map((item) => ({ value: item.event })),
				);
			} else if (destination === "posthog") {
				if (logs.length) await this.flushLogsToPostHog(logs);
				if (tails.length) await this.flushTailEventsAsOTLP(tails);
				if (events.length || metrics.length || exceptions.length)
					await this.flushEventsToPostHog(events, metrics, exceptions);
			} else {
				if (!this.env.GRAFANA_OTLP_TOKEN || !this.env.GRAFANA_OTLP_HOST)
					throw new Error("Grafana is not configured");
				if (logs.length) await this.flushLogsToGrafana(logs);
				if (tails.length) await this.flushTailEventsToGrafana(tails);
				if (events.length || metrics.length || exceptions.length)
					await this.flushToGrafanaOTLP(events, metrics, exceptions);
			}
		});
		console.log("analytics.delivery.status", await queue.status());
	}

	private async flushTailEventsAsOTLP(
		tailEvents: StoredTailEvent[],
	): Promise<void> {
		if (tailEvents.length === 0) return;

		const token = await this.env.POSTHOG_PROJECT_TOKEN.get();

		// Group tail events by worker name for efficient batching
		const eventsByWorker = new Map<string, StoredTailEvent[]>();
		for (const event of tailEvents) {
			const workerName = event.trace.scriptName ?? "unknown";
			const existing = eventsByWorker.get(workerName) ?? [];
			existing.push(event);
			eventsByWorker.set(workerName, existing);
		}

		// Build OTLP request with resourceLogs per worker
		const resourceLogs: OTLPExportLogsServiceRequest["resourceLogs"] = [];

		for (const [workerName, events] of eventsByWorker) {
			const logRecords: OTLPLogRecord[] = [];

			for (const stored of events) {
				const trace = stored.trace;

				// Convert each console log to an OTLP LogRecord
				for (const log of trace.logs) {
					const severity = LOG_LEVEL_TO_SEVERITY[log.level] ?? {
						number: 9,
						text: "INFO",
					};
					// Properly serialize objects in log messages
					const message = log.message
						.map((part) =>
							typeof part === "object" ? JSON.stringify(part) : String(part),
						)
						.join(" ");

					logRecords.push({
						timeUnixNano: (log.timestamp * 1_000_000).toString(),
						severityNumber: severity.number,
						severityText: severity.text,
						body: { stringValue: message },
						attributes: [
							{ key: "worker.name", value: { stringValue: workerName } },
							{ key: "worker.outcome", value: { stringValue: trace.outcome } },
							...(trace.request?.url
								? [
										{
											key: "http.url",
											value: { stringValue: trace.request.url },
										},
									]
								: []),
							...(trace.request?.method
								? [
										{
											key: "http.method",
											value: { stringValue: trace.request.method },
										},
									]
								: []),
							...(trace.request?.colo
								? [
										{
											key: "cloudflare.colo",
											value: { stringValue: trace.request.colo },
										},
									]
								: []),
						],
					});
				}

				// Convert exceptions to error logs
				for (const exc of trace.exceptions) {
					logRecords.push({
						timeUnixNano: (exc.timestamp * 1_000_000).toString(),
						severityNumber: 17, // ERROR
						severityText: "ERROR",
						body: { stringValue: `${exc.name}: ${exc.message}` },
						attributes: [
							{ key: "worker.name", value: { stringValue: workerName } },
							{ key: "worker.outcome", value: { stringValue: trace.outcome } },
							{ key: "exception.type", value: { stringValue: exc.name } },
							{ key: "exception.message", value: { stringValue: exc.message } },
						],
					});
				}
			}

			if (logRecords.length > 0) {
				resourceLogs.push({
					resource: {
						attributes: [
							{ key: "service.name", value: { stringValue: workerName } },
							{
								key: "service.namespace",
								value: { stringValue: "cloudflare-workers" },
							},
						],
					},
					scopeLogs: [
						{
							scope: { name: "observability-collector" },
							logRecords,
						},
					],
				});
			}
		}

		if (resourceLogs.length === 0) return;

		const otlpRequest: OTLPExportLogsServiceRequest = { resourceLogs };

		const response = await fetch(`${this.env.POSTHOG_HOST}/i/v1/logs`, {
			method: "POST",
			signal: AbortSignal.timeout(15_000),
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify(otlpRequest),
		});

		if (!response.ok)
			throw new Error(`Destination rejected delivery (${response.status})`);
	}

	private async flushLogsToPostHog(logs: StoredLog[]): Promise<void> {
		// PostHog accepts OTLP logs at /i/v1/logs
		// We need to forward each log batch
		const token = await this.env.POSTHOG_PROJECT_TOKEN.get();

		for (const log of logs) {
			const body = Uint8Array.from(atob(log.body), (c) => c.charCodeAt(0));

			const response = await fetch(`${this.env.POSTHOG_HOST}/i/v1/logs`, {
				method: "POST",
				signal: AbortSignal.timeout(15_000),
				headers: {
					"Content-Type": log.contentType,
					Authorization: `Bearer ${token}`,
				},
				body: body,
			});

			if (!response.ok)
				throw new Error(`Destination rejected delivery (${response.status})`);
		}
	}

	private async flushEventsToPostHog(
		events: StoredEvent[],
		metrics: StoredMetric[],
		exceptions: ExceptionData[],
	): Promise<void> {
		const token = await this.env.POSTHOG_PROJECT_TOKEN.get();
		const batch: {
			event: string;
			properties: Record<string, unknown>;
			timestamp: string;
		}[] = [];
		const capture = (input: {
			distinctId: string;
			event: string;
			properties: Record<string, unknown>;
			timestamp: Date;
		}) => {
			batch.push({
				event: input.event,
				properties: { ...input.properties, distinct_id: input.distinctId },
				timestamp: input.timestamp.toISOString(),
			});
		};

		// Process CloudEvents
		for (const stored of events) {
			const event = stored.event;
			const properties: Record<string, unknown> = {
				$lib: "observability-collector",
				cloudevents_specversion: event.specversion,
				cloudevents_id: event.id,
				cloudevents_source: event.source,
			};

			if (event.subject) {
				properties.cloudevents_subject = event.subject;
			}

			if (event.datacontenttype) {
				properties.cloudevents_datacontenttype = event.datacontenttype;
			}

			for (const [key, value] of Object.entries(event)) {
				if (!CORE_ATTRIBUTES.has(key)) properties[key] = value;
			}

			// Include event data as properties (prefixed to avoid collisions)
			if (event.data && typeof event.data === "object") {
				const data = event.data as Record<string, unknown>;
				for (const [key, value] of Object.entries(data)) {
					properties[`data.${key}`] = value;
				}
			}

			properties.$insert_id = `${event.source}:${event.id}`;

			// Determine distinct_id
			let distinctId = "anonymous";
			if (event.data && typeof event.data === "object") {
				const data = event.data as Record<string, unknown>;
				if (typeof data.userId === "string") {
					distinctId = data.userId;
				} else if (typeof data.user_id === "string") {
					distinctId = data.user_id;
				} else if (typeof data.sessionId === "string") {
					distinctId = data.sessionId;
				} else if (typeof data.distinct_id === "string") {
					distinctId = data.distinct_id;
				}
			}

			// Use actual Worker name as prefix for event type
			const workerName = getWorkerName(event.source);
			const eventName = `${workerName}.${event.type}`;

			capture({
				distinctId,
				event: eventName,
				properties,
				timestamp: event.time ? new Date(event.time) : new Date(),
			});
		}

		// Process metrics as events
		for (const metric of metrics) {
			capture({
				distinctId:
					metric.attributes.userId || metric.attributes.sessionId || "system",
				event: "$metric",
				properties: {
					$lib: "observability-collector",
					metric_name: metric.name,
					metric_value: metric.value,
					...metric.attributes,
				},
				timestamp: new Date(metric.timestamp),
			});
		}

		// Process exceptions
		for (const exception of exceptions) {
			capture({
				distinctId: exception.distinctId || "anonymous",
				event: "$exception",
				properties: {
					$lib: "observability-collector",
					$exception_message: exception.message,
					$exception_stack_trace_raw: exception.stack,
					$exception_type: exception.name,
					...exception.properties,
				},
				timestamp: new Date(exception.timestamp),
			});
		}

		// A batch is acknowledged only after the server accepts it.
		const response = await fetch(`${this.env.POSTHOG_HOST}/batch/`, {
			method: "POST",
			signal: AbortSignal.timeout(15_000),
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ api_key: token, batch }),
		});
		if (!response.ok)
			throw new Error(`PostHog batch rejected (${response.status})`);
	}

	// Grafana OTLP flush methods
	private async flushLogsToGrafana(logs: StoredLog[]): Promise<void> {
		if (!this.env.GRAFANA_OTLP_TOKEN || !this.env.GRAFANA_OTLP_HOST) return;

		const token = await this.env.GRAFANA_OTLP_TOKEN.get();
		const authHeader = btoa(`${this.env.GRAFANA_INSTANCE_ID}:${token}`);

		for (const log of logs) {
			const body = Uint8Array.from(atob(log.body), (c) => c.charCodeAt(0));

			const response = await fetch(`${this.env.GRAFANA_OTLP_HOST}/v1/logs`, {
				method: "POST",
				signal: AbortSignal.timeout(15_000),
				headers: {
					"Content-Type": log.contentType,
					Authorization: `Basic ${authHeader}`,
				},
				body: body,
			});

			if (!response.ok)
				throw new Error(`Destination rejected delivery (${response.status})`);
		}
	}

	private async flushTailEventsToGrafana(
		tailEvents: StoredTailEvent[],
	): Promise<void> {
		if (!this.env.GRAFANA_OTLP_TOKEN || !this.env.GRAFANA_OTLP_HOST) return;
		if (tailEvents.length === 0) return;

		const token = await this.env.GRAFANA_OTLP_TOKEN.get();
		const authHeader = btoa(`${this.env.GRAFANA_INSTANCE_ID}:${token}`);

		// Group tail events by worker name for efficient batching
		const eventsByWorker = new Map<string, StoredTailEvent[]>();
		for (const event of tailEvents) {
			const workerName = event.trace.scriptName ?? "unknown";
			const existing = eventsByWorker.get(workerName) ?? [];
			existing.push(event);
			eventsByWorker.set(workerName, existing);
		}

		// Build OTLP request with resourceLogs per worker
		const resourceLogs: OTLPExportLogsServiceRequest["resourceLogs"] = [];

		for (const [workerName, events] of eventsByWorker) {
			const logRecords: OTLPLogRecord[] = [];

			for (const stored of events) {
				const trace = stored.trace;

				for (const log of trace.logs) {
					const severity = LOG_LEVEL_TO_SEVERITY[log.level] ?? {
						number: 9,
						text: "INFO",
					};
					const message = log.message
						.map((part) =>
							typeof part === "object" ? JSON.stringify(part) : String(part),
						)
						.join(" ");

					logRecords.push({
						timeUnixNano: (log.timestamp * 1_000_000).toString(),
						severityNumber: severity.number,
						severityText: severity.text,
						body: { stringValue: message },
						attributes: [
							{ key: "worker.name", value: { stringValue: workerName } },
							{ key: "worker.outcome", value: { stringValue: trace.outcome } },
							...(trace.request?.url
								? [
										{
											key: "http.url",
											value: { stringValue: trace.request.url },
										},
									]
								: []),
							...(trace.request?.method
								? [
										{
											key: "http.method",
											value: { stringValue: trace.request.method },
										},
									]
								: []),
							...(trace.request?.colo
								? [
										{
											key: "cloudflare.colo",
											value: { stringValue: trace.request.colo },
										},
									]
								: []),
						],
					});
				}

				for (const exc of trace.exceptions) {
					logRecords.push({
						timeUnixNano: (exc.timestamp * 1_000_000).toString(),
						severityNumber: 17,
						severityText: "ERROR",
						body: { stringValue: `${exc.name}: ${exc.message}` },
						attributes: [
							{ key: "worker.name", value: { stringValue: workerName } },
							{ key: "worker.outcome", value: { stringValue: trace.outcome } },
							{ key: "exception.type", value: { stringValue: exc.name } },
							{ key: "exception.message", value: { stringValue: exc.message } },
						],
					});
				}
			}

			if (logRecords.length > 0) {
				resourceLogs.push({
					resource: {
						attributes: [
							{ key: "service.name", value: { stringValue: workerName } },
							{
								key: "service.namespace",
								value: { stringValue: "cloudflare-workers" },
							},
						],
					},
					scopeLogs: [
						{
							scope: { name: "observability-collector" },
							logRecords,
						},
					],
				});
			}
		}

		if (resourceLogs.length === 0) return;

		const otlpRequest: OTLPExportLogsServiceRequest = { resourceLogs };

		const response = await fetch(`${this.env.GRAFANA_OTLP_HOST}/v1/logs`, {
			method: "POST",
			signal: AbortSignal.timeout(15_000),
			headers: {
				"Content-Type": "application/json",
				Authorization: `Basic ${authHeader}`,
			},
			body: JSON.stringify(otlpRequest),
		});

		if (!response.ok)
			throw new Error(`Destination rejected delivery (${response.status})`);
	}

	private async flushToGrafanaOTLP(
		events: StoredEvent[],
		metrics: StoredMetric[],
		exceptions: ExceptionData[],
	): Promise<void> {
		if (!this.env.GRAFANA_OTLP_TOKEN || !this.env.GRAFANA_OTLP_HOST) return;

		const token = await this.env.GRAFANA_OTLP_TOKEN.get();
		const authHeader = btoa(`${this.env.GRAFANA_INSTANCE_ID}:${token}`);

		// Group log records by worker name
		const logRecordsByWorker = new Map<string, OTLPLogRecord[]>();

		const addLogRecord = (workerName: string, record: OTLPLogRecord) => {
			const existing = logRecordsByWorker.get(workerName) ?? [];
			existing.push(record);
			logRecordsByWorker.set(workerName, existing);
		};

		// Process CloudEvents as logs (grouped by source/worker)
		for (const stored of events) {
			const event = stored.event;
			const workerName = getWorkerName(event.source);
			const attributes: OTLPAttribute[] = [
				{
					key: "cloudevents.specversion",
					value: { stringValue: event.specversion },
				},
				{ key: "cloudevents.id", value: { stringValue: event.id } },
				{ key: "cloudevents.source", value: { stringValue: event.source } },
				{ key: "cloudevents.type", value: { stringValue: event.type } },
			];

			if (event.subject) {
				attributes.push({
					key: "cloudevents.subject",
					value: { stringValue: event.subject },
				});
			}

			// Add event data as attributes
			if (event.data && typeof event.data === "object") {
				const data = event.data as Record<string, unknown>;
				for (const [key, value] of Object.entries(data)) {
					if (
						typeof value === "string" ||
						typeof value === "number" ||
						typeof value === "boolean"
					) {
						attributes.push({
							key: `data.${key}`,
							value: { stringValue: String(value) },
						});
					}
				}
			}

			addLogRecord(workerName, {
				timeUnixNano:
					(event.time
						? new Date(event.time).getTime()
						: Date.now()
					).toString() + "000000",
				severityNumber: 9,
				severityText: "INFO",
				body: {
					stringValue: JSON.stringify({
						specversion: event.specversion,
						id: event.id,
						type: event.type,
						source: event.source,
						time: event.time,
						...(event.subject && { subject: event.subject }),
						...(typeof event.data === "object" && { data: event.data }),
					}),
				},
				attributes,
			});
		}

		// Process metrics as logs (use "observability-collector" as service)
		for (const metric of metrics) {
			const attributes: OTLPAttribute[] = [
				{ key: "metric.name", value: { stringValue: metric.name } },
				{ key: "metric.value", value: { stringValue: String(metric.value) } },
			];

			for (const [key, value] of Object.entries(metric.attributes)) {
				attributes.push({
					key: `metric.${key}`,
					value: { stringValue: value },
				});
			}

			addLogRecord("observability-collector", {
				timeUnixNano: metric.timestamp.toString() + "000000",
				severityNumber: 9,
				severityText: "INFO",
				body: { stringValue: `Metric: ${metric.name} = ${metric.value}` },
				attributes,
			});
		}

		// Process exceptions as error logs (use "observability-collector" as service)
		for (const exception of exceptions) {
			const attributes: OTLPAttribute[] = [
				{
					key: "exception.type",
					value: { stringValue: exception.name || "Error" },
				},
				{ key: "exception.message", value: { stringValue: exception.message } },
			];

			if (exception.stack) {
				attributes.push({
					key: "exception.stacktrace",
					value: { stringValue: exception.stack },
				});
			}

			if (exception.distinctId) {
				attributes.push({
					key: "user.id",
					value: { stringValue: exception.distinctId },
				});
			}

			addLogRecord("observability-collector", {
				timeUnixNano:
					new Date(exception.timestamp).getTime().toString() + "000000",
				severityNumber: 17,
				severityText: "ERROR",
				body: { stringValue: `Exception: ${exception.message}` },
				attributes,
			});
		}

		if (logRecordsByWorker.size === 0) return;

		// Build resourceLogs with one entry per worker
		const resourceLogs: OTLPExportLogsServiceRequest["resourceLogs"] = [];
		for (const [workerName, logRecords] of logRecordsByWorker) {
			resourceLogs.push({
				resource: {
					attributes: [
						{ key: "service.name", value: { stringValue: workerName } },
						{
							key: "service.namespace",
							value: { stringValue: "cloudflare-workers" },
						},
					],
				},
				scopeLogs: [
					{
						scope: { name: "observability-collector" },
						logRecords,
					},
				],
			});
		}

		const otlpRequest: OTLPExportLogsServiceRequest = { resourceLogs };

		const response = await fetch(`${this.env.GRAFANA_OTLP_HOST}/v1/logs`, {
			method: "POST",
			signal: AbortSignal.timeout(15_000),
			headers: {
				"Content-Type": "application/json",
				Authorization: `Basic ${authHeader}`,
			},
			body: JSON.stringify(otlpRequest),
		});

		if (!response.ok)
			throw new Error(`Destination rejected delivery (${response.status})`);
	}
}
