import { expect, test } from "bun:test";
import { MAX_TEAMS_PER_ROOM } from "./contestant-limits";
import { applyCoreCommand, newGameState } from "./engine";

test("the host cannot create more than the six configured contestant teams", () => {
	const host = { id: "host", role: "host" as const };
	let state = newGameState("team-limit", "spinlock");
	for (let index = 0; index < MAX_TEAMS_PER_ROOM - 2; index += 1) state = applyCoreCommand(state, { v: 1, id: `team-${index}`, type: "team.upsert", expectedVersion: state.version, payload: { teamId: `team-${index}` }, sentAt: "2026-01-01T00:00:00.000Z" }, host).state;
	expect(Object.keys(state.teams)).toHaveLength(MAX_TEAMS_PER_ROOM);
	expect(() => applyCoreCommand(state, { v: 1, id: "overflow", type: "team.upsert", expectedVersion: state.version, payload: { teamId: "overflow" }, sentAt: "2026-01-01T00:00:00.000Z" }, host)).toThrow("BAD_COMMAND");
});
