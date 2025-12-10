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

export interface Env {
	POSTHOG_PROJECT_TOKEN: SecretsStoreSecret;
	POSTHOG_HOST: string;
}

const FLUSH_INTERVAL_MS = 30 * 1000; // 30 seconds
const EVENTS_KEY = "events";
const METRICS_KEY = "metrics";
const LOGS_KEY = "logs";
const EXCEPTIONS_KEY = "exceptions";

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

	private async ensureAlarm(): Promise<void> {
		const alarm = await this.ctx.storage.getAlarm();
		if (alarm === null) {
			await this.ctx.storage.setAlarm(Date.now() + FLUSH_INTERVAL_MS);
		}
	}

	async alarm(): Promise<void> {
		// Flush logs (raw OTLP passthrough)
		const logs = await this.getLogs();
		if (logs.length > 0) {
			try {
				await this.flushLogsToPostHog(logs);
			} catch (error) {
				console.error("Failed to flush logs to PostHog:", error);
			}
			await this.ctx.storage.delete(LOGS_KEY);
		}

		// Flush events, metrics, and exceptions using PostHog SDK
		const events = await this.getEvents();
		const metrics = await this.getMetrics();
		const exceptions = await this.getExceptions();

		if (events.length > 0 || metrics.length > 0 || exceptions.length > 0) {
			try {
				await this.flushToPostHogSDK(events, metrics, exceptions);
			} catch (error) {
				console.error("Failed to flush to PostHog SDK:", error);
			}
			await this.ctx.storage.delete(EVENTS_KEY);
			await this.ctx.storage.delete(METRICS_KEY);
			await this.ctx.storage.delete(EXCEPTIONS_KEY);
		}
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
				$lib: "posthog-collector",
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
				} else if (typeof data.sessionId === "string") {
					distinctId = data.sessionId;
				} else if (typeof data.distinct_id === "string") {
					distinctId = data.distinct_id;
				}
			}

			posthog.capture({
				distinctId,
				event: event.type,
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
					$lib: "posthog-collector",
					metric_name: metric.name,
					metric_value: metric.value,
					...metric.attributes,
				},
				timestamp: new Date(metric.timestamp),
			});
		}

		// Process exceptions
		for (const exception of exceptions) {
			// PostHog SDK's captureException expects an Error object or specific format
			// We'll capture as a $exception event with the right properties
			posthog.capture({
				distinctId: exception.distinctId || "anonymous",
				event: "$exception",
				properties: {
					$lib: "posthog-collector",
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
}
