// Shared types for content write models. Everything here crosses Worker RPC,
// so values are plain data: no class instances besides Date.

/** Who made a change. Agents authenticate with API tokens, people with sessions. */
export interface Actor {
	id: string;
	kind: "user" | "agent";
	name?: string;
}

export type WriteErrorCode =
	| "validation"
	| "conflict"
	| "not_found"
	| "exists"
	| "unknown_model"
	| "invalid_request";

export interface WriteError {
	code: WriteErrorCode;
	message: string;
	/** Field-level problems for "validation". */
	issues?: { path: string; message: string }[];
	/** The current version, for "conflict". */
	currentVersion?: number;
}

/**
 * Results are returned, never thrown: an Error thrown across RPC keeps only its
 * message, and callers need the code to answer 400, 404 or 409.
 */
export type Result<T> = { ok: true; value: T } | { ok: false; error: WriteError };

export type Operation = "create" | "update" | "delete" | "restore" | "set";

/** Sent to the content-changes queue after every committed write. */
export interface ChangeEvent {
	/** The model that changed, e.g. "technology" or "video-guests". */
	model: string;
	/** The entity id, or the list's parent key. */
	id: string;
	operation: Operation;
	version: number;
	/** Website cache tags to purge, e.g. "videos:abc", "people:rawkode". */
	tags: string[];
	actor: Actor;
	/** Milliseconds since the epoch. */
	at: number;
}

export interface Revision {
	version: number;
	operation: Operation;
	actor: Actor;
	createdAt: Date;
	/** The row (or list) after the change; for a delete, the row before it. */
	snapshot: unknown;
}

export type Row = Record<string, unknown>;

export interface Versioned<T> {
	value: T;
	/** The latest revision number; 0 when the record predates the CMS. */
	version: number;
}

export interface ListPage {
	rows: Row[];
	total: number;
}

export interface ListQuery {
	limit?: number;
	offset?: number;
	search?: string;
	/** Column property to filter on, with an exact value (e.g. kind = "technology"). */
	where?: Record<string, string | number | boolean>;
}

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = (
	code: WriteErrorCode,
	message: string,
	extra: Omit<WriteError, "code" | "message"> = {},
): { ok: false; error: WriteError } => ({
	ok: false,
	error: { code, message, ...extra },
});
