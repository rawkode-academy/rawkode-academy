import { DurableObject } from "cloudflare:workers";
import { PostHog } from "posthog-node";
import { CloudEvent } from "cloudevents";
import type { ExceptionData } from "../index";

interface CloudEventData {
	specversion: string;
	id: string;
	source: string;
	type: string;
	time?: string;
	subject?: string;
	datacontenttype?: string;
	data?: unknown;
}

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
const LOG_LEVEL_TO_SEVERITY: Record<string, { number: number; text: string }> = {
	debug: { number: 5, text: "DEBUG" },
	log: { number: 9, text: "INFO" },
	info: { number: 9, text: "INFO" },
	warn: { number: 13, text: "WARN" },
	error: { number: 17, text: "ERROR" },
};

export interface Env {
	POSTHOG_PROJECT_TOKEN: SecretsStoreSecret;
	POSTHOG_HOST: string;
	GRAFANA_OTLP_TOKEN?: SecretsStoreSecret;
	GRAFANA_OTLP_HOST?: string;
	GRAFANA_INSTANCE_ID?: string;
}

const FLUSH_INTERVAL_MS = 30 * 1000; // 30 seconds
const EVENTS_KEY = "events";
const METRICS_KEY = "metrics";
const LOGS_KEY = "logs";
const EXCEPTIONS_KEY = "exceptions";
const TAIL_EVENTS_KEY = "tail_events";

export class DataBuffer extends DurableObject<Env> {
	async addEvent(
		event: Record<string, unknown>,
		attributes?: string[],
	): Promise<void> {
		const events = await this.getEvents();
		events.push({ event: event as unknown as CloudEventData, attributes });
		await this.ctx.storage.put(EVENTS_KEY, events);
		await this.ensureAlarm();
	}

	async addMetric(metric: Omit<StoredMetric, "timestamp">): Promise<void> {
		const metrics = await this.getMetrics();
		metrics.push({ ...metric, timestamp: Date.now() });
		await this.ctx.storage.put(METRICS_KEY, metrics);
		await this.ensureAlarm();
	}

	async addLog(body: ArrayBuffer, contentType: string): Promise<void> {
		const logs = await this.getLogs();
		const base64Body = btoa(
			String.fromCharCode(...new Uint8Array(body)),
		);
		logs.push({
			body: base64Body,
			contentType,
			timestamp: Date.now(),
		});
		await this.ctx.storage.put(LOGS_KEY, logs);
		await this.ensureAlarm();
	}

	async addException(exception: ExceptionData): Promise<void> {
		const exceptions = await this.getExceptions();
		exceptions.push(exception);
		await this.ctx.storage.put(EXCEPTIONS_KEY, exceptions);
		await this.ensureAlarm();
	}

	async addTailEvent(trace: SerializedTraceItem): Promise<void> {
		const tailEvents = await this.getTailEvents();
		tailEvents.push({ trace, timestamp: Date.now() });
		await this.ctx.storage.put(TAIL_EVENTS_KEY, tailEvents);
		await this.ensureAlarm();
	}

	private async ensureAlarm(): Promise<void> {
		const alarm = await this.ctx.storage.getAlarm();
		if (alarm === null) {
			await this.ctx.storage.setAlarm(Date.now() + FLUSH_INTERVAL_MS);
		}
	}

	async alarm(): Promise<void> {
		const logs = await this.getLogs();
		const tailEvents = await this.getTailEvents();
		const events = await this.getEvents();
		const metrics = await this.getMetrics();
		const exceptions = await this.getExceptions();

		// Flush to PostHog
		if (logs.length > 0) {
			try {
				await this.flushLogsToPostHog(logs);
			} catch (error) {
				console.error("Failed to flush logs to PostHog:", error);
			}
		}

		if (tailEvents.length > 0) {
			try {
				await this.flushTailEventsAsOTLP(tailEvents);
			} catch (error) {
				console.error("Failed to flush tail events to PostHog:", error);
			}
		}

		if (events.length > 0 || metrics.length > 0 || exceptions.length > 0) {
			try {
				await this.flushToPostHogSDK(events, metrics, exceptions);
			} catch (error) {
				console.error("Failed to flush to PostHog SDK:", error);
			}
		}

		// Flush to Grafana (if configured)
		if (this.env.GRAFANA_OTLP_TOKEN && this.env.GRAFANA_OTLP_HOST) {
			if (logs.length > 0) {
				try {
					await this.flushLogsToGrafana(logs);
				} catch (error) {
					console.error("Failed to flush logs to Grafana:", error);
				}
			}

			if (tailEvents.length > 0) {
				try {
					await this.flushTailEventsToGrafana(tailEvents);
				} catch (error) {
					console.error("Failed to flush tail events to Grafana:", error);
				}
			}

			if (events.length > 0 || metrics.length > 0 || exceptions.length > 0) {
				try {
					await this.flushToGrafanaOTLP(events, metrics, exceptions);
				} catch (error) {
					console.error("Failed to flush to Grafana OTLP:", error);
				}
			}
		}

		// Clear storage after flushing to all destinations
		if (logs.length > 0) await this.ctx.storage.delete(LOGS_KEY);
		if (tailEvents.length > 0) await this.ctx.storage.delete(TAIL_EVENTS_KEY);
		if (events.length > 0) await this.ctx.storage.delete(EVENTS_KEY);
		if (metrics.length > 0) await this.ctx.storage.delete(METRICS_KEY);
		if (exceptions.length > 0) await this.ctx.storage.delete(EXCEPTIONS_KEY);
	}

	private async getEvents(): Promise<StoredEvent[]> {
		const raw = await this.ctx.storage.get<StoredEvent[]>(EVENTS_KEY);
		if (!raw) return [];

		return raw.filter((stored) => {
			try {
				new CloudEvent(
					stored.event as unknown as Record<string, unknown>,
					true,
				);
				return true;
			} catch (error) {
				console.warn("Filtering invalid stored CloudEvent:", error, stored);
				return false;
			}
		});
	}

	private async getMetrics(): Promise<StoredMetric[]> {
		const metrics = await this.ctx.storage.get<StoredMetric[]>(METRICS_KEY);
		return metrics ?? [];
	}

	private async getLogs(): Promise<StoredLog[]> {
		const logs = await this.ctx.storage.get<StoredLog[]>(LOGS_KEY);
		return logs ?? [];
	}

	private async getExceptions(): Promise<ExceptionData[]> {
		const exceptions =
			await this.ctx.storage.get<ExceptionData[]>(EXCEPTIONS_KEY);
		return exceptions ?? [];
	}

	private async getTailEvents(): Promise<StoredTailEvent[]> {
		const tailEvents =
			await this.ctx.storage.get<StoredTailEvent[]>(TAIL_EVENTS_KEY);
		return tailEvents ?? [];
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
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify(otlpRequest),
		});

		if (!response.ok) {
			const text = await response.text();
			console.error("PostHog OTLP logs request failed:", {
				status: response.status,
				body: text,
			});
		}
	}

	private async flushLogsToPostHog(logs: StoredLog[]): Promise<void> {
		// PostHog accepts OTLP logs at /i/v1/logs
		// We need to forward each log batch
		const token = await this.env.POSTHOG_PROJECT_TOKEN.get();

		for (const log of logs) {
			const body = Uint8Array.from(atob(log.body), (c) => c.charCodeAt(0));

			const response = await fetch(`${this.env.POSTHOG_HOST}/i/v1/logs`, {
				method: "POST",
				headers: {
					"Content-Type": log.contentType,
					Authorization: `Bearer ${token}`,
				},
				body: body,
			});

			if (!response.ok) {
				const text = await response.text();
				console.error("PostHog logs request failed:", {
					status: response.status,
					body: text,
				});
			}
		}
	}

	private async flushToPostHogSDK(
		events: StoredEvent[],
		metrics: StoredMetric[],
		exceptions: ExceptionData[],
	): Promise<void> {
		const token = await this.env.POSTHOG_PROJECT_TOKEN.get();
		const posthog = new PostHog(token, {
			host: this.env.POSTHOG_HOST,
			flushAt: 1,
			flushInterval: 0,
		});

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

			// Include event data as properties
			if (event.data && typeof event.data === "object") {
				const data = event.data as Record<string, unknown>;
				for (const [key, value] of Object.entries(data)) {
					properties[key] = value;
				}
			}

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

			// Add rawkode.academy prefix to event type for PostHog
			const eventName = event.type.startsWith("rawkode.academy.")
				? event.type
				: `rawkode.academy.${event.type}`;

			posthog.capture({
				distinctId,
				event: eventName,
				properties,
				timestamp: event.time ? new Date(event.time) : new Date(),
			});
		}

		// Process metrics as events
		for (const metric of metrics) {
			posthog.capture({
				distinctId:
					metric.attributes.userId ||
					metric.attributes.sessionId ||
					"system",
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
			posthog.capture({
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

		// Flush all queued events
		await posthog.shutdown();
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
				headers: {
					"Content-Type": log.contentType,
					Authorization: `Basic ${authHeader}`,
				},
				body: body,
			});

			if (!response.ok) {
				const text = await response.text();
				console.error("Grafana OTLP logs request failed:", {
					status: response.status,
					body: text,
				});
			}
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
								? [{ key: "http.url", value: { stringValue: trace.request.url } }]
								: []),
							...(trace.request?.method
								? [{ key: "http.method", value: { stringValue: trace.request.method } }]
								: []),
							...(trace.request?.colo
								? [{ key: "cloudflare.colo", value: { stringValue: trace.request.colo } }]
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
							{ key: "service.namespace", value: { stringValue: "cloudflare-workers" } },
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
			headers: {
				"Content-Type": "application/json",
				Authorization: `Basic ${authHeader}`,
			},
			body: JSON.stringify(otlpRequest),
		});

		if (!response.ok) {
			const text = await response.text();
			console.error("Grafana OTLP tail events request failed:", {
				status: response.status,
				body: text,
			});
		}
	}

	private async flushToGrafanaOTLP(
		events: StoredEvent[],
		metrics: StoredMetric[],
		exceptions: ExceptionData[],
	): Promise<void> {
		if (!this.env.GRAFANA_OTLP_TOKEN || !this.env.GRAFANA_OTLP_HOST) return;

		const token = await this.env.GRAFANA_OTLP_TOKEN.get();
		const authHeader = btoa(`${this.env.GRAFANA_INSTANCE_ID}:${token}`);

		// Convert events, metrics, and exceptions to OTLP log format
		const logRecords: OTLPLogRecord[] = [];

		// Process CloudEvents as logs
		for (const stored of events) {
			const event = stored.event;
			const attributes: OTLPAttribute[] = [
				{ key: "cloudevents.specversion", value: { stringValue: event.specversion } },
				{ key: "cloudevents.id", value: { stringValue: event.id } },
				{ key: "cloudevents.source", value: { stringValue: event.source } },
				{ key: "cloudevents.type", value: { stringValue: event.type } },
			];

			if (event.subject) {
				attributes.push({ key: "cloudevents.subject", value: { stringValue: event.subject } });
			}

			// Add event data as attributes
			if (event.data && typeof event.data === "object") {
				const data = event.data as Record<string, unknown>;
				for (const [key, value] of Object.entries(data)) {
					if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
						attributes.push({ key: `data.${key}`, value: { stringValue: String(value) } });
					}
				}
			}

			logRecords.push({
				timeUnixNano: (event.time ? new Date(event.time).getTime() : Date.now()).toString() + "000000",
				severityNumber: 9,
				severityText: "INFO",
				body: { stringValue: `Event: ${event.type}` },
				attributes,
			});
		}

		// Process metrics as logs
		for (const metric of metrics) {
			const attributes: OTLPAttribute[] = [
				{ key: "metric.name", value: { stringValue: metric.name } },
				{ key: "metric.value", value: { stringValue: String(metric.value) } },
			];

			for (const [key, value] of Object.entries(metric.attributes)) {
				attributes.push({ key: `metric.${key}`, value: { stringValue: value } });
			}

			logRecords.push({
				timeUnixNano: metric.timestamp.toString() + "000000",
				severityNumber: 9,
				severityText: "INFO",
				body: { stringValue: `Metric: ${metric.name} = ${metric.value}` },
				attributes,
			});
		}

		// Process exceptions as error logs
		for (const exception of exceptions) {
			const attributes: OTLPAttribute[] = [
				{ key: "exception.type", value: { stringValue: exception.name || "Error" } },
				{ key: "exception.message", value: { stringValue: exception.message } },
			];

			if (exception.stack) {
				attributes.push({ key: "exception.stacktrace", value: { stringValue: exception.stack } });
			}

			if (exception.distinctId) {
				attributes.push({ key: "user.id", value: { stringValue: exception.distinctId } });
			}

			logRecords.push({
				timeUnixNano: new Date(exception.timestamp).getTime().toString() + "000000",
				severityNumber: 17,
				severityText: "ERROR",
				body: { stringValue: `Exception: ${exception.message}` },
				attributes,
			});
		}

		if (logRecords.length === 0) return;

		const otlpRequest: OTLPExportLogsServiceRequest = {
			resourceLogs: [
				{
					resource: {
						attributes: [
							{ key: "service.name", value: { stringValue: "rawkode.academy" } },
							{ key: "service.namespace", value: { stringValue: "cloudflare-workers" } },
						],
					},
					scopeLogs: [
						{
							scope: { name: "observability-collector" },
							logRecords,
						},
					],
				},
			],
		};

		const response = await fetch(`${this.env.GRAFANA_OTLP_HOST}/v1/logs`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Basic ${authHeader}`,
			},
			body: JSON.stringify(otlpRequest),
		});

		if (!response.ok) {
			const text = await response.text();
			console.error("Grafana OTLP events request failed:", {
				status: response.status,
				body: text,
			});
		}
	}
}
