import { describe, expect, test } from "vitest";
import { newGameState, type GameState } from "../src/domain/engine";
import { applyCommand } from "../src/domain/registry";
import type { CommandEnvelope, Principal } from "../src/domain/protocol";

const host: Principal = { id: "host", role: "host" };
const contestants: Principal[] = [
	{ id: "red-player", role: "player", teamId: "team-red" },
	{ id: "blue-player", role: "player", teamId: "team-blue" },
	{ id: "green-player", role: "player", teamId: "team-green" },
	{ id: "yellow-player", role: "player", teamId: "team-yellow" },
];

function command(state: GameState, type: string, payload: unknown = {}): CommandEnvelope {
	return { v: 1, id: `${state.roomId}-${state.version}-${type}`, type, expectedVersion: state.version, payload, sentAt: "2026-01-01T00:00:00.000Z" };
}

function send(state: GameState, principal: Principal, type: string, payload: unknown = {}): GameState {
	return applyCommand(state, command(state, type, payload), principal, state.version).state;
}

/** Provisions four named contestant teams; no test sends an audience command. */
function fourPersonRoom(gameKey: string): GameState {
	let state = newGameState(`four-person-${gameKey}`, gameKey);
	state = send(state, host, "team.upsert", { teamId: "team-green", name: "Green Threads" });
	state = send(state, host, "team.upsert", { teamId: "team-yellow", name: "Yellow Subroutines" });
	expect(Object.keys(state.teams)).toHaveLength(4);
	return send(state, host, "room.start");
}

function expectCompletedWithoutAudience(state: GameState) {
	expect(state.status).toBe("complete");
	expect(state.audience.totals).toEqual({});
	expect(state.audience.reactions).toEqual({});
}

describe("four-contestant rooms without an audience", () => {
	test("plays Merge Conflict through both boards", () => {
		let state = fourPersonRoom("merge-conflict");
		for (const [team, answer] of [[contestants[0], "works on my machine"], [contestants[1], "check the logs"], [contestants[2], "rollback"], [contestants[3], "dns"]] as const) state = send(state, team, "answer.submit", { answer });
		state = send(state, host, "prompt.reveal");
		state = send(state, host, "phase.advance");
		for (const [team, answer] of [[contestants[0], "environment variables"], [contestants[1], "wifi"], [contestants[2], "migration"], [contestants[3], "screen sharing"]] as const) state = send(state, team, "answer.submit", { answer });
		state = send(state, host, "prompt.reveal");
		state = send(state, host, "phase.advance");
		expectCompletedWithoutAudience(state);
	});

	test("plays Spinlock through two solved rounds", () => {
		let state = fourPersonRoom("spinlock");
		state = send(state, contestants[0], "spinlock.spin", { teamId: contestants[0].teamId });
		state = send(state, contestants[1], "spinlock.guess-letter", { teamId: contestants[1].teamId, letter: "e" });
		state = send(state, contestants[2], "spinlock.guess-letter", { teamId: contestants[2].teamId, letter: "c" });
		state = send(state, contestants[3], "answer.submit", { answer: "eventual consistency" });
		state = send(state, host, "prompt.reveal");
		state = send(state, host, "phase.advance");
		state = send(state, contestants[0], "answer.submit", { answer: "rubber duck debugging" });
		state = send(state, host, "prompt.reveal");
		state = send(state, host, "phase.advance");
		expectCompletedWithoutAudience(state);
	});

	test("plays Principal Engineer through its two revealed questions", () => {
		let state = fourPersonRoom("principal-engineer");
		for (const [team, choiceId] of [[contestants[0], "2"], [contestants[1], "1"], [contestants[2], "0"], [contestants[3], "3"]] as const) state = send(state, team, "answer.submit", { choiceId });
		state = send(state, host, "prompt.reveal");
		state = send(state, host, "phase.advance");
		for (const [team, choiceId] of [[contestants[0], "1"], [contestants[1], "0"], [contestants[2], "2"], [contestants[3], "3"]] as const) state = send(state, team, "answer.submit", { choiceId });
		state = send(state, host, "prompt.reveal");
		state = send(state, host, "phase.advance");
		expectCompletedWithoutAudience(state);
	});

	test("plays Race Condition through all three settled prompts", () => {
		let state = fourPersonRoom("race-condition");
		for (const [team, answer] of [[contestants[0], "queue"], [contestants[1], "dns"], [contestants[2], "git switch -c"]] as const) {
			state = send(state, team, "buzzer.press");
			state = send(state, team, "answer.submit", { answer });
			state = send(state, host, "phase.advance");
		}
		expectCompletedWithoutAudience(state);
	});

	test("plays Ten Nines through two complete lists", () => {
		let state = fourPersonRoom("ten-nines");
		for (const [index, answer] of ["200", "201", "204", "301", "400", "401", "403", "404", "429", "500"].entries()) state = send(state, contestants[index % contestants.length]!, "answer.submit", { answer });
		state = send(state, host, "phase.advance");
		for (const [index, answer] of ["commit", "branch", "tag", "remote", "stash", "merge", "rebase", "blame", "submodule", "worktree"].entries()) state = send(state, contestants[index % contestants.length]!, "answer.submit", { answer });
		expectCompletedWithoutAudience(state);
	});

	test("plays Null Pointer with an empty frozen audience distribution", () => {
		let state = fourPersonRoom("null-pointer");
		for (const [team, answer] of [[contestants[0], "Java"], [contestants[1], "JavaScript"], [contestants[2], "Python"], [contestants[3], "Elixir"]] as const) state = send(state, team, "answer.submit", { answer });
		state = send(state, host, "audience.freeze");
		state = send(state, host, "prompt.reveal");
		state = send(state, host, "phase.advance");
		for (const [team, answer] of [[contestants[0], "Kubernetes"], [contestants[1], "Kafka"], [contestants[2], "Kotlin"], [contestants[3], "Knative"]] as const) state = send(state, team, "answer.submit", { answer });
		state = send(state, host, "audience.freeze");
		state = send(state, host, "prompt.reveal");
		state = send(state, host, "phase.advance");
		expectCompletedWithoutAudience(state);
	});
});
