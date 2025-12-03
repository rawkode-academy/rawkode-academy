import { DurableObject } from "cloudflare:workers";

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

export interface Env {
	GRAFANA_OTLP_ENDPOINT: string;
	GRAFANA_OTLP_USERNAME: string;
	GRAFANA_OTLP_TOKEN: string;
}

const FLUSH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const EVENTS_KEY = "events";

export class EventBuffer extends DurableObject<Env> {
	async addEvent(event: CloudEventData, attributes?: string[]): Promise<void> {
		const events = await this.getEvents();
		events.push({ event, attributes });
		await this.ctx.storage.put(EVENTS_KEY, events);

		const alarm = await this.ctx.storage.getAlarm();
		if (alarm === null) {
			await this.ctx.storage.setAlarm(Date.now() + FLUSH_INTERVAL_MS);
		}
	}

	async alarm(): Promise<void> {
		const events = await this.getEvents();
		if (events.length === 0) {
			return;
		}

		try {
			await this.flushToGrafana(events);
			await this.ctx.storage.delete(EVENTS_KEY);
		} catch (error) {
			console.error("Failed to flush events to Grafana:", error);
			await this.ctx.storage.setAlarm(Date.now() + FLUSH_INTERVAL_MS);
		}
	}

	private async getEvents(): Promise<StoredEvent[]> {
		const events = await this.ctx.storage.get<StoredEvent[]>(EVENTS_KEY);
		return events ?? [];
	}

	private async flushToGrafana(events: StoredEvent[]): Promise<void> {
		const otlpPayload = this.toOtlpLogs(events);
		const credentials = btoa(`${this.env.GRAFANA_OTLP_USERNAME}:${this.env.GRAFANA_OTLP_TOKEN}`);

		const response = await fetch(`${this.env.GRAFANA_OTLP_ENDPOINT}/v1/logs`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Basic ${credentials}`,
			},
			body: JSON.stringify(otlpPayload),
		});

		if (!response.ok) {
			const body = await response.text();
			throw new Error(`Grafana OTLP request failed: ${response.status} ${body}`);
		}
	}

	private toOtlpLogs(events: StoredEvent[]): OtlpLogsPayload {
		return {
			resourceLogs: [
				{
					resource: {
						attributes: [
							{ key: "service.name", value: { stringValue: "analytics" } },
						],
					},
					scopeLogs: [
						{
							scope: { name: "cloudevents" },
							logRecords: events.map((stored) =>
								this.cloudEventToLogRecord(stored.event, stored.attributes),
							),
						},
					],
				},
			],
		};
	}

	private cloudEventToLogRecord(
		event: CloudEventData,
		promoteAttributes?: string[],
	): OtlpLogRecord {
		const attributes: OtlpAttribute[] = [
			{ key: "cloudevents.specversion", value: { stringValue: event.specversion } },
			{ key: "cloudevents.id", value: { stringValue: event.id } },
			{ key: "cloudevents.source", value: { stringValue: event.source } },
			{ key: "cloudevents.type", value: { stringValue: event.type } },
		];

		if (event.subject) {
			attributes.push({ key: "cloudevents.subject", value: { stringValue: event.subject } });
		}

		if (event.datacontenttype) {
			attributes.push({ key: "cloudevents.datacontenttype", value: { stringValue: event.datacontenttype } });
		}

		// Promote specified fields from event.data to attributes
		if (promoteAttributes && event.data && typeof event.data === "object") {
			const data = event.data as Record<string, unknown>;
			for (const key of promoteAttributes) {
				if (key in data && data[key] != null) {
					const value = data[key];
					const stringValue = typeof value === "string" ? value : String(value);
					attributes.push({ key, value: { stringValue } });
				}
			}
		}

		const timestamp = event.time ? new Date(event.time).getTime() : Date.now();

		return {
			timeUnixNano: String(timestamp * 1_000_000),
			severityNumber: 9, // INFO
			severityText: "INFO",
			body: event.data ? { stringValue: JSON.stringify(event.data) } : undefined,
			attributes,
		};
	}
}

interface OtlpLogsPayload {
	resourceLogs: {
		resource: {
			attributes: OtlpAttribute[];
		};
		scopeLogs: {
			scope: { name: string };
			logRecords: OtlpLogRecord[];
		}[];
	}[];
}

interface OtlpLogRecord {
	timeUnixNano: string;
	severityNumber: number;
	severityText: string;
	body?: { stringValue: string };
	attributes: OtlpAttribute[];
}

interface OtlpAttribute {
	key: string;
	value: { stringValue: string };
}
