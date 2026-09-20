import { describe, expect, test } from "vitest";
import { newGameState } from "../src/domain/engine";
import { applyCommand, games, redactRuntime } from "../src/domain/registry";
import type { CommandEnvelope, Principal } from "../src/domain/protocol";

const host: Principal = { id: "host", role: "host" };
const team: Principal = { id: "player", role: "player", teamId: "team-red" };
const command = (type: string, expectedVersion: number, payload: unknown = {}): CommandEnvelope => ({ v: 1, id: `${type}-${expectedVersion}`, type, expectedVersion, payload, sentAt: "2026-01-01T00:00:00.000Z" });

describe("production reducer registry", () => {
	test.each(Object.keys(games))("initializes and starts %s through its reducer", (gameKey) => {
		const initial = newGameState(`room-${gameKey}`, gameKey);
		const result = applyCommand(initial, command("room.start", 0), host, 0);
		expect(result.state.private.runtime?.gameKey).toBe(gameKey);
		expect(result.state.status).toBe("live");
		expect(result.state.activePrompt?.prompt).toBeTruthy();
		expect(result.state.round.total).toBeGreaterThan(0);
		expect(result.state.round.index).toBe(0);
		expect(redactRuntime(result.state, "audience")).toBeDefined();
	});

	test("maps existing answer.submit envelopes into game commands", () => {
		let state = applyCommand(newGameState("spin", "spinlock"), command("room.start", 0), host, 0).state;
		state = applyCommand(state, command("answer.submit", 1, { answer: "eventual consistency" }), team, 1).state;
		expect(state.teams["team-red"].score).toBe(500);

		state = applyCommand(newGameState("principal", "principal-engineer"), command("room.start", 0), host, 0).state;
		state = applyCommand(state, command("answer.submit", 1, { choiceId: "2" }), team, 1).state;
		expect(state.teams["team-red"].score).toBe(100);
	});

	test("projects reducer round progress through host advance", () => {
		let state = applyCommand(newGameState("merge-progress", "merge-conflict"), command("room.start", 0), host, 0).state;
		expect(state.round).toMatchObject({ index: 0, total: 2, id: "merge-0", phase: "round" });
		state = applyCommand(state, command("phase.advance", 1), host, 1).state;
		expect(state.round).toMatchObject({ index: 1, total: 2, id: "merge-1", phase: "round" });
	});

	test("settles a completed Ten Nines list before advancing to the next prompt", () => {
		let state = applyCommand(newGameState("nines-progress", "ten-nines"), command("room.start", 0), host, 0).state;
		for (const [index, answer] of ["200", "201", "204", "301", "400", "401", "403", "404", "429", "500"].entries()) state = applyCommand(state, command("answer.submit", index + 1, { answer }), team, index + 1).state;
		expect(state.status).toBe("live");
		expect(state.phase).toBe("reveal");
		expect(state.round).toMatchObject({ index: 0, total: 2, id: "nines-0" });
		expect(state.teams["team-red"].score).toBe(1000);
		state = applyCommand(state, command("phase.advance", 11), host, 11).state;
		expect(state.status).toBe("live");
		expect(state.round).toMatchObject({ index: 1, total: 2, id: "nines-1", phase: "round" });
		expect(() => applyCommand(state, command("answer.submit", 12, { answer: "404" }), team, 12)).toThrow("BAD_COMMAND");
		state = applyCommand(state, command("answer.submit", 12, { answer: "branch" }), team, 12).state;
		expect(state.teams["team-red"].score).toBe(1100);
	});

	test("maps the existing buzzer envelope into Race Condition", () => {
		let state = applyCommand(newGameState("race", "race-condition"), command("room.start", 0), host, 0).state;
		state = applyCommand(state, command("buzzer.press", 1), team, 7).state;
		const privateRuntime = state.private.runtime?.state as { buzzed?: { teamId: string; at: number } };
		expect(privateRuntime.buzzed).toEqual({ teamId: "team-red", at: 7 });
	});

	test("settles a Race Condition question after its first answer", () => {
		let state = applyCommand(newGameState("race-settled", "race-condition"), command("room.start", 0), host, 0).state;
		state = applyCommand(state, command("buzzer.press", 1), team, 1).state;
		state = applyCommand(state, command("answer.submit", 2, { answer: "queue" }), team, 2).state;
		expect(state.teams["team-red"].score).toBe(200);
		expect((state.private.runtime?.state as { settled?: boolean }).settled).toBe(true);
		expect(() => applyCommand(state, command("buzzer.press", 3), team, 3)).toThrow("CONFLICT");
		expect(() => applyCommand(state, command("answer.submit", 3, { answer: "queue" }), team, 3)).toThrow("BAD_COMMAND");
	});

	test("does not score Principal Engineer answers after a host reveal", () => {
		let state = applyCommand(newGameState("principal-revealed", "principal-engineer"), command("room.start", 0), host, 0).state;
		state = applyCommand(state, command("prompt.reveal", 1), host, 1).state;
		expect(state.revealedAnswer).toBe("PUT");
		expect(() => applyCommand(state, command("answer.submit", 2, { choiceId: "2" }), team, 2)).toThrow("BAD_COMMAND");
		expect(state.teams["team-red"]?.score ?? 0).toBe(0);
	});

	test("keeps one public 50:50 pair when two real teams activate it", () => {
		let state = applyCommand(newGameState("principal-shared-fifty", "principal-engineer"), command("room.start", 0), host, 0).state;
		state = applyCommand(state, command("principal.lifeline", 1, { lifeline: "fifty-fifty" }), { id: "red-player", role: "player", teamId: "team-red" }, 1).state;
		const firstPair = state.activePrompt?.choices?.map((item) => item.id).sort();
		state = applyCommand(state, command("principal.lifeline", 2, { lifeline: "fifty-fifty" }), { id: "blue-player", role: "player", teamId: "team-blue" }, 2).state;
		expect(state.activePrompt?.choices?.map((item) => item.id).sort()).toEqual(firstPair);
		expect(firstPair).toHaveLength(2);
		expect((state.private.runtime?.state as { lifelines: Record<string, string[]> }).lifelines).toMatchObject({ "team-red": ["fifty-fifty"], "team-blue": ["fifty-fifty"] });
	});

	test("preserves a host score correction across reducer projection and completion", () => {
		let state = applyCommand(newGameState("corrected-spin", "spinlock"), command("room.start", 0), host, 0).state;
		state = applyCommand(state, command("answer.submit", 1, { answer: "eventual consistency" }), team, 1).state;
		expect(state.teams["team-red"].score).toBe(500);
		state = applyCommand(state, command("score.correct", 2), host, 2).state;
		expect(state.teams["team-red"].score).toBe(600);
		state = applyCommand(state, command("score.add", 3, { teamId: "team-red", points: 50 }), host, 3).state;
		expect(state.teams["team-red"].score).toBe(650);
		state = applyCommand(state, command("prompt.reveal", 4), host, 4).state;
		expect(state.teams["team-red"].score).toBe(650);
		state = applyCommand(state, command("room.complete", 5), host, 5).state;
		expect(state).toMatchObject({ status: "complete", teams: { "team-red": { score: 650 } } });
	});

	test("maps host console commands through their authoritative reducers", () => {
		let spinlock = applyCommand(
			newGameState("spin-console", "spinlock"),
			command("room.start", 0),
			host,
			0,
		).state;
		const maskedBoard = spinlock.spinlock?.board;
		expect(maskedBoard).toContain("▢");
		expect(maskedBoard).not.toMatch(/[A-Z]/);
		spinlock = applyCommand(
			spinlock,
			command("spinlock.spin", 1, { teamId: "team-red" }),
			host,
			1,
		).state;
		spinlock = applyCommand(
			spinlock,
			command("spinlock.guess-letter", 2, { teamId: "team-red", letter: "e" }),
			host,
			2,
		).state;
		expect(
			(spinlock.private.runtime?.state as { activeValue: number; letters: string[] })
				.activeValue,
		).toBe(150);
		expect(
			(spinlock.private.runtime?.state as { letters: string[] }).letters,
		).toEqual(["E"]);
		expect(spinlock.spinlock?.board).toContain("E");
		expect(spinlock.spinlock?.board).toContain(" ");
		expect(spinlock.spinlock?.board).not.toBe(maskedBoard);
		expect(spinlock.spinlock?.board).not.toContain("EVENTUAL CONSISTENCY");

		let principal = applyCommand(
			newGameState("principal-console", "principal-engineer"),
			command("room.start", 0),
			host,
			0,
		).state;
		principal = applyCommand(
			principal,
			command("principal.lifeline", 1, {
				teamId: "team-red",
				lifeline: "fifty-fifty",
			}),
			host,
			1,
		).state;
		expect(principal.activePrompt?.choices).toHaveLength(2);
		expect(principal.activePrompt?.choices?.map((choice) => choice.id)).toContain("2");
		expect(principal.principalEngineer).toMatchObject({ fiftyFiftyUsed: true });
		expect(principal.principalEngineer?.eliminatedChoiceIds).toHaveLength(2);
		expect(principal.principalEngineer?.eliminatedChoiceIds).not.toContain("2");
		expect(() => applyCommand(principal, command("answer.submit", 2, { choiceId: principal.principalEngineer?.eliminatedChoiceIds[0] }), team, 2)).toThrow("BAD_COMMAND");
		principal = applyCommand(principal, command("principal.lifeline", 2, { teamId: "team-red", lifeline: "ask-audience" }), host, 2).state;
		principal = applyCommand(principal, command("audience.vote", 3, { choiceId: "2" }), { id: "audience-1", role: "audience" }, 3).state;
		expect(
			(principal.private.runtime?.state as { lifelines: Record<string, string[]> })
				.lifelines["team-red"],
		).toEqual(["fifty-fifty", "ask-audience"]);
		expect(principal.principalEngineer).toMatchObject({ askAudienceUsed: true, audienceAdvice: { "2": 1 } });
		principal = applyCommand(principal, command("phase.advance", 4), host, 4).state;
		expect(principal.activePrompt?.choices).toHaveLength(4);
		expect(principal.principalEngineer).toMatchObject({ fiftyFiftyUsed: true, askAudienceUsed: true, fiftyFiftyActive: false, askAudienceActive: false, eliminatedChoiceIds: [], audienceAdvice: {} });

		let race = applyCommand(
			newGameState("race-console", "race-condition"),
			command("room.start", 0),
			host,
			0,
		).state;
		race = applyCommand(
			race,
			command("race.chaser-answer", 1, { answer: "queue" }),
			host,
			1,
		).state;
		expect(
			(race.private.runtime?.state as { chaserPosition: number }).chaserPosition,
		).toBe(1);
	});

	test("hydrates and pins a published Merge Conflict revision", () => {
		const snapshot = {
			revisionId: "revision-custom", checksum: "checksum-custom", manifest: { title: "Custom Merge" },
			questions: [{ id: "question-custom", ordinal: 0, kind: "survey", prompt: "Name a compiler data structure.", options: undefined, answer: [{ answer: "syntax tree", aliases: ["AST"], points: 321 }] }],
		};
		const initial = newGameState("custom-merge", "merge-conflict");
		(initial.private as typeof initial.private & { contentSnapshot: typeof snapshot }).contentSnapshot = snapshot;
		let state = applyCommand(initial, command("room.start", 0), host, 0).state;
		expect(state.activePrompt?.prompt).toBe("Name a compiler data structure.");
		snapshot.questions[0]!.prompt = "Published after this room started";
		state = applyCommand(state, command("answer.submit", 1, { answer: "AST" }), team, 1).state;
		expect(state.teams["team-red"].score).toBe(321);
		expect(state.activePrompt?.prompt).toBe("Name a compiler data structure.");
	});

	test("uses frozen audience distribution for Null Pointer and resets it for the next round", () => {
		let state = applyCommand(newGameState("null-live", "null-pointer"), command("room.start", 0), host, 0).state;
		state.audience = { totals: { Java: 4, Elixir: 1 }, reactions: {}, frozen: true };
		state.audienceDistribution = { Java: 4, Elixir: 1 };
		state.private.audienceShards = { shard: { Java: 4, Elixir: 1 } };
		state.private.audienceCanonicalDistribution = { Java: 4, Elixir: 1 };
		state = applyCommand(state, command("answer.submit", 1, { answer: "Elixir" }), team, 1).state;
		state = applyCommand(state, command("prompt.reveal", 2), host, 2).state;
		expect(state.teams["team-red"].score).toBe(4);
		expect((state.private.runtime?.state as { revealedAnswers?: Array<{ answer: string; points: number }> }).revealedAnswers?.find((answer) => answer.answer === "Elixir")?.points).toBe(1);
		state = applyCommand(state, command("phase.advance", 3), host, 3).state;
		expect(state.audience.frozen).toBeUndefined();
		expect(state.audience.totals).toEqual({});
		expect(state.audienceDistribution).toEqual({});
		expect(state.private.audienceShards).toEqual({});
		expect(state.private.audienceCanonicalDistribution).toEqual({});

		let viaAdvance = applyCommand(newGameState("null-next", "null-pointer"), command("room.start", 0), host, 0).state;
		expect(() => applyCommand(viaAdvance, command("phase.advance", 1), host, 1)).toThrow("BAD_COMMAND");
		viaAdvance.audience = { totals: { Java: 1, Elixir: 5 }, reactions: {}, frozen: true };
		viaAdvance.audienceDistribution = { Java: 1, Elixir: 5 };
		viaAdvance.private.audienceCanonicalDistribution = { Java: 1, Elixir: 5 };
		viaAdvance = applyCommand(viaAdvance, command("answer.submit", 1, { answer: "Java" }), team, 1).state;
		viaAdvance = applyCommand(viaAdvance, command("phase.advance", 2), host, 2).state;
		expect(viaAdvance.teams["team-red"].score).toBe(5);
		expect((viaAdvance.private.runtime?.state as { revealedAnswers?: Array<{ answer: string; points: number }> }).revealedAnswers?.find((answer) => answer.answer === "Java")?.points).toBe(1);
	});

	test("does not revive a paused or completed reducer with fresh commands", () => {
		let state = applyCommand(newGameState("terminal-spin", "spinlock"), command("room.start", 0), host, 0).state;
		state = applyCommand(state, command("room.pause", 1), host, 1).state;
		expect(() => applyCommand(state, command("answer.submit", 2, { answer: "eventual consistency" }), team, 2)).toThrow("BAD_COMMAND");
		state = applyCommand(state, command("room.complete", 2), host, 2).state;
		expect(() => applyCommand(state, command("spinlock.spin", 3, { teamId: "team-red" }), host, 3)).toThrow("BAD_COMMAND");
	});
});
