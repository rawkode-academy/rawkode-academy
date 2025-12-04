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
	GRAFANA_OTLP_ENDPOINT: string;
	GRAFANA_OTLP_USERNAME: string;
	GRAFANA_OTLP_TOKEN: string;
}

const FLUSH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const EVENTS_KEY = "events";
const METRICS_KEY = "metrics";

export class EventBuffer extends DurableObject<Env> {
	async addEvent(event: CloudEvent, attributes?: string[]): Promise<void> {
		const events = await this.getEvents();
		events.push({ event: event.toJSON() as unknown as CloudEventData, attributes });
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
		let hasErrors = false;

		const events = await this.getEvents();
		if (events.length > 0) {
			try {
				await this.flushLogsToGrafana(events);
				await this.ctx.storage.delete(EVENTS_KEY);
			} catch (error) {
				console.error("Failed to flush events to Grafana:", error);
				hasErrors = true;
			}
		}

		const metrics = await this.getMetrics();
		if (metrics.length > 0) {
			try {
				await this.flushMetricsToGrafana(metrics);
				await this.ctx.storage.delete(METRICS_KEY);
			} catch (error) {
				console.error("Failed to flush metrics to Grafana:", error);
				hasErrors = true;
			}
		}

		if (hasErrors) {
			await this.ctx.storage.setAlarm(Date.now() + FLUSH_INTERVAL_MS);
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

	private async flushLogsToGrafana(events: StoredEvent[]): Promise<void> {
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

	private async flushMetricsToGrafana(metrics: StoredMetric[]): Promise<void> {
		const payload: OtlpMetricsPayload = {
			resourceMetrics: [
				{
					resource: {
						attributes: [
							{ key: "service.name", value: { stringValue: "analytics" } },
						],
					},
					scopeMetrics: [
						{
							scope: { name: "metrics" },
							metrics: metrics.map((m) => ({
								name: m.name,
								gauge: {
									dataPoints: [
										{
											asInt: String(m.value),
											timeUnixNano: String(m.timestamp * 1_000_000),
											attributes: Object.entries(m.attributes).map(
												([k, v]) => ({
													key: k,
													value: { stringValue: v },
												}),
											),
										},
									],
								},
							})),
						},
					],
				},
			],
		};

		const credentials = btoa(
			`${this.env.GRAFANA_OTLP_USERNAME}:${this.env.GRAFANA_OTLP_TOKEN}`,
		);

		const response = await fetch(
			`${this.env.GRAFANA_OTLP_ENDPOINT}/v1/metrics`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Basic ${credentials}`,
				},
				body: JSON.stringify(payload),
			},
		);

		if (!response.ok) {
			const body = await response.text();
			throw new Error(
				`Grafana OTLP metrics request failed: ${response.status} ${body}`,
			);
		}
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

interface OtlpMetricsPayload {
	resourceMetrics: {
		resource: {
			attributes: OtlpAttribute[];
		};
		scopeMetrics: {
			scope: { name: string };
			metrics: {
				name: string;
				gauge: {
					dataPoints: {
						asInt: string;
						timeUnixNano: string;
						attributes: OtlpAttribute[];
					}[];
				};
			}[];
		}[];
	}[];
}
