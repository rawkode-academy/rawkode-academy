interface CloudEvent {
	id: string;
	specversion: string;
	type: string;
	source: string;
	time: string;
	datacontenttype?: string;
	subject?: string | undefined;
	sessionid?: string;
	userid?: string | undefined;
	projectid?: string;
	environment?: string;
	country?: string;
	city?: string;
	data: Record<string, unknown>;
}

export interface AnalyticsEnv {
	ANALYTICS?: Fetcher;
	CF_PAGES_BRANCH?: string;
}

// Service binding URL constants
const ANALYTICS_SERVICE_URLS = {
	SINGLE_EVENT: "https://internal/events",
	BATCH_EVENTS: "https://internal/events/batch",
} as const;

export class Analytics {
	private env: AnalyticsEnv;
	private sessionId: string;
	private userId: string | undefined;
	private source = "https://rawkode.academy";
	private projectId = "rawkode-academy";
	private environment: string;

	constructor(
		env: AnalyticsEnv,
		sessionId: string,
		userId: string | undefined,
	) {
		this.env = env;
		this.sessionId = sessionId;
		this.userId = userId;
		this.environment =
			env.CF_PAGES_BRANCH === "main" ? "production" : "development";
	}

	private createCloudEvent(
		type: string,
		data: Record<string, unknown>,
		subject?: string | undefined,
	): CloudEvent {
		return {
			id: crypto.randomUUID(),
			specversion: "1.0",
			type: type, // Use the type directly without prefix
			source: this.source,
			time: new Date().toISOString(),
			datacontenttype: "application/json",
			subject,
			sessionid: this.sessionId,
			userid: this.userId,
			projectid: this.projectId,
			environment: this.environment,
			data,
		};
	}

	async sendEvent(
		type: string,
		data: Record<string, unknown>,
		subject?: string | undefined,
	): Promise<boolean> {
		if (!this.env.ANALYTICS) {
			console.warn(
				`Analytics service binding not configured. Event type '${type}' will not be sent.`,
			);
			return false;
		}

		try {
			const event = this.createCloudEvent(type, data, subject);
			const response = await this.env.ANALYTICS.fetch(
				ANALYTICS_SERVICE_URLS.SINGLE_EVENT,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(event),
				},
			);

			if (!response.ok) {
				const errorText = await response.text();
				console.error(
					`Analytics service error for event type '${type}': ${response.status} ${response.statusText}`,
					errorText,
				);
			}

			return response.ok;
		} catch (error) {
			console.error("Failed to send analytics event:", error);
			return false;
		}
	}

	async sendBatchEvents(
		events: Array<{
			type: string;
			data: Record<string, unknown>;
			subject?: string | undefined;
		}>,
	): Promise<boolean> {
		if (!this.env.ANALYTICS) {
			console.warn(
				`Analytics service binding not configured. Batch of ${events.length} events will not be sent.`,
			);
			return false;
		}

		try {
			const cloudEvents = events.map(({ type, data, subject }) =>
				this.createCloudEvent(type, data, subject),
			);

			const response = await this.env.ANALYTICS.fetch(
				ANALYTICS_SERVICE_URLS.BATCH_EVENTS,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ events: cloudEvents }),
				},
			);

			if (!response.ok) {
				const errorText = await response.text();
				console.error(
					`Analytics service error for batch of ${events.length} events: ${response.status} ${response.statusText}`,
					errorText,
				);
			}

			return response.ok;
		} catch (error) {
			console.error("Failed to send batch analytics events:", error);
			return false;
		}
	}

	async trackPageView(
		url: string,
		title: string,
		referrer?: string,
		utmParams?: Record<string, string>,
	): Promise<boolean> {
		return this.sendEvent("analytics.web.pageview", {
			page_url: url,
			page_title: title,
			referrer,
			...utmParams,
		});
	}

	async trackPageExit(url: string, timeOnPage: number): Promise<boolean> {
		return this.sendEvent("analytics.web.page_exit", {
			page_url: url,
			time_on_page: timeOnPage,
		});
	}

	async trackVideoEvent(
		videoId: string,
		action: "play" | "pause" | "seek" | "progress" | "complete" | "error",
		position?: number,
		duration?: number,
		extra?: Record<string, unknown>,
	): Promise<boolean> {
		// Use specific event types for better partitioning and querying
		const eventType = `analytics.video.${action}`;

		return this.sendEvent(
			eventType,
			{
				video_id: videoId,
				position,
				duration,
				...extra,
			},
			`video/${videoId}`,
		);
	}

	async trackShare(url: string, channel: string): Promise<boolean> {
		return this.sendEvent("analytics.social.share", {
			url,
			channel,
		});
	}

	async trackReaction(
		videoId: string,
		reaction: string,
		action: "add" | "remove",
	): Promise<boolean> {
		return this.sendEvent(
			"analytics.engagement.reaction",
			{
				video_id: videoId,
				reaction,
				action,
			},
			`video/${videoId}`,
		);
	}

	async trackCustomEvent(
		eventType: string,
		data: Record<string, unknown>,
		subject?: string | undefined,
	): Promise<boolean> {
		return this.sendEvent(eventType, data, subject);
	}
}

export function getSessionId(request: Request): string {
	const cookies = request.headers.get("cookie") || "";
	const sessionMatch = cookies.match(/analytics_session=([^;]+)/);

	return sessionMatch?.[1] ?? "anonymous";
}

export function createAnalyticsHeaders(sessionId: string): Headers {
	const headers = new Headers();
	headers.append(
		"Set-Cookie",
		`analytics_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1800`,
	);
	return headers;
}
