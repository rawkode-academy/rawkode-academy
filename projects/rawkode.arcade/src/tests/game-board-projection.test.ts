import { describe, expect, test } from "bun:test";
import { normalizeRoomSnapshot } from "../composables/use-room-socket";
import { newGameState, type GameState } from "../domain/engine";
import { applyCommand } from "../domain/registry";
import type { CommandEnvelope, Principal } from "../domain/protocol";
import type { GameId } from "../lib/game-catalogue";
import type { PublicRoomState } from "../lib/live-contract";

const host: Principal = { id: "host", role: "host" };
const player: Principal = { id: "player", role: "player", teamId: "team-red" };
let sequence = 0;

function command(
	state: GameState,
	type: string,
	principal: Principal,
	payload: Record<string, unknown> = {},
): GameState {
	const envelope: CommandEnvelope = {
		v: 1,
		id: `board-${sequence++}`,
		type,
		expectedVersion: state.version,
		payload,
		sentAt: "2026-01-01T00:00:00.000Z",
	};
	return applyCommand(state, envelope, principal, sequence).state;
}

function fallback(game: GameId): PublicRoomState {
	return {
		roomId: "board-room",
		roomCode: "BOARD",
		game,
		version: 0,
		phase: "lobby",
		questionNumber: 0,
		questionTotal: 0,
		teams: [],
		leaderboard: [],
		audienceCount: 0,
		audienceResponseCount: 0,
		audienceFrozen: false,
		connection: "connected",
		serverNow: "2026-01-01T00:00:00.000Z",
	};
}

function room(game: GameId, state: GameState): PublicRoomState {
	return normalizeRoomSnapshot(
		{
			v: 1,
			type: "snapshot",
			version: state.version,
			state,
			serverTime: "2026-01-01T00:00:00.000Z",
		},
		fallback(game),
	);
}

describe("game board browser projection", () => {
	test("maps every actual reducer board after a real room start", () => {
		const cases: readonly GameId[] = [
			"merge-conflict",
			"spinlock",
			"principal-engineer",
			"race-condition",
			"ten-nines",
		];
		for (const game of cases) {
			const state = command(newGameState(`room-${game}`, game), "room.start", host);
			expect(room(game, state).gameBoard, game).toBeDefined();
		}
	});

	test("only maps real merge reveals and never its unrevealed answer labels", () => {
		let state = command(newGameState("room-merge", "merge-conflict"), "room.start", host);
		const opening = room("merge-conflict", state).gameBoard?.mergeConflict;
		expect(opening?.entries.every((entry) => !entry.revealed && entry.label === undefined)).toBe(true);

		state = command(state, "answer.submit", player, { answer: "It works on my machine" });
		const revealed = room("merge-conflict", state).gameBoard?.mergeConflict;
		expect(revealed?.entries[0]).toEqual({
			rank: 1,
			revealed: true,
			label: "It works on my machine",
		});
	});

	test("maps real mechanics: masked Spinlock, race position, and found relay", () => {
		let spinlock = command(newGameState("room-spin", "spinlock"), "room.start", host);
		spinlock = command(spinlock, "spinlock.spin", host, { teamId: "team-red" });
		spinlock = command(spinlock, "spinlock.guess-letter", host, { teamId: "team-red", letter: "e" });
		const spinBoard = room("spinlock", spinlock).gameBoard?.spinlock;
		expect(spinBoard?.board).toContain("E");
		expect(spinBoard?.board).not.toContain("EVENTUAL CONSISTENCY");

		let race = command(newGameState("room-race", "race-condition"), "room.start", host);
		race = command(race, "buzzer.press", player);
		race = command(race, "answer.submit", player, { answer: "queue" });
		expect(room("race-condition", race).gameBoard?.raceCondition).toMatchObject({
			playerPosition: 2,
			chaserPosition: 0,
			total: 5,
		});

		let nines = command(newGameState("room-nines", "ten-nines"), "room.start", host);
		nines = command(nines, "answer.submit", player, { answer: "200" });
		expect(room("ten-nines", nines).gameBoard?.tenNines).toEqual({
			found: ["200"],
			total: 10,
		});
	});

	test("maps Null Pointer only after the real frozen reveal", () => {
		let state = command(newGameState("room-null", "null-pointer"), "room.start", host);
		expect(room("null-pointer", state).gameBoard?.nullPointer).toBeUndefined();
		state = command(state, "audience.freeze", host);
		state = command(state, "prompt.reveal", host);
		const distribution = room("null-pointer", state).gameBoard?.nullPointer?.distribution;
		expect(distribution).toBeDefined();
		expect(distribution?.some((entry) => entry.label === "Java")).toBe(true);
	});
});
