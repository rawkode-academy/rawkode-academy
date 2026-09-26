import { env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { newGameState, type GameState } from "../src/domain/engine";
import { applyCommand } from "../src/domain/registry";
import type { CommandEnvelope, Principal } from "../src/protocol";
import { ContentRepository, ContentValidationError } from "../src/server/content";
import type { Env } from "../src/env";
import { ResultProjector } from "../src/server/results";
import { migrateTestDatabase } from "./setup-d1";

const bindings = env as unknown as Env;
const host: Principal = { id: "integrity-host", role: "host" };
const red: Principal = { id: "red-player", role: "player", teamId: "team-red" };
const blue: Principal = { id: "blue-player", role: "player", teamId: "team-blue" };

beforeAll(async () => {
	await migrateTestDatabase();
});

function command(type: string, expectedVersion: number, payload: unknown = {}): CommandEnvelope {
	return {
		v: 1,
		id: `${type}-${expectedVersion}-${crypto.randomUUID()}`,
		type,
		expectedVersion,
		payload,
		sentAt: new Date().toISOString(),
	};
}

async function operator() {
	const id = `integrity-operator-${crypto.randomUUID()}`;
	const now = new Date().toISOString();
	await bindings.DB.prepare(
		"INSERT INTO arcade_operators (id, identity_subject, display_name, role, active, created_at, updated_at) VALUES (?, ?, 'Integrity Operator', 'producer', 1, ?, ?)",
	)
		.bind(id, id, now, now)
		.run();
	return id;
}

describe("content confidentiality and game-specific validation", () => {
	it("requires an operator session before returning an answer-bearing revision", async () => {
		const actor = await operator();
		const repository = new ContentRepository(bindings);
		const pack = await repository.createPack(
			{
				gameKey: "merge-conflict",
				slug: `private-answers-${crypto.randomUUID()}`,
				title: "Private answers",
			},
			actor,
		);
		const revision = await repository.createRevision(
			pack.id,
			[
				{
					kind: "survey",
					prompt: "Name a secret answer",
					options: [{ answer: "Never expose this", points: 100 }],
					answer: [{ answer: "Never expose this", points: 100 }],
				},
			],
			actor,
			{
				gameContent: {
					title: "Private answers",
					rounds: [
						{
							prompt: "Name a secret answer",
							answers: [{ answer: "Never expose this", points: 100 }],
						},
					],
				},
			},
		);
		await repository.publishRevision(revision.id, actor);

		const response = await SELF.fetch(
			`https://example.test/api/content/revisions/${encodeURIComponent(revision.id)}`,
		);
		expect(response.status).toBe(403);
		expect(await response.text()).not.toContain("Never expose this");
	});

	it.each([
		{
			gameKey: "principal-engineer",
			question: { kind: "free-text", prompt: "Invalid principal question", answer: "one" },
		},
		{
			gameKey: "ten-nines",
			question: { kind: "free-text", prompt: "Invalid ten-item list", answer: "one" },
		},
	] as const)(
		"refuses to publish invalid $gameKey runtime content",
		async ({ gameKey, question }) => {
			const actor = await operator();
			const repository = new ContentRepository(bindings);
			const pack = await repository.createPack(
				{
					gameKey,
					slug: `invalid-${gameKey}-${crypto.randomUUID()}`,
					title: `Invalid ${gameKey}`,
				},
				actor,
			);

			try {
				const revision = await repository.createRevision(pack.id, [question], actor);
				await expect(repository.publishRevision(revision.id, actor)).rejects.toBeInstanceOf(
					ContentValidationError,
				);
			} catch (error) {
				expect(error).toBeInstanceOf(ContentValidationError);
			}
		},
	);
});

describe("result projection remains retryable", () => {
	it("recovers every score after a failure between completion and result writes", async () => {
		const roomId = `projection-retry-${crypto.randomUUID()}`;
		const now = new Date().toISOString();
		await bindings.DB.prepare(
			"INSERT INTO arcade_room_directory (id, game_key, title, status, created_at, updated_at) VALUES (?, 'spinlock', 'Projection retry', 'complete', ?, ?)",
		)
			.bind(roomId, now, now)
			.run();
		await bindings.DB.exec(
			"CREATE TRIGGER arcade_test_fail_result BEFORE INSERT ON arcade_results BEGIN SELECT RAISE(FAIL, 'injected result failure'); END",
		);
		const projector = new ResultProjector(bindings);
		try {
			await expect(
				projector.project(roomId, "spinlock", [
					{ principalId: "team-red", teamId: "team-red", score: 500 },
				]),
			).rejects.toThrow();
		} finally {
			await bindings.DB.exec("DROP TRIGGER IF EXISTS arcade_test_fail_result");
		}

		await projector.project(roomId, "spinlock", [
			{ principalId: "team-red", teamId: "team-red", score: 500 },
		]);
		const outcome = await bindings.DB.prepare(
			"SELECT (SELECT COUNT(*) FROM arcade_completed_games WHERE room_id = ?) AS completions, (SELECT COUNT(*) FROM arcade_results WHERE room_id = ?) AS results, (SELECT score FROM arcade_results WHERE room_id = ? AND principal_id = 'team-red') AS score",
		)
			.bind(roomId, roomId, roomId)
			.first<{ completions: number; results: number; score: number }>();
		expect(outcome).toEqual({ completions: 1, results: 1, score: 500 });
	});
});

describe("round-scoped authoritative gameplay", () => {
	it("settles a Spinlock round once even with fresh command IDs and another team", () => {
		let state = applyCommand(
			newGameState("spinlock-semantic-dedupe", "spinlock"),
			command("room.start", 0),
			host,
		).state;
		state = applyCommand(
			state,
			command("answer.submit", 1, { answer: "eventual consistency" }),
			red,
		).state;
		expect(state.teams["team-red"].score).toBe(500);
		expect(() =>
			applyCommand(state, command("answer.submit", 2, { answer: "eventual consistency" }), red),
		).toThrow("BAD_COMMAND");
		expect(() =>
			applyCommand(state, command("answer.submit", 2, { answer: "eventual consistency" }), blue),
		).toThrow("BAD_COMMAND");
		expect(state.teams["team-red"].score).toBe(500);
		expect(state.teams["team-blue"].score).toBe(0);
	});

	it("scores Null Pointer from frozen live rarity and resets every audience field next round", () => {
		let state = applyCommand(
			newGameState("null-live-rarity", "null-pointer"),
			command("room.start", 0),
			host,
		).state;
		state.audienceDistribution = { Java: 1, Elixir: 9 };
		state.private.audienceCanonicalDistribution = { Java: 1, Elixir: 9 };
		state.audience.totals = { Java: 1, Elixir: 9 };
		state.private.audienceShards = { "0": { Java: 1, Elixir: 9 } };
		state = applyCommand(state, command("audience.freeze", 1), host).state;
		state = applyCommand(state, command("answer.submit", 2, { answer: "Java" }), red).state;
		state = applyCommand(state, command("answer.submit", 3, { answer: "Elixir" }), blue).state;
		state = applyCommand(state, command("prompt.reveal", 4), host).state;
		expect(state.teams["team-red"].score).toBeGreaterThan(state.teams["team-blue"].score);

		state = applyCommand(state, command("phase.advance", 5), host).state;
		expect(state.activePrompt?.id).toBe("null-1");
		expect(state.audience.frozen).not.toBe(true);
		expect(state.audience.totals).toEqual({});
		expect(state.audienceDistribution).toEqual({});
		expect(state.private.audienceShards).toEqual({});
		const round = (
			state as GameState & {
				round?: { index: number; id?: string; phase: string };
			}
		).round;
		expect(round).toMatchObject({ index: 1, id: "null-1", phase: "round" });
	});
});
