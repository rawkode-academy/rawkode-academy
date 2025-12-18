import { WorkflowEntrypoint, WorkflowStep, type WorkflowEvent } from 'cloudflare:workers';
import { CloudEvent } from "cloudevents";
import { drizzle } from 'drizzle-orm/d1';
import { emojiReactionsTable } from "../data-model/schema";

type Env = {
	DB: D1Database;
	ANALYTICS: Fetcher;
};

type Params = {
	contentId: string;
	personId: string;
	emoji: string;
	contentTimestamp?: number;
};

export class ReactToContentWorkflow extends WorkflowEntrypoint<Env, Params> {
	async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
		const { contentId, personId, emoji, contentTimestamp } = event.payload;

		// Persist the reaction to D1
		await step.do('persistReactionToD1', async () => {
			const db = drizzle(this.env.DB);

			await db
				.insert(emojiReactionsTable)
				.values({
					contentId,
					personId,
					emoji,
					reactedAt: new Date(),
					contentTimestamp: contentTimestamp ?? 0,
				});

			return { success: true };
		});

		// Track analytics event to Grafana
		await step.do('trackAnalytics', async () => {
			if (!this.env.ANALYTICS) {
				console.warn("Analytics service not configured");
				return { success: false };
			}

			const cloudEvent = new CloudEvent({
				specversion: "1.0",
				type: "reaction.added",
				source: "/emoji-reactions",
				id: crypto.randomUUID(),
				time: new Date().toISOString(),
				datacontenttype: "application/json",
				data: {
					content_id: contentId,
					user_id: personId,
					emoji,
					content_timestamp: contentTimestamp ?? 0,
				},
			});

			try {
				await this.env.ANALYTICS.fetch("https://analytics.internal/track", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						event: cloudEvent,
						attributes: ["content_id", "user_id", "emoji"],
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
