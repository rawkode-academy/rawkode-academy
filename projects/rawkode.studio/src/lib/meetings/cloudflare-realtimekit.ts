import type { Meeting, MeetingProvider } from "./types";

export class CloudflareRealTimeKitProvider implements MeetingProvider {
	private organizationId: string;
	private apiKey: string;
	private baseUrl = "https://api.cloudflare.com/client/v4";

	constructor(organizationId: string, apiKey: string) {
		this.organizationId = organizationId;
		this.apiKey = apiKey;
	}

	async createMeeting(name: string): Promise<Meeting> {
		// TODO: Implement RealTimeKit API call
		throw new Error("Not implemented");
	}
}
