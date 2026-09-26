import { env, runDurableObjectAlarm } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import type { Env } from "../src/env";
import { RoomDirectory } from "../src/server/rooms";
import { migrateTestDatabase } from "./setup-d1";

const bindings = env as unknown as Env;
const directory = new RoomDirectory(bindings);
const testHeaders = { "x-arcade-test-secret": "test-only-local-secret" };
const principal = (id: string, role: string) => ({
	"content-type": "application/json",
	"x-arcade-principal": JSON.stringify({ id, role }),
});

beforeAll(async () => {
	await migrateTestDatabase();
});

interface PendingWork {
	pendingFlushes: number;
	pendingAcks: number;
	pendingIntents: number;
	intents: number;
}

async function pending(stub: DurableObjectStub): Promise<PendingWork> {
	return (await stub.fetch("https://audience-shard.internal/_internal/testing/pending", {
		headers: testHeaders,
	})).json<PendingWork>();
}

async function drain(stub: DurableObjectStub): Promise<void> {
	for (let attempt = 0; attempt < 10; attempt += 1) {
		const work = await pending(stub);
		if (
			work.pendingFlushes === 0 &&
			work.pendingAcks === 0 &&
			work.pendingIntents === 0 &&
			work.intents === 0
		) {
			return;
		}
		await runDurableObjectAlarm(stub);
	}
	throw new Error(`audience shard did not drain: ${JSON.stringify(await pending(stub))}`);
}

describe("4,000-person local Durable Object correctness", () => {
	it("counts every vote once across 32 shards in bounded batches", async () => {
		const record = await directory.create("null-pointer", `4,000 local ${crypto.randomUUID()}`);
		const room = directory.stub(record.id);
		await room.fetch("https://game-room.internal/_internal/init", {
			method: "POST",
			body: JSON.stringify({ roomId: record.id, gameKey: "null-pointer" }),
		});
		const hostHeaders = principal("capacity-host", "host");
		const started = await room.fetch("https://game-room.internal/_internal/command", {
			method: "POST",
			headers: hostHeaders,
			body: JSON.stringify({
				v: 1,
				id: "start",
				type: "room.start",
				expectedVersion: 0,
				payload: {},
				sentAt: new Date().toISOString(),
			}),
		});
		expect(started.status).toBe(200);

		const shards = Array.from({ length: 32 }, (_, shardIndex) => ({
			id: String(shardIndex),
			stub: bindings.AUDIENCE_SHARD.get(
				bindings.AUDIENCE_SHARD.idFromName(`${record.id}:audience:${shardIndex}`),
			),
		}));
		const votes = shards.flatMap(({ id: shardId, stub }) =>
			Array.from({ length: 125 }, (_, localIndex) => {
				const globalIndex = Number(shardId) * 125 + localIndex;
				return {
					shardId,
					stub,
					principalId: `viewer-${globalIndex}`,
					commandId: `vote-${globalIndex}`,
					choice: globalIndex % 2 === 0 ? "Java" : "Elixir",
				};
			}),
		);

		const responses = await Promise.all(
			votes.map((vote) =>
				vote.stub.fetch("https://audience-shard.internal/_internal/submit", {
					method: "POST",
					headers: principal(vote.principalId, "audience"),
					body: JSON.stringify({
						roomId: record.id,
						shardId: vote.shardId,
						promptId: "null-0",
						choice: vote.choice,
						commandId: vote.commandId,
					}),
				}),
			),
		);
		expect(responses.every((response) => response.status === 202)).toBe(true);

		// Exercise both command-ID replay and one-ballot-per-identity dedupe while
		// the original intents may still be pending admission.
		const duplicates = await Promise.all(
			shards.map(async ({ id: shardId, stub }, shardIndex) => {
				const original = votes[shardIndex * 125]!;
				const replay = await stub.fetch("https://audience-shard.internal/_internal/submit", {
						method: "POST",
						headers: principal(original.principalId, "audience"),
						body: JSON.stringify({ roomId: record.id, shardId, promptId: "null-0", choice: original.choice, commandId: original.commandId }),
					});
				const fresh = await stub.fetch("https://audience-shard.internal/_internal/submit", {
						method: "POST",
						headers: principal(original.principalId, "audience"),
						body: JSON.stringify({ roomId: record.id, shardId, promptId: "null-0", choice: "Go", commandId: `fresh-duplicate-${shardId}` }),
					});
				return { replay, fresh };
			}),
		);
		expect(duplicates.every(({ replay }) => replay.status === 202)).toBe(true);
		expect(duplicates.every(({ fresh }) => fresh.status === 409)).toBe(true);
		for (const { fresh } of duplicates) {
			expect(await fresh.json()).toMatchObject({ error: { code: "ALREADY_VOTED" } });
		}

		await Promise.all(shards.map(({ stub }) => drain(stub)));
		const snapshot = await (await room.fetch("https://game-room.internal/_internal/state", {
			headers: principal("capacity-host", "host"),
		})).json<{
			state: {
				audience: { totals: Record<string, number> };
				private: { audienceCanonicalDistribution: Record<string, number> };
			};
		}>();
		expect(snapshot.state.audience.totals).toEqual({ Java: 2_000, Elixir: 2_000 });
		expect(snapshot.state.private.audienceCanonicalDistribution).toEqual({ Java: 2_000, Elixir: 2_000 });

		const committedIds: string[] = [];
		for (const { stub } of shards) {
			const log = await (await stub.fetch("https://audience-shard.internal/_internal/testing/events", {
				headers: testHeaders,
			})).json<{ events: Array<{ event?: string; payload?: { commandIds?: string[] } }> }>();
			for (const event of log.events.filter((candidate) => candidate.event === "audience.aggregated")) {
				const commandIds = event.payload?.commandIds ?? [];
				expect(commandIds.length).toBeLessThanOrEqual(100);
				committedIds.push(...commandIds);
			}
		}
		expect(committedIds).toHaveLength(4_000);
		expect(new Set(committedIds).size).toBe(4_000);

		const frozen = await room.fetch("https://game-room.internal/_internal/command", {
			method: "POST",
			headers: hostHeaders,
			body: JSON.stringify({
				v: 1,
				id: "freeze",
				type: "audience.freeze",
				expectedVersion: 1,
				payload: {},
				sentAt: new Date().toISOString(),
			}),
		});
		expect(frozen.status).toBe(200);
		const coordinatorLate = await room.fetch("https://game-room.internal/_internal/audience-submit-batch", {
			method: "POST",
			headers: principal("capacity-shard", "producer"),
			body: JSON.stringify({
				shardId: "capacity-late",
				promptId: "null-0",
				submissions: [{ commandId: "coordinator-late", choice: "Java" }],
			}),
		});
		expect(coordinatorLate.status).toBe(202);
		expect(await coordinatorLate.json()).toEqual({
			results: [{ commandId: "coordinator-late", accepted: false, code: "DISTRIBUTION_FROZEN" }],
		});
		const late = await Promise.all(
			shards.map(({ id: shardId, stub }) =>
				stub.fetch("https://audience-shard.internal/_internal/submit", {
					method: "POST",
					headers: principal(`late-${shardId}`, "audience"),
					body: JSON.stringify({ roomId: record.id, shardId, promptId: "null-0", choice: "Java", commandId: `late-${shardId}` }),
				}),
			),
		);
		expect(late.every((response) => response.status === 202)).toBe(true);
		await Promise.all(shards.map(({ stub }) => drain(stub)));

		const afterFreeze = await (await room.fetch("https://game-room.internal/_internal/state", {
			headers: principal("capacity-host", "host"),
		})).json<{ state: { audience: { totals: Record<string, number> }; private: { audienceCanonicalDistribution: Record<string, number> } } }>();
		expect(afterFreeze.state.audience.totals).toEqual({ Java: 2_000, Elixir: 2_000 });
		expect(afterFreeze.state.private.audienceCanonicalDistribution).toEqual({ Java: 2_000, Elixir: 2_000 });
	}, 60_000);
});
