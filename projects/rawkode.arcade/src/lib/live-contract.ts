import type { GameId } from "./game-catalogue";

/** Browser-safe projection; it never contains answer keys or producer notes. */
export type PublicChoice = { id: string; label: string; votes?: number };
export type PublicPrompt = {
	id: string;
	label: string;
	text: string;
	choices: readonly PublicChoice[];
	closesAt?: string;
};
export type TeamScore = {
	id: string;
	name: string;
	score: number;
	streak?: number;
};
export type LeaderboardEntry = {
	rank: number;
	name: string;
	score: number;
	delta?: number;
	avatar: string;
};
export type ConnectionState =
	| "connecting"
	| "connected"
	| "reconnecting"
	| "offline";
export type RoomPhase =
	| "lobby"
	| "round"
	| "question"
	| "reveal"
	| "intermission"
	| "complete";

export type PublicRoomState = {
	roomId: string;
	roomCode: string;
	game: GameId;
	version: number;
	phase: RoomPhase;
	questionNumber: number;
	questionTotal: number;
	prompt?: PublicPrompt;
	teams: readonly TeamScore[];
	leaderboard: readonly LeaderboardEntry[];
	audienceCount: number;
	/** Public aggregate; useful for host pacing without exposing an answer key. */
	audienceResponseCount: number;
	/** The authoritative server freeze flag, distinct from a live aggregate. */
	audienceFrozen: boolean;
	/** Safe Spinlock state; the phrase itself remains server-private until reveal. */
	spinlock?: {
		board: string;
		letters: readonly string[];
		activeValue: number;
		turn: number;
		solved?: boolean;
	};
	principalEngineer?: {
		fiftyFiftyUsed: boolean;
		askAudienceUsed: boolean;
		fiftyFiftyActive: boolean;
		askAudienceActive: boolean;
		eliminatedChoiceIds: readonly string[];
		audienceAdvice: Readonly<Record<string, number>>;
	};
	connection: ConnectionState;
	serverNow: string;
	buzzerWinner?: string;
	revealedAnswer?: string;
	audienceDistribution?: Readonly<Record<string, number>>;
};

/** Canonical Durable Object protocol v1 envelope. */
export type CommandEnvelope<T = Record<string, unknown>> = {
	v: 1;
	id: string;
	type: string;
	expectedVersion: number;
	payload: T;
	sentAt: string;
};
export type SnapshotEnvelope = {
	v: 1;
	type: "snapshot";
	version: number;
	/** Durable public-state fanout order, independent of gameplay version. */
	deliverySequence?: number;
	state: unknown;
	serverTime: string;
};
export type EventEnvelope = {
	v: 1;
	type: "event";
	version: number;
	event: string;
	payload: unknown;
	commandId?: string;
};
export type ErrorEnvelope = {
	v: 1;
	type: "error";
	code: string;
	message: string;
	commandId?: string;
};
export type ServerEnvelope =
	| SnapshotEnvelope
	| EventEnvelope
	| ErrorEnvelope
	| { v: 1; type: "pong" };

export type RoomSocketPort = {
	connect(input: {
		roomId: string;
		ticket?: string;
		socketUrl?: string;
		onMessage: (message: ServerEnvelope) => void;
		onConnection: (state: ConnectionState) => void;
	}): () => void;
	send(envelope: CommandEnvelope): void;
};
