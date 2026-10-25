// Consumer for the "content-changes" queue. Every content write model sends
// one message per committed write ({ model, id, operation, version, tags,
// actor, at }, see packages/content-write); this purges the tags it names, so
// an edit reaches the website within a minute instead of at the next hourly
// change detection.
import type { ContentKV } from "./env";
import { invalidateTags, isValidTag, type PurgeTags } from "./invalidate";

/** The subset of a Workers MessageBatch the consumer uses. */
export interface ContentChangeBatch {
	readonly queue: string;
	readonly messages: readonly { readonly body: unknown }[];
	ackAll(): void;
	retryAll(options?: { delaySeconds?: number }): void;
}

export interface ContentChangeDeps {
	kv: ContentKV;
	purge: PurgeTags | undefined;
	settleMs?: number;
	wait?: (ms: number) => Promise<void>;
}

/** The tags a message asks to purge; malformed tags and bodies are dropped. */
export function tagsOf(body: unknown): string[] {
	const tags = (body as { tags?: unknown } | null)?.tags;
	if (!Array.isArray(tags)) return [];
	return tags.filter(isValidTag);
}

/**
 * Purges the union of a batch's tags with one generation bump. A failed purge
 * retries the whole batch (purging is idempotent); a batch with no usable
 * tags is acknowledged so it cannot block the queue.
 */
export async function consumeContentChanges(
	batch: ContentChangeBatch,
	deps: ContentChangeDeps,
): Promise<void> {
	const tags = new Set<string>();
	let malformed = 0;
	for (const message of batch.messages) {
		const found = tagsOf(message.body);
		if (found.length === 0) malformed++;
		for (const tag of found) tags.add(tag);
	}
	if (malformed > 0) {
		console.warn(
			JSON.stringify({
				event: "content.change-event.malformed",
				queue: batch.queue,
				count: malformed,
			}),
		);
	}
	if (tags.size === 0) {
		batch.ackAll();
		return;
	}
	const outcome = await invalidateTags([...tags], deps);
	if (outcome.ok) {
		console.log(
			JSON.stringify({
				event: "content.change-event.purged",
				messages: batch.messages.length,
				generation: outcome.generation,
				tags: outcome.purged.length,
			}),
		);
		batch.ackAll();
		return;
	}
	console.error(
		JSON.stringify({
			event: "content.change-event.purge-failed",
			messages: batch.messages.length,
			error: outcome.error,
		}),
	);
	batch.retryAll({ delaySeconds: 30 });
}
