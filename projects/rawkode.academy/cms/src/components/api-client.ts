// A small typed client for /api/v1. Same-origin requests carry the session
// cookie; errors come back as ApiError with the API's { error } shape parsed.
import type { FieldDescriptor } from "@rawkodeacademy/content-write";

export type Row = Record<string, unknown>;

export interface Issue {
	path: string;
	message: string;
}

export interface ApiErrorBody {
	code: string;
	message: string;
	issues?: Issue[];
	currentVersion?: number;
	references?: { label: string; rows: Row[] }[];
}

export class ApiError extends Error {
	readonly status: number;
	readonly code: string;
	readonly issues: Issue[];
	readonly currentVersion?: number;
	readonly references: { label: string; rows: Row[] }[];

	constructor(status: number, body: ApiErrorBody) {
		super(body.message);
		this.name = "ApiError";
		this.status = status;
		this.code = body.code;
		this.issues = body.issues ?? [];
		this.references = body.references ?? [];
		if (typeof body.currentVersion === "number") {
			this.currentVersion = body.currentVersion;
		}
	}

	get isConflict() {
		return this.status === 409 && this.code === "conflict";
	}
}

export interface ApiResponse<T> {
	status: number;
	data: T;
}

const BASE = "/api/v1";

async function parse(response: Response): Promise<unknown> {
	const text = await response.text();
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch {
		return { error: { code: "invalid_response", message: text.slice(0, 200) } };
	}
}

function errorFrom(status: number, body: unknown): ApiError {
	const error = (body as { error?: Partial<ApiErrorBody> } | null)?.error;
	return new ApiError(status, {
		...error,
		code: error?.code ?? "http_error",
		message: error?.message ?? `Request failed (${status})`,
	});
}

/** Calls the API; resolves with status and body for 2xx, throws ApiError otherwise. */
export async function api<T>(
	method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
	path: string,
	body?: unknown,
	init: { signal?: AbortSignal } = {},
): Promise<ApiResponse<T>> {
	let response: Response;
	try {
		response = await fetch(`${BASE}${path}`, {
			method,
			credentials: "same-origin",
			headers: {
				accept: "application/json",
				...(body !== undefined ? { "content-type": "application/json" } : {}),
			},
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
			...(init.signal ? { signal: init.signal } : {}),
		});
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError")
			throw error;
		throw new ApiError(0, {
			code: "network",
			message: "Could not reach the CMS. Check your connection.",
		});
	}
	const parsed = await parse(response);
	if (!response.ok) throw errorFrom(response.status, parsed);
	return { status: response.status, data: parsed as T };
}

export const get = <T>(path: string, init?: { signal?: AbortSignal }) =>
	api<T>("GET", path, undefined, init);

export interface UploadResult {
	key: string;
	url: string;
	contentType: string;
	bytes: number;
	width?: number;
	height?: number;
}

/** Uploads a file to the media bucket under the entity. */
export async function uploadMedia(
	file: File,
	collection: string,
	id: string,
): Promise<UploadResult> {
	const form = new FormData();
	form.set("file", file);
	form.set("collection", collection);
	form.set("id", id);
	const response = await fetch(`${BASE}/media`, {
		method: "POST",
		credentials: "same-origin",
		body: form,
	});
	const parsed = await parse(response);
	if (!response.ok) throw errorFrom(response.status, parsed);
	return parsed as UploadResult;
}

/** A message for any thrown value. */
export const messageOf = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

// ------------------------------------------------------------ API shapes

export type Access = "write" | "propose" | "deny";

export interface PanelSummary {
	kind: "list" | "attached";
	name: string;
	label: string;
	model: string;
	picks?: { field: string; collection: string };
	keyField?: string;
	fields: FieldDescriptor[];
}

export interface CollectionSummary {
	name: string;
	label: string;
	singular: string;
	titleField: string;
	key: string;
	hidden: string[];
	fields: FieldDescriptor[];
	panels: PanelSummary[];
	create: Access;
}

export interface Versioned<T> {
	value: T;
	version: number;
}

export interface EntityResponse extends Versioned<Row> {
	panels: Record<string, Versioned<Row[] | Row | null>>;
	websitePath: string | null;
}

export interface Revision {
	version: number;
	operation: string;
	actor: { id: string; kind: string; name?: string };
	createdAt: string | number;
	snapshot: unknown;
}

export interface Proposal {
	id: string;
	collection: string;
	entityId: string | null;
	kind: "create" | "update" | "list" | "attached";
	list: string | null;
	payload: Row;
	baseVersion: number;
	author: { id: string; kind: string; name?: string };
	status: "pending" | "approved" | "rejected";
	note: string | null;
	createdAt: number;
}

export interface ActivityEntry {
	actor_id: string;
	actor_name: string | null;
	collection: string;
	entity_id: string;
	operation: string;
	version: number | null;
	at: number;
}

export interface TokenRecord {
	id: string;
	name: string;
	role: string;
	createdBy: string;
	createdAt: number;
	lastUsedAt: number | null;
	revokedAt: number | null;
}

export interface AccessLink {
	user_id: string;
	kind: "person" | "technology";
	target_id: string;
	created_by: string;
	created_at: number;
}

let collectionsPromise: Promise<CollectionSummary[]> | undefined;

/** GET /collections, once per page load. */
export function loadCollections(): Promise<CollectionSummary[]> {
	collectionsPromise ??= get<{ collections: CollectionSummary[] }>(
		"/collections",
	)
		.then((r) => r.data.collections)
		.catch((error) => {
			collectionsPromise = undefined;
			throw error;
		});
	return collectionsPromise;
}

export async function loadCollection(name: string): Promise<CollectionSummary> {
	const found = (await loadCollections()).find((c) => c.name === name);
	if (!found) {
		throw new ApiError(404, {
			code: "not_found",
			message: `You cannot open "${name}"`,
		});
	}
	return found;
}
