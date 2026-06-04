import type { DestinationPlatform, LiveDestination, LiveEvent } from "./types";

type FetchLike = typeof fetch;

export type CloudflareStreamConfig = {
	accountId: string;
	apiToken: string;
	fetch?: FetchLike;
};

export type CloudflareLiveInput = {
	uid: string;
	rtmps?: {
		url?: string;
		streamKey?: string;
	};
	srt?: {
		url?: string;
		streamId?: string;
		passphrase?: string;
	};
	webRTC?: {
		url?: string;
	};
	recording?: {
		mode?: string;
	};
};

export type CloudflareOutput = {
	uid: string;
	url?: string;
	streamKey?: string;
	enabled?: boolean;
};

export class CloudflareStreamClient {
	private readonly fetcher: FetchLike;

	constructor(private readonly config: CloudflareStreamConfig) {
		this.fetcher = config.fetch ?? fetch;
	}

	async createLiveInput(event: LiveEvent): Promise<CloudflareLiveInput> {
		const response = await this.request<CloudflareLiveInput>("/stream/live_inputs", {
			method: "POST",
			body: JSON.stringify({
				meta: {
					name: event.title,
					eventId: event.id,
					showId: event.showId,
				},
				recording: {
					mode: "automatic",
					requireSignedURLs: false,
					timeoutSeconds: 10,
				},
				preferLowLatency: true,
			}),
		});

		return response;
	}

	async createOutput(
		liveInputId: string,
		destination: LiveDestination,
		streamKey: string,
	): Promise<CloudflareOutput> {
		if (!destination.rtmpUrl) {
			throw new Error(`${destination.label} RTMP URL is not configured`);
		}

		return await this.request<CloudflareOutput>(
			`/stream/live_inputs/${encodeURIComponent(liveInputId)}/outputs`,
			{
				method: "POST",
				body: JSON.stringify({
					url: destination.rtmpUrl,
					streamKey,
					enabled: destination.enabled,
				}),
			},
		);
	}

	async updateOutput(
		liveInputId: string,
		outputUid: string,
		enabled: boolean,
	): Promise<CloudflareOutput> {
		return await this.request<CloudflareOutput>(
			`/stream/live_inputs/${encodeURIComponent(liveInputId)}/outputs/${encodeURIComponent(outputUid)}`,
			{
				method: "PUT",
				body: JSON.stringify({ enabled }),
			},
		);
	}

	private async request<T>(path: string, init: RequestInit): Promise<T> {
		const headers = new Headers(init.headers);
		headers.set("Authorization", `Bearer ${this.config.apiToken}`);
		headers.set("Content-Type", "application/json");

		const response = await this.fetcher(
			`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(this.config.accountId)}${path}`,
			{
				...init,
				headers,
			},
		);

		const payload = (await response.json().catch(() => null)) as {
			success?: boolean;
			result?: T;
			errors?: { message?: string }[];
		} | null;

		if (!response.ok || !payload?.success) {
			const message = payload?.errors?.map((error) => error.message).filter(Boolean).join("; ");
			throw new Error(message || `Cloudflare Stream request failed with ${response.status}`);
		}

		if (!payload.result) {
			throw new Error("Cloudflare Stream response did not include a result");
		}

		return payload.result;
	}
}

export function streamClientFromEnv(env: Env): CloudflareStreamClient | null {
	if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_STREAM_API_TOKEN) {
		return null;
	}

	return new CloudflareStreamClient({
		accountId: env.CLOUDFLARE_ACCOUNT_ID,
		apiToken: env.CLOUDFLARE_STREAM_API_TOKEN,
	});
}

export function destinationConfigFromEnv(platform: DestinationPlatform, env: Env): { url?: string; streamKey?: string } {
	switch (platform) {
		case "youtube":
			return { url: env.YOUTUBE_RTMP_URL, streamKey: env.YOUTUBE_STREAM_KEY };
		case "twitch":
			return { url: env.TWITCH_RTMP_URL, streamKey: env.TWITCH_STREAM_KEY };
		case "linkedin":
			return { url: env.LINKEDIN_RTMP_URL, streamKey: env.LINKEDIN_STREAM_KEY };
	}
}
