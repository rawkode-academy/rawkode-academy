import { z } from "zod";
import { isTransient, ServiceError } from "./domain.ts";
import { pacificDay } from "./store.ts";
import { applyPlan, type Deps } from "./sync.ts";

// Writes to YouTube run through a queue, one message per video. The queue
// retries a failed message with exponential backoff, and `max_retries` in
// wrangler.jsonc then moves it to the dead-letter queue. A quota 403 isn't a
// failure: the message is re-sent with a delay that runs past the Pacific
// midnight reset, so the batch carries on by itself the next day.
export const QUEUE = "platform-youtube-sync";
export const DEAD_LETTER_QUEUE = "platform-youtube-sync-dlq";
// Cloudflare Queues delay a message by at most 12 hours.
export const MAX_DELAY_SECONDS = 43200;
// A message that has waited out this many resets without being written is stuck on something else.
export const MAX_DEFERRALS = 8;

export const syncMessage = z.object({ planId: z.string().min(1), youtubeId: z.string().min(1), deferrals: z.number().int().min(0).optional() });
export type SyncMessage = z.infer<typeof syncMessage>;

// 30s, 1m, 2m, 4m ... capped at 15m.
export const backoffSeconds = (attempts: number) => Math.min(30 * 2 ** Math.max(0, attempts - 1), 900);

// Seconds until YouTube's quota resets (midnight Pacific), plus a minute of margin.
export function secondsUntilReset(now: Date) {
  const day = pacificDay(now);
  let low = now.getTime();
  let high = low + 26 * 3600 * 1000;
  while (high - low > 1000) {
    const middle = Math.floor((low + high) / 2);
    if (pacificDay(new Date(middle)) === day) low = middle; else high = middle;
  }
  return Math.ceil((high - now.getTime()) / 1000) + 60;
}

type Verdict = { action: "ack"; detail: string } | { action: "defer" } | { action: "retry"; detail: string } | { action: "dead"; reason: string };

// What to do with one video's message. Throws only for errors worth retrying.
export async function process(deps: Deps, body: SyncMessage): Promise<Verdict> {
  const result = await applyPlan(deps, body.planId, { limit: 1, videos: [body.youtubeId] }, body.youtubeId);
  const outcome = result.outcomes[0];
  if (!outcome) return result.stopped ? { action: "defer" } : { action: "ack", detail: "nothing to write: not a change in that plan" };
  switch (outcome.result) {
    case "applied": case "stale": case "missing": return { action: "ack", detail: outcome.result };
    case "quota": return { action: "defer" };
    default: return outcome.retryable ? { action: "retry", detail: outcome.detail ?? "write failed" } : { action: "dead", reason: outcome.detail ?? "write failed and retrying won't help" };
  }
}

export type QueueMessage = { body: unknown; attempts: number; ack(): void; retry(options?: { delaySeconds?: number }): void };
const log = (event: Record<string, unknown>) => console.error(JSON.stringify({ operation: "queue", ...event }));

export async function consume(messages: QueueMessage[], deps: Deps, send: (body: SyncMessage, delaySeconds: number) => Promise<void>) {
  for (const message of messages) {
    const parsed = syncMessage.safeParse(message.body);
    if (!parsed.success) { await deps.store.recordDead({ planId: null, youtubeId: null, at: deps.now().toISOString(), reason: "malformed message" }); message.ack(); continue; }
    const body = parsed.data;
    try {
      const verdict = await process(deps, body);
      if (verdict.action === "defer") {
        const deferrals = (body.deferrals ?? 0) + 1;
        if (deferrals > MAX_DEFERRALS) { await bury(deps, body, `still refused after ${MAX_DEFERRALS} quota resets`); message.ack(); continue; }
        await send({ ...body, deferrals }, Math.min(secondsUntilReset(deps.now()), MAX_DELAY_SECONDS));
        message.ack();
      } else if (verdict.action === "dead") { await bury(deps, body, verdict.reason); message.ack(); }
      else if (verdict.action === "retry") { log({ youtubeId: body.youtubeId, retry: verdict.detail, attempts: message.attempts }); message.retry({ delaySeconds: backoffSeconds(message.attempts) }); }
      else message.ack();
    } catch (error) {
      // Not worth retrying: record it for a person rather than burn the attempts.
      if (error instanceof ServiceError && !isTransient(error) && error.code !== "reauthorization_required") { await bury(deps, body, error.code); message.ack(); continue; }
      log({ youtubeId: body.youtubeId, error: error instanceof ServiceError ? error.code : "unknown", attempts: message.attempts });
      message.retry({ delaySeconds: backoffSeconds(message.attempts) });
    }
  }
}

async function bury(deps: Deps, body: SyncMessage, reason: string) {
  log({ youtubeId: body.youtubeId, planId: body.planId, dead: reason });
  await deps.store.recordDead({ planId: body.planId, youtubeId: body.youtubeId, at: deps.now().toISOString(), reason });
}

// The dead-letter queue's messages: every one is a video that needs a person.
export async function consumeDead(messages: QueueMessage[], deps: Deps) {
  for (const message of messages) {
    const parsed = syncMessage.safeParse(message.body);
    await bury(deps, parsed.success ? parsed.data : { planId: "", youtubeId: "" }, "retries used up");
    message.ack();
  }
}
