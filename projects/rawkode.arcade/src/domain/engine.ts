import type { CommandEnvelope, Principal, Role } from "./protocol";
import { MAX_TEAMS_PER_ROOM } from "./contestant-limits";

export type RoomStatus = "lobby" | "live" | "paused" | "complete";

export interface TeamState {
	id: string;
	name: string;
	score: number;
	memberIds: string[];
}

export interface BuzzerState {
	principalId: string;
	at: string;
}

export type PublicGameBoard =
	| { kind: "merge-conflict"; entries: Array<{ rank: number; label?: string; revealed: boolean }>; total: number }
	| { kind: "spinlock"; board: string; letters: string[]; activeValue: number; solved: boolean }
	| { kind: "principal-engineer"; index: number; total: number }
	| { kind: "race-condition"; teamPositions: Record<string, number>; playerPosition: number; chaserPosition: number; total: number }
	| { kind: "ten-nines"; found: string[]; total: number }
	| { kind: "null-pointer"; distribution: Array<{ label: string; count: number }> };

export interface GameState {
	roomId: string;
	gameKey: string;
	contentRevision?: { id: string; checksum: string };
	version: number;
	status: RoomStatus;
	phase: string;
	round: { index: number; total: number; id?: string; phase: string };
	audienceCount: number;
	teams: Record<string, TeamState>;
	players: Record<string, { displayName: string; teamId?: string }>;
	activePrompt?: { id: string; prompt: string; choices?: Array<{ id: string; label: string }>; closesAt?: string };
	buzzer?: BuzzerState;
	buzzerWinner?: string;
	spinlock?: { board: string; letters: string[]; activeValue: number; turn: number; solved?: boolean };
	gameBoard?: PublicGameBoard;
	principalEngineer?: { fiftyFiftyUsed: boolean; askAudienceUsed: boolean; fiftyFiftyActive: boolean; askAudienceActive: boolean; eliminatedChoiceIds: string[]; audienceAdvice: Record<string, number> };
	revealedAnswer?: string;
	audience: { totals: Record<string, number>; reactions: Record<string, number>; frozen?: boolean; lastFlushedAt?: string };
	audienceDistribution: Record<string, number>;
	private: {
		answer?: string;
		notes?: string;
		e2ePrivateMarker?: string;
		audienceShards?: Record<string, Record<string, number>>;
		audienceCanonicalShards?: Record<string, Record<string, number>>;
		audienceCanonicalDistribution?: Record<string, number>;
		audienceReactionShards?: Record<string, Record<string, number>>;
		runtime?: { gameKey: string; state: unknown };
		contentSnapshot?: { revisionId: string; checksum: string; manifest: Record<string, unknown>; questions: Array<{ id: string; ordinal: number; kind: string; prompt: string; options: unknown; answer: unknown }> };
		audiencePresenceShards?: Record<string, { count: number; sequence: number }>;
		audienceFreeze?: { promptId?: string; admissionVersion: number };
	};
}

export interface EngineResult {
	state: GameState;
	event: string;
	payload: unknown;
}

export function newGameState(roomId: string, gameKey: string): GameState {
	return {
		roomId, gameKey, version: 0, status: "lobby", phase: "setup", round: { index: 0, total: 0, phase: "setup" }, audienceCount: 0, teams: {
			"team-red": { id: "team-red", name: "Team Red", score: 0, memberIds: [] },
			"team-blue": { id: "team-blue", name: "Team Blue", score: 0, memberIds: [] },
		}, players: {},
		audience: { totals: {}, reactions: {} }, audienceDistribution: {}, private: {},
	};
}

function requireRole(principal: Principal, allowed: Role[]): void {
	if (!allowed.includes(principal.role)) throw new Error("FORBIDDEN");
}

/** Generic commands are shared by every show. Game-specific commands are handled by registered modules. */
export function applyCoreCommand(state: GameState, command: CommandEnvelope, principal: Principal, now = Date.now()): EngineResult {
	const next = structuredClone(state);
	switch (command.type) {
		case "room.start":
			requireRole(principal, ["host", "producer"]);
			next.status = "live";
			next.phase = "round";
			next.round.phase = "round";
			break;
		case "room.pause":
			requireRole(principal, ["host", "producer"]);
			next.status = "paused";
			next.round.phase = "paused";
			break;
		case "room.resume":
			requireRole(principal, ["host", "producer"]);
			next.status = "live";
			next.round.phase = "round";
			break;
		case "room.complete":
			requireRole(principal, ["host", "producer"]);
			next.status = "complete";
			next.phase = "complete";
			next.round.phase = "complete";
			break;
		case "prompt.open": {
			requireRole(principal, ["host", "producer"]);
			const payload = command.payload as { id: string; prompt: string; choices?: Array<{ id: string; label: string }>; answer?: string; e2ePrivateMarker?: string; closesAt?: string };
			next.activePrompt = { id: payload.id, prompt: payload.prompt, choices: payload.choices, closesAt: payload.closesAt };
			next.round = {
				index: next.round.index + 1,
				total: Math.max(next.round.total, next.round.index + 2),
				id: payload.id,
				phase: "question",
			};
			next.private.answer = payload.answer;
			next.private.e2ePrivateMarker = payload.e2ePrivateMarker;
			next.buzzer = undefined;
			next.audience = { totals: {}, reactions: {} };
			next.audienceDistribution = {};
			next.private.audienceShards = {};
			next.private.audienceCanonicalShards = {};
			next.private.audienceCanonicalDistribution = {};
			next.private.audienceFreeze = undefined;
			break;
		}
		case "score.add": {
			requireRole(principal, ["host", "producer"]);
			const payload = command.payload as { teamId: string; points: number };
			const team = next.teams[payload.teamId];
			if (!team || !Number.isSafeInteger(payload.points)) throw new Error("BAD_COMMAND");
			team.score += payload.points;
			break;
		}
		case "team.upsert": {
			requireRole(principal, ["host", "producer"]);
			const payload = command.payload as { teamId: string; name?: string };
			if (!payload.teamId) throw new Error("BAD_COMMAND");
			if (!next.teams[payload.teamId] && Object.keys(next.teams).length >= MAX_TEAMS_PER_ROOM) throw new Error("BAD_COMMAND");
			next.teams[payload.teamId] ??= { id: payload.teamId, name: payload.name ?? payload.teamId, score: 0, memberIds: [] };
			break;
		}
		case "audience.freeze":
			requireRole(principal, ["host", "producer"]);
			next.audience.frozen = true;
			next.private.audienceFreeze = { promptId: next.activePrompt?.id, admissionVersion: state.version };
			break;
		case "prompt.reveal":
		case "phase.advance":
			requireRole(principal, ["host", "producer"]);
			next.phase = "reveal";
			next.round.phase = "reveal";
			next.revealedAnswer = next.private.answer;
			break;
		case "score.correct": {
			requireRole(principal, ["host", "producer"]);
			const team = next.teams[(command.payload as { teamId?: string }).teamId ?? "team-red"];
			if (!team) throw new Error("BAD_COMMAND");
			team.score += 100;
			break;
		}
		case "answer.submit": {
			if (principal.role !== "player" && principal.role !== "audience") throw new Error("FORBIDDEN");
			if (next.activePrompt?.closesAt && now > Date.parse(next.activePrompt.closesAt)) throw new Error("DEADLINE_EXPIRED");
			const teamId = principal.teamId ?? (command.payload as { teamId?: string }).teamId;
			if (!teamId || !next.teams[teamId]) throw new Error("BAD_COMMAND");
			const payload = command.payload as { points?: number; answer?: string; choice?: string };
			const submitted = String(payload.answer ?? payload.choice ?? "").trim().toLowerCase();
			const points = next.gameKey === "null-pointer" && submitted
				? Math.max(1, Math.round(1_000 / (next.audienceDistribution[submitted] ?? next.audienceDistribution[Object.keys(next.audienceDistribution).find((answer) => answer.toLowerCase() === submitted) ?? ""] ?? 1)))
				: payload.points ?? 100;
			if (!Number.isSafeInteger(points) || points < 0) throw new Error("BAD_COMMAND");
			next.teams[teamId].score += points;
			break;
		}
		default:
			throw new Error("UNKNOWN_COMMAND");
	}
	next.version += 1;
	return { state: next, event: command.type, payload: command.payload };
}
