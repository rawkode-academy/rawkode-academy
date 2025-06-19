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
}

export class Analytics {
	private env: AnalyticsEnv & { CF_PAGES_BRANCH?: string };
	private sessionId: string;
	private userId: string | undefined;
	private source = "https://rawkode.academy";
	private projectId = "rawkode-academy";
	private environment: string;

	constructor(
		env: AnalyticsEnv & { CF_PAGES_BRANCH?: string },
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
			type: `com.rawkode.${type}`,
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
			console.warn("Analytics service binding not configured");
			return false;
		}

		try {
			const event = this.createCloudEvent(type, data, subject);
			const response = await this.env.ANALYTICS.fetch(
				"https://internal/events",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(event),
				},
			);
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
			console.warn("Analytics service binding not configured");
			return false;
		}

		try {
			const cloudEvents = events.map(({ type, data, subject }) =>
				this.createCloudEvent(type, data, subject),
			);

			const response = await this.env.ANALYTICS.fetch(
				"https://internal/events/batch",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ events: cloudEvents }),
				},
			);
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
		return this.sendEvent("pageview", {
			page_url: url,
			page_title: title,
			referrer,
			...utmParams,
		});
	}

	async trackPageExit(url: string, timeOnPage: number): Promise<boolean> {
		return this.sendEvent("page_exit", {
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
		return this.sendEvent(
			"video",
			{
				video_id: videoId,
				action,
				position,
				duration,
				...extra,
			},
			`video/${videoId}`,
		);
	}

	async trackShare(url: string, channel: string): Promise<boolean> {
		return this.sendEvent("share", {
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
			"reaction",
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

	return sessionMatch?.[1] ?? crypto.randomUUID();
}

export function createAnalyticsHeaders(sessionId: string): Headers {
	const headers = new Headers();
	headers.set(
		"Set-Cookie",
		`analytics_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1800`,
	);
	return headers;
}
