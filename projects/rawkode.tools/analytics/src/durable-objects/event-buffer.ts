import { DurableObject } from "cloudflare:workers";
import { CloudEvent } from "cloudevents";

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

export interface Env {
	POSTHOG_API_KEY: string;
	POSTHOG_HOST: string;
}

const FLUSH_INTERVAL_MS = 30 * 1000; // 30 seconds
const EVENTS_KEY = "events";
const METRICS_KEY = "metrics";

export class EventBuffer extends DurableObject<Env> {
	async addEvent(event: Record<string, unknown>, attributes?: string[]): Promise<void> {
		const events = await this.getEvents();
		events.push({ event: event as unknown as CloudEventData, attributes });
		await this.ctx.storage.put(EVENTS_KEY, events);

		const alarm = await this.ctx.storage.getAlarm();
		if (alarm === null) {
			await this.ctx.storage.setAlarm(Date.now() + FLUSH_INTERVAL_MS);
		}
	}

	async addMetric(metric: Omit<StoredMetric, "timestamp">): Promise<void> {
		const metrics = await this.getMetrics();
		metrics.push({ ...metric, timestamp: Date.now() });
		await this.ctx.storage.put(METRICS_KEY, metrics);

		const alarm = await this.ctx.storage.getAlarm();
		if (alarm === null) {
			await this.ctx.storage.setAlarm(Date.now() + FLUSH_INTERVAL_MS);
		}
	}

	async alarm(): Promise<void> {
		const events = await this.getEvents();
		if (events.length > 0) {
			try {
				await this.flushEventsToPostHog(events);
			} catch (error) {
				console.error("Failed to flush events to PostHog:", error);
				// Clear events anyway - old malformed events will never succeed
			}
			await this.ctx.storage.delete(EVENTS_KEY);
		}

		const metrics = await this.getMetrics();
		if (metrics.length > 0) {
			try {
				await this.flushMetricsToPostHog(metrics);
			} catch (error) {
				console.error("Failed to flush metrics to PostHog:", error);
				// Clear metrics anyway - old malformed metrics will never succeed
			}
			await this.ctx.storage.delete(METRICS_KEY);
		}
	}

	private async getEvents(): Promise<StoredEvent[]> {
		const raw = await this.ctx.storage.get<StoredEvent[]>(EVENTS_KEY);
		if (!raw) return [];

		return raw.filter((stored) => {
			try {
				new CloudEvent(stored.event as unknown as Record<string, unknown>, true);
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

	private async flushEventsToPostHog(events: StoredEvent[]): Promise<void> {
		console.log("Flushing events to PostHog", { count: events.length, events: JSON.stringify(events) });
		const batch = events.map((stored) => this.cloudEventToPostHogEvent(stored.event, stored.attributes));
		console.log("PostHog batch payload", { batch: JSON.stringify(batch) });

		const response = await fetch(`${this.env.POSTHOG_HOST}/batch`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				api_key: this.env.POSTHOG_API_KEY,
				batch,
			}),
		});

		if (!response.ok) {
			const body = await response.text();
			throw new Error(`PostHog batch request failed: ${response.status} ${body}`);
		}
	}

	private cloudEventToPostHogEvent(
		event: CloudEventData,
		promoteAttributes?: string[],
	): PostHogEvent {
		const properties: Record<string, unknown> = {
			$lib: "analytics-worker",
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

		// Determine distinct_id from event data or source
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

		return {
			type: "capture",
			event: event.type,
			distinct_id: distinctId,
			properties,
			timestamp: event.time || new Date().toISOString(),
		};
	}

	private async flushMetricsToPostHog(metrics: StoredMetric[]): Promise<void> {
		const batch: PostHogEvent[] = metrics.map((m) => ({
			type: "capture",
			event: "$metric",
			distinct_id: m.attributes.userId || m.attributes.sessionId || "system",
			properties: {
				$lib: "analytics-worker",
				metric_name: m.name,
				metric_value: m.value,
				...m.attributes,
			},
			timestamp: new Date(m.timestamp).toISOString(),
		}));

		const response = await fetch(`${this.env.POSTHOG_HOST}/batch`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				api_key: this.env.POSTHOG_API_KEY,
				batch,
			}),
		});

		if (!response.ok) {
			const body = await response.text();
			throw new Error(`PostHog batch metrics request failed: ${response.status} ${body}`);
		}
	}
}

interface PostHogEvent {
	type: "capture";
	event: string;
	distinct_id: string;
	properties: Record<string, unknown>;
	timestamp: string;
}
