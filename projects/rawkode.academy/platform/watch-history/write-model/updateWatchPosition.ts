import {
	WorkflowEntrypoint,
	WorkflowStep,
	type WorkflowEvent,
} from "cloudflare:workers";
import { CloudEvent } from "cloudevents";
import { drizzle } from "drizzle-orm/d1";
import { watchHistoryTable } from "../data-model/schema";

type Env = {
	DB: D1Database;
	ANALYTICS: Fetcher;
};

type Params = {
	userId: string;
	videoId: string;
	positionSeconds: number;
};

export class UpdateWatchPositionWorkflow extends WorkflowEntrypoint<
	Env,
	Params
> {
	async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
		const { userId, videoId, positionSeconds } = event.payload;

		// Upsert the watch position to D1
		await step.do("upsertWatchPosition", async () => {
			const db = drizzle(this.env.DB);
			const now = new Date();

			await db
				.insert(watchHistoryTable)
				.values({
					userId,
					videoId,
					positionSeconds,
					updatedAt: now,
				})
				.onConflictDoUpdate({
					target: [watchHistoryTable.userId, watchHistoryTable.videoId],
					set: {
						positionSeconds,
						updatedAt: now,
					},
				});

			return { success: true };
		});

		// Track analytics event to Grafana
		await step.do("trackAnalytics", async () => {
			if (!this.env.ANALYTICS) {
				console.warn("Analytics service not configured");
				return { success: false };
			}

			const cloudEvent = new CloudEvent({
				specversion: "1.0",
				type: "watch_position.updated",
				source: "platform-watch-history-write-model",
				id: crypto.randomUUID(),
				time: new Date().toISOString(),
				datacontenttype: "application/json",
				data: {
					user_id: userId,
					video_id: videoId,
					position_seconds: positionSeconds,
				},
			});

			try {
				await this.env.ANALYTICS.fetch("https://analytics.internal/track", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						event: cloudEvent,
						attributes: ["user_id", "video_id", "position_seconds"],
					}),
				});
				return { success: true };
			} catch (err) {
				console.error("Failed to track analytics event", err);
				return { success: false };
			}
		});
	}
}
