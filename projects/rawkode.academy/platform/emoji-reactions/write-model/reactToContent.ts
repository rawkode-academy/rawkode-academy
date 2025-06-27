import { WorkflowEntrypoint, WorkflowStep, type WorkflowEvent } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { emojiReactionsTable } from "../data-model/schema";

type Env = {
	DB: D1Database;
};

type Params = {
	contentId: string;
	personId: string;
	emoji: string;
	contentTimestamp?: number;
};

export class ReactToContentWorkflow extends WorkflowEntrypoint<Env, Params> {
	async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
		await step.do('persistReactionToD1', async () => {
			const { contentId, personId, emoji, contentTimestamp } = event.payload;
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
	}
}
