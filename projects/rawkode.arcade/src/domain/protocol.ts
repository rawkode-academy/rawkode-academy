/** Wire protocol v1. Messages are deliberately small: game modules own command payloads. */
export const PROTOCOL_VERSION = 1 as const;

export type Role = "host" | "producer" | "player" | "audience" | "moderator" | "display";

export interface Principal {
	id: string;
	role: Role;
	teamId?: string;
	displayName?: string;
}

export interface CommandEnvelope<T = unknown> {
	v: typeof PROTOCOL_VERSION;
	id: string;
	type: string;
	expectedVersion: number;
	payload: T;
	sentAt: string;
}

interface SnapshotMessage {
	v: typeof PROTOCOL_VERSION;
	type: "snapshot";
	version: number;
	state: unknown;
	serverTime: string;
	/** Monotonic delivery order for snapshots whose game version is unchanged. */
	deliverySequence?: number;
}

export interface EventMessage {
	v: typeof PROTOCOL_VERSION;
	type: "event";
	version: number;
	event: string;
	payload: unknown;
	/** Present on the direct acknowledgement for a committed command. */
	commandId?: string;
	/** Monotonic delivery order for non-gameplay projection events. */
	deliverySequence?: number;
}

interface ErrorMessage {
	v: typeof PROTOCOL_VERSION;
	type: "error";
	code: "BAD_COMMAND" | "CONFLICT" | "FORBIDDEN" | "DUPLICATE" | "RATE_LIMITED" | "DEADLINE_EXPIRED";
	message: string;
	commandId?: string;
}

export type ServerMessage = SnapshotMessage | EventMessage | ErrorMessage | { v: typeof PROTOCOL_VERSION; type: "pong" };
