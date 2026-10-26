// The CMS HTTP API (/api/v1/*). The admin UI and agents both use it; every
// write goes through a platform service's write model over a service binding.
// Framework-free so it can be tested with in-process stores.
import type {
	Actor,
	ModelDescriptor,
	Result,
	Row,
	WriteError,
} from "@rawkodeacademy/content-write";
import type { ContentWriteRpc } from "@rawkodeacademy/content-write/worker";
import {
	createApiToken,
	listApiTokens,
	type Principal,
	ROLES,
	type Role,
	randomToken,
	revokeApiToken,
	sameOriginWrite,
} from "./auth";
import {
	type AttachedPanel,
	type Binding,
	COLLECTIONS,
	type Collection,
	findCollection,
	findPanel,
	type ListPanel,
} from "./collections";
import {
	imageDimensions,
	sniffImageType,
	MAX_UPLOAD_BYTES,
	MEDIA_BASE_URL,
	mediaKey,
} from "./media";
import {
	type Access,
	accessFor,
	canRead,
	isAdmin,
	type Scope,
} from "./permissions";

export interface ApiEnv {
	DB: D1Database;
	services: Partial<Record<Binding, ContentWriteRpc>>;
	MEDIA?: R2Bucket;
	mediaBaseUrl?: string;
	now?: () => number;
}

export interface ApiRequest {
	request: Request;
	/** Path after /api/v1, e.g. "/collections/technologies". */
	path: string;
	principal: Principal | null;
	origin: string;
}

const json = (status: number, body: unknown, headers: HeadersInit = {}) =>
	new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json",
			"cache-control": "no-store",
			...headers,
		},
	});

const STATUS: Record<WriteError["code"], number> = {
	validation: 422,
	conflict: 409,
	exists: 409,
	not_found: 404,
	unknown_model: 500,
	invalid_request: 400,
};

const failure = (error: WriteError) =>
	json(STATUS[error.code] ?? 400, { error });
const problem = (status: number, code: string, message: string) =>
	json(status, { error: { code, message } });

class HttpError extends Error {
	constructor(readonly response: Response) {
		super("http");
	}
}

async function body<T = Record<string, unknown>>(request: Request): Promise<T> {
	try {
		const value = await request.json();
		if (typeof value !== "object" || value === null || Array.isArray(value))
			throw new Error();
		return value as T;
	} catch {
		throw new HttpError(
			problem(400, "invalid_request", "Send a JSON object body"),
		);
	}
}

function unwrap<T>(result: Result<T>): T {
	if (!result.ok) throw new HttpError(failure(result.error));
	return result.value;
}

function service(env: ApiEnv, binding: Binding): ContentWriteRpc {
	const found = env.services[binding];
	if (!found) {
		throw new HttpError(problem(503, "unavailable", `${binding} is not bound`));
	}
	return found;
}

function collectionOr404(name: string): Collection {
	const found = findCollection(name);
	if (!found)
		throw new HttpError(problem(404, "not_found", `No collection "${name}"`));
	return found;
}

async function scopeOf(
	env: ApiEnv,
	principal: Principal | null,
): Promise<Scope> {
	if (!principal || principal.via !== "session" || isAdmin(principal)) {
		return { people: [], technologies: [] };
	}
	const { results } = await env.DB.prepare(
		"SELECT kind, target_id FROM access_links WHERE user_id = ?",
	)
		.bind(principal.actor.id)
		.all<{ kind: string; target_id: string }>();
	return {
		people: results.filter((r) => r.kind === "person").map((r) => r.target_id),
		technologies: results
			.filter((r) => r.kind === "technology")
			.map((r) => r.target_id),
	};
}

/** Admins and agents read everything; guests and partners only their linked rows. */
function readAccess(
	principal: Principal | null,
	scope: Scope,
	collection: string,
	id?: string,
): boolean {
	if (!canRead(principal)) return false;
	if (isAdmin(principal) || principal?.roles.includes("content_agent"))
		return true;
	if (!id) return false;
	return (
		(collection === "people" && scope.people.includes(id)) ||
		(collection === "technologies" && scope.technologies.includes(id))
	);
}

const now = (env: ApiEnv) => (env.now ?? Date.now)();

async function logActivity(
	env: ApiEnv,
	actor: Actor,
	collection: string,
	entityId: string,
	operation: string,
	version: number | undefined,
) {
	await env.DB.prepare(
		"INSERT INTO activity (actor_id, actor_name, collection, entity_id, operation, version, at) VALUES (?, ?, ?, ?, ?, ?, ?)",
	)
		.bind(
			actor.id,
			actor.name ?? null,
			collection,
			entityId,
			operation,
			version ?? null,
			now(env),
		)
		.run();
}

// ------------------------------------------------------------ describe

const describeCache = new Map<Binding, ModelDescriptor[]>();

async function describe(
	env: ApiEnv,
	binding: Binding,
): Promise<ModelDescriptor[]> {
	const cached = describeCache.get(binding);
	if (cached) return cached;
	const described = await service(env, binding).describe();
	describeCache.set(binding, described);
	return described;
}

export function resetDescribeCacheForTests() {
	describeCache.clear();
}

async function fieldsOf(env: ApiEnv, binding: Binding, model: string) {
	const found = (await describe(env, binding)).find((m) => m.name === model);
	return found?.fields ?? [];
}

async function collectionSummary(
	env: ApiEnv,
	c: Collection,
	principal: Principal | null,
) {
	const panels = await Promise.all(
		c.panels.map(async (p) => ({
			kind: p.kind,
			name: p.name,
			label: p.label,
			model: p.model,
			...(p.kind === "list" && p.picks ? { picks: p.picks } : {}),
			...(p.kind === "attached" ? { keyField: p.keyField } : {}),
			fields: (await fieldsOf(env, p.binding, p.model)).filter(
				(f) => !(p.kind === "attached" && p.hidden?.includes(f.name)),
			),
		})),
	);
	const fields = await fieldsOf(env, c.binding, c.model);
	const entity = (await describe(env, c.binding)).find(
		(m) => m.name === c.model,
	);
	return {
		name: c.name,
		label: c.label,
		singular: c.singular,
		titleField: c.titleField,
		key: entity?.key ?? "id",
		hidden: c.hidden,
		fields,
		panels,
		create: accessFor(principal, c.name, undefined, {
			people: [],
			technologies: [],
		}),
	};
}

// ----------------------------------------------------------- proposals

interface Proposal {
	id: string;
	collection: string;
	entityId: string | null;
	kind: "create" | "update" | "list" | "attached";
	list: string | null;
	payload: Row;
	baseVersion: number;
	author: Actor;
	status: "pending" | "approved" | "rejected";
	note: string | null;
	createdAt: number;
	decidedBy: string | null;
	decidedAt: number | null;
}

const proposalFromRow = (r: Record<string, unknown>): Proposal => ({
	id: String(r.id),
	collection: String(r.collection),
	entityId: r.entity_id === null ? null : String(r.entity_id),
	kind: r.kind as Proposal["kind"],
	list: r.list === null ? null : String(r.list),
	payload: JSON.parse(String(r.payload)) as Row,
	baseVersion: Number(r.base_version),
	author: {
		id: String(r.author_id),
		kind: r.author_kind as Actor["kind"],
		...(r.author_name ? { name: String(r.author_name) } : {}),
	},
	status: r.status as Proposal["status"],
	note: r.note === null ? null : String(r.note),
	createdAt: Number(r.created_at),
	decidedBy: r.decided_by === null ? null : String(r.decided_by),
	decidedAt: r.decided_at === null ? null : Number(r.decided_at),
});

async function propose(
	env: ApiEnv,
	principal: Principal,
	input: Omit<
		Proposal,
		| "id"
		| "author"
		| "status"
		| "note"
		| "createdAt"
		| "decidedBy"
		| "decidedAt"
	>,
): Promise<Response> {
	const id = randomToken(12);
	await env.DB.prepare(
		"INSERT INTO proposals (id, collection, entity_id, kind, list, payload, base_version, author_id, author_kind, author_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
	)
		.bind(
			id,
			input.collection,
			input.entityId,
			input.kind,
			input.list,
			JSON.stringify(input.payload),
			input.baseVersion,
			principal.actor.id,
			principal.actor.kind,
			principal.actor.name ?? null,
			now(env),
		)
		.run();
	return json(202, { proposal: { id, status: "pending" } });
}

async function getProposal(env: ApiEnv, id: string): Promise<Proposal> {
	const row = await env.DB.prepare("SELECT * FROM proposals WHERE id = ?")
		.bind(id)
		.first<Record<string, unknown>>();
	if (!row) throw new HttpError(problem(404, "not_found", "No such proposal"));
	return proposalFromRow(row);
}

// --------------------------------------------------------------- writes

/** Writes an attached row (create when it does not exist yet). */
async function writeAttached(
	env: ApiEnv,
	panel: AttachedPanel,
	key: string,
	data: Row,
	ifVersion: number,
	actor: Actor,
) {
	const svc = service(env, panel.binding);
	const existing = await svc.get(panel.model, key);
	if (!existing.ok && existing.error.code === "not_found") {
		return svc.create(panel.model, { ...data, [panel.keyField]: key }, actor);
	}
	return svc.update(panel.model, key, data, { ifVersion }, actor);
}

async function applyProposal(
	env: ApiEnv,
	proposal: Proposal,
	approver: Principal,
	force: boolean,
): Promise<Result<{ version: number }>> {
	const c = collectionOr404(proposal.collection);
	const actor: Actor = {
		id: approver.actor.id,
		kind: approver.actor.kind,
		name: `${approver.actor.name ?? approver.actor.id} (proposed by ${proposal.author.name ?? proposal.author.id})`,
	};
	const svc = service(env, c.binding);
	if (proposal.kind === "create") {
		const r = await svc.create(c.model, proposal.payload.data as Row, actor);
		return r.ok ? { ok: true, value: { version: r.value.version } } : r;
	}
	const id = String(proposal.entityId);
	const current = await svc.get(c.model, id);
	if (!current.ok) return current;
	if (proposal.kind === "update") {
		const ifVersion = force ? current.value.version : proposal.baseVersion;
		const r = await svc.update(
			c.model,
			id,
			proposal.payload.patch as Row,
			{ ifVersion },
			actor,
		);
		return r.ok ? { ok: true, value: { version: r.value.version } } : r;
	}
	const panel = findPanel(c, String(proposal.list));
	if (!panel)
		return {
			ok: false,
			error: { code: "invalid_request", message: "Unknown panel" },
		};
	if (panel.kind === "list") {
		const parent = panel.parent(current.value.value);
		const psvc = service(env, panel.binding);
		let ifVersion = proposal.baseVersion;
		if (force) {
			const list = await psvc.getList(panel.model, parent);
			if (!list.ok) return list;
			ifVersion = list.value.version;
		}
		const r = await psvc.setList(
			panel.model,
			parent,
			proposal.payload.items as Row[],
			{ ifVersion },
			actor,
		);
		return r.ok ? { ok: true, value: { version: r.value.version } } : r;
	}
	const key = panel.key(current.value.value);
	let ifVersion = proposal.baseVersion;
	if (force) {
		const attached = await service(env, panel.binding).get(panel.model, key);
		ifVersion = attached.ok ? attached.value.version : 0;
	}
	const r = await writeAttached(
		env,
		panel,
		key,
		proposal.payload.data as Row,
		ifVersion,
		actor,
	);
	return r.ok ? { ok: true, value: { version: r.value.version } } : r;
}

// --------------------------------------------------------------- router

type Handler = (
	env: ApiEnv,
	req: ApiRequest,
	params: string[],
) => Promise<Response>;

const routes: [string, RegExp, Handler][] = [];
const route = (method: string, pattern: string, handler: Handler) => {
	const regex = new RegExp(`^${pattern.replace(/:[a-z]+/g, "([^/]+)")}/?$`);
	routes.push([method, regex, handler]);
};

function requirePrincipal(req: ApiRequest): Principal {
	if (!req.principal)
		throw new HttpError(
			problem(401, "unauthenticated", "Sign in or send an API token"),
		);
	return req.principal;
}

function requireAdmin(req: ApiRequest): Principal {
	const p = requirePrincipal(req);
	if (!isAdmin(p))
		throw new HttpError(problem(403, "forbidden", "Admins only"));
	return p;
}

function deny(access: Access) {
	if (access === "deny")
		throw new HttpError(problem(403, "forbidden", "Not allowed"));
}

route("GET", "/me", async (_env, req) => {
	const p = requirePrincipal(req);
	return json(200, { actor: p.actor, roles: p.roles, via: p.via });
});

route("GET", "/collections", async (env, req) => {
	const p = requirePrincipal(req);
	const scope = await scopeOf(env, p);
	const visible = COLLECTIONS.filter(
		(c) =>
			readAccess(p, scope, c.name) ||
			(c.name === "people" && scope.people.length > 0) ||
			(c.name === "technologies" && scope.technologies.length > 0),
	);
	return json(200, {
		collections: await Promise.all(
			visible.map((c) => collectionSummary(env, c, p)),
		),
		scope,
	});
});

route("GET", "/collections/:c", async (env, req, [name]) => {
	const p = requirePrincipal(req);
	const c = collectionOr404(String(name));
	const scope = await scopeOf(env, p);
	const url = new URL(req.request.url);
	const query = {
		search: url.searchParams.get("search") ?? undefined,
		limit: Number(url.searchParams.get("limit") ?? 50),
		offset: Number(url.searchParams.get("offset") ?? 0),
	};
	if (readAccess(p, scope, c.name)) {
		return json(
			200,
			unwrap(await service(env, c.binding).list(c.model, query)),
		);
	}
	// Guests and partners list only their linked rows.
	const ids =
		c.name === "people"
			? scope.people
			: c.name === "technologies"
				? scope.technologies
				: [];
	if (ids.length === 0)
		throw new HttpError(problem(403, "forbidden", "Not allowed"));
	const rows: Row[] = [];
	for (const id of ids) {
		const got = await service(env, c.binding).get(c.model, id);
		if (got.ok) rows.push(got.value.value);
	}
	return json(200, { rows, total: rows.length });
});

route("POST", "/collections/:c", async (env, req, [name]) => {
	const p = requirePrincipal(req);
	const c = collectionOr404(String(name));
	const { data } = await body<{ data?: Row }>(req.request);
	if (!data || typeof data !== "object") {
		return problem(400, "invalid_request", "Send { data: {...} }");
	}
	const access = accessFor(
		p,
		c.name,
		undefined,
		await scopeOf(env, p),
		Object.keys(data),
	);
	deny(access);
	if (access === "propose") {
		return propose(env, p, {
			collection: c.name,
			entityId: null,
			kind: "create",
			list: null,
			payload: { data },
			baseVersion: 0,
		});
	}
	const created = unwrap(
		await service(env, c.binding).create(c.model, data, p.actor),
	);
	const key =
		(await describe(env, c.binding)).find((m) => m.name === c.model)?.key ??
		"id";
	await logActivity(
		env,
		p.actor,
		c.name,
		String(created.value[key]),
		"create",
		created.version,
	);
	return json(201, created);
});

route("GET", "/collections/:c/:id", async (env, req, [name, rawId]) => {
	const p = requirePrincipal(req);
	const c = collectionOr404(String(name));
	const id = decodeURIComponent(String(rawId));
	if (!readAccess(p, await scopeOf(env, p), c.name, id)) {
		throw new HttpError(problem(403, "forbidden", "Not allowed"));
	}
	const entity = unwrap(await service(env, c.binding).get(c.model, id));
	const panels: Record<string, unknown> = {};
	for (const panel of c.panels) {
		const svc = service(env, panel.binding);
		if (panel.kind === "list") {
			panels[panel.name] = unwrap(
				await svc.getList(panel.model, panel.parent(entity.value)),
			);
		} else {
			const got = await svc.get(panel.model, panel.key(entity.value));
			panels[panel.name] = got.ok
				? got.value
				: got.error.code === "not_found"
					? { value: null, version: 0 }
					: unwrap(got);
		}
	}
	return json(200, {
		...entity,
		panels,
		websitePath: c.websitePath?.(entity.value) ?? null,
	});
});

route("PATCH", "/collections/:c/:id", async (env, req, [name, rawId]) => {
	const p = requirePrincipal(req);
	const c = collectionOr404(String(name));
	const id = decodeURIComponent(String(rawId));
	const { patch, ifVersion } = await body<{ patch?: Row; ifVersion?: number }>(
		req.request,
	);
	if (!patch || typeof ifVersion !== "number") {
		return problem(
			400,
			"invalid_request",
			"Send { patch: {...}, ifVersion: n }",
		);
	}
	const access = accessFor(
		p,
		c.name,
		id,
		await scopeOf(env, p),
		Object.keys(patch),
	);
	deny(access);
	if (access === "propose") {
		return propose(env, p, {
			collection: c.name,
			entityId: id,
			kind: "update",
			list: null,
			payload: { patch },
			baseVersion: ifVersion,
		});
	}
	const updated = unwrap(
		await service(env, c.binding).update(
			c.model,
			id,
			patch,
			{ ifVersion },
			p.actor,
		),
	);
	await logActivity(env, p.actor, c.name, id, "update", updated.version);
	return json(200, updated);
});

route("DELETE", "/collections/:c/:id", async (env, req, [name, rawId]) => {
	const p = requireAdmin(req);
	const c = collectionOr404(String(name));
	const id = decodeURIComponent(String(rawId));
	const ifVersion = Number(
		new URL(req.request.url).searchParams.get("ifVersion"),
	);
	if (!Number.isInteger(ifVersion)) {
		return problem(400, "invalid_request", "Pass ?ifVersion=n");
	}
	const blocking: { label: string; rows: Row[] }[] = [];
	for (const ref of c.references) {
		const rows = unwrap(
			await service(env, ref.binding).findReferences(ref.model, ref.column, id),
		);
		if (rows.length) blocking.push({ label: ref.label, rows });
	}
	if (blocking.length) {
		return json(409, {
			error: {
				code: "referenced",
				message: `Still referenced: ${blocking.map((b) => `${b.rows.length} ${b.label}`).join(", ")}`,
				references: blocking,
			},
		});
	}
	const entity = unwrap(await service(env, c.binding).get(c.model, id));
	const deleted = unwrap(
		await service(env, c.binding).delete(c.model, id, { ifVersion }, p.actor),
	);
	await logActivity(env, p.actor, c.name, id, "delete", deleted.version);
	// The entity's own panels (a video's guests and chapters, a person's links
	// and biography) go with it, each with its own revision so restore can
	// bring them back. Best effort: a failure is reported, not rolled back.
	const leftovers: string[] = [];
	for (const panel of c.panels) {
		const svc = service(env, panel.binding);
		if (panel.kind === "list") {
			const parent = panel.parent(entity.value);
			const list = await svc.getList(panel.model, parent);
			if (!list.ok) leftovers.push(panel.name);
			else if (list.value.value.length > 0) {
				const cleared = await svc.setList(
					panel.model,
					parent,
					[],
					{ ifVersion: list.value.version },
					p.actor,
				);
				if (!cleared.ok) leftovers.push(panel.name);
			}
		} else {
			const key = panel.key(entity.value);
			const attached = await svc.get(panel.model, key);
			if (attached.ok) {
				const removed = await svc.delete(
					panel.model,
					key,
					{ ifVersion: attached.value.version },
					p.actor,
				);
				if (!removed.ok) leftovers.push(panel.name);
			} else if (attached.error.code !== "not_found")
				leftovers.push(panel.name);
		}
	}
	return json(200, { ...deleted, ...(leftovers.length ? { leftovers } : {}) });
});

route(
	"GET",
	"/collections/:c/:id/revisions",
	async (env, req, [name, rawId]) => {
		const p = requirePrincipal(req);
		const c = collectionOr404(String(name));
		const id = decodeURIComponent(String(rawId));
		if (!readAccess(p, await scopeOf(env, p), c.name, id)) {
			throw new HttpError(problem(403, "forbidden", "Not allowed"));
		}
		return json(200, {
			revisions: unwrap(await service(env, c.binding).revisions(c.model, id)),
		});
	},
);

route(
	"POST",
	"/collections/:c/:id/restore",
	async (env, req, [name, rawId]) => {
		const p = requireAdmin(req);
		const c = collectionOr404(String(name));
		const id = decodeURIComponent(String(rawId));
		const { version } = await body<{ version?: number }>(req.request);
		if (typeof version !== "number")
			return problem(400, "invalid_request", "Send { version: n }");
		const restored = unwrap(
			await service(env, c.binding).restore(c.model, id, version, p.actor),
		);
		await logActivity(env, p.actor, c.name, id, "restore", restored.version);
		return json(200, restored);
	},
);

route(
	"PUT",
	"/collections/:c/:id/panels/:panel",
	async (env, req, [name, rawId, panelName]) => {
		const p = requirePrincipal(req);
		const c = collectionOr404(String(name));
		const id = decodeURIComponent(String(rawId));
		const panel = findPanel(c, String(panelName));
		if (!panel) return problem(404, "not_found", `No panel "${panelName}"`);
		const input = await body<{ items?: Row[]; data?: Row; ifVersion?: number }>(
			req.request,
		);
		if (typeof input.ifVersion !== "number") {
			return problem(400, "invalid_request", "Send ifVersion");
		}
		// Panels belong to the entity: whoever may change the entity may change them.
		const access = accessFor(p, c.name, id, await scopeOf(env, p));
		deny(access);
		const entity = unwrap(await service(env, c.binding).get(c.model, id));
		if (panel.kind === "list") {
			if (!Array.isArray(input.items))
				return problem(400, "invalid_request", "Send { items: [...] }");
			if (access === "propose") {
				return propose(env, p, {
					collection: c.name,
					entityId: id,
					kind: "list",
					list: panel.name,
					payload: { items: input.items },
					baseVersion: input.ifVersion,
				});
			}
			const saved = unwrap(
				await service(env, panel.binding).setList(
					panel.model,
					(panel as ListPanel).parent(entity.value),
					input.items,
					{ ifVersion: input.ifVersion },
					p.actor,
				),
			);
			await logActivity(
				env,
				p.actor,
				c.name,
				id,
				`set ${panel.name}`,
				saved.version,
			);
			return json(200, saved);
		}
		if (!input.data || typeof input.data !== "object") {
			return problem(400, "invalid_request", "Send { data: {...} }");
		}
		if (access === "propose") {
			return propose(env, p, {
				collection: c.name,
				entityId: id,
				kind: "attached",
				list: panel.name,
				payload: { data: input.data },
				baseVersion: input.ifVersion,
			});
		}
		const saved = unwrap(
			await writeAttached(
				env,
				panel,
				panel.key(entity.value),
				input.data,
				input.ifVersion,
				p.actor,
			),
		);
		await logActivity(
			env,
			p.actor,
			c.name,
			id,
			`save ${panel.name}`,
			saved.version,
		);
		return json(200, saved);
	},
);

// Proposals ------------------------------------------------------------

route("GET", "/proposals", async (env, req) => {
	const p = requirePrincipal(req);
	const status =
		new URL(req.request.url).searchParams.get("status") ?? "pending";
	const statement = isAdmin(p)
		? env.DB.prepare(
				"SELECT * FROM proposals WHERE status = ? ORDER BY created_at DESC LIMIT 200",
			).bind(status)
		: env.DB.prepare(
				"SELECT * FROM proposals WHERE status = ? AND author_id = ? ORDER BY created_at DESC LIMIT 200",
			).bind(status, p.actor.id);
	const { results } = await statement.all<Record<string, unknown>>();
	return json(200, { proposals: results.map(proposalFromRow) });
});

route("GET", "/proposals/:id", async (env, req, [id]) => {
	const p = requirePrincipal(req);
	const proposal = await getProposal(env, String(id));
	if (!isAdmin(p) && proposal.author.id !== p.actor.id) {
		throw new HttpError(problem(403, "forbidden", "Not allowed"));
	}
	let current: unknown = null;
	if (proposal.entityId) {
		const c = collectionOr404(proposal.collection);
		const got = await service(env, c.binding).get(c.model, proposal.entityId);
		current = got.ok ? got.value : null;
	}
	return json(200, { proposal, current });
});

route("POST", "/proposals/:id/approve", async (env, req, [id]) => {
	const p = requireAdmin(req);
	const { force } = await body<{ force?: boolean }>(req.request).catch(() => ({
		force: false,
	}));
	const proposal = await getProposal(env, String(id));
	// Claim it first, so a concurrent approve or reject cannot also act on it.
	const claim = await env.DB.prepare(
		"UPDATE proposals SET status = 'applying' WHERE id = ? AND status = 'pending'",
	)
		.bind(proposal.id)
		.run();
	if (!claim.meta.changes) {
		return problem(409, "decided", `Proposal is already ${proposal.status}`);
	}
	const release = () =>
		env.DB.prepare(
			"UPDATE proposals SET status = 'pending' WHERE id = ? AND status = 'applying'",
		)
			.bind(proposal.id)
			.run();
	// A guest or partner may have lost their link since they proposed.
	if (proposal.author.kind === "user" && proposal.entityId) {
		const kind = proposal.collection === "people" ? "person" : "technology";
		const link = await env.DB.prepare(
			"SELECT 1 FROM access_links WHERE user_id = ? AND kind = ? AND target_id = ?",
		)
			.bind(proposal.author.id, kind, proposal.entityId)
			.first();
		if (!link) {
			await release();
			return problem(
				409,
				"author_unlinked",
				"The author no longer has access to this entry",
			);
		}
	}
	const applied = await applyProposal(env, proposal, p, force === true).catch(
		async (error) => {
			await release();
			throw error;
		},
	);
	if (!applied.ok) {
		await release();
		return failure(applied.error);
	}
	await env.DB.prepare(
		"UPDATE proposals SET status = 'approved', decided_by = ?, decided_at = ? WHERE id = ? AND status = 'applying'",
	)
		.bind(p.actor.id, now(env), proposal.id)
		.run();
	await logActivity(
		env,
		p.actor,
		proposal.collection,
		proposal.entityId ?? "(new)",
		`approve ${proposal.kind}`,
		applied.value.version,
	);
	return json(200, {
		proposal: { id: proposal.id, status: "approved" },
		version: applied.value.version,
	});
});

route("POST", "/proposals/:id/reject", async (env, req, [id]) => {
	const p = requireAdmin(req);
	const { note } = await body<{ note?: string }>(req.request).catch(() => ({
		note: undefined,
	}));
	const proposal = await getProposal(env, String(id));
	if (proposal.status !== "pending") {
		return problem(409, "decided", `Proposal is already ${proposal.status}`);
	}
	const rejected = await env.DB.prepare(
		"UPDATE proposals SET status = 'rejected', note = ?, decided_by = ?, decided_at = ? WHERE id = ? AND status = 'pending'",
	)
		.bind(note ?? null, p.actor.id, now(env), proposal.id)
		.run();
	if (!rejected.meta.changes) {
		return problem(409, "decided", "Proposal is no longer pending");
	}
	return json(200, { proposal: { id: proposal.id, status: "rejected" } });
});

// Activity, tokens, access links ---------------------------------------

route("GET", "/activity", async (env, req) => {
	requireAdmin(req);
	const { results } = await env.DB.prepare(
		"SELECT actor_id, actor_name, collection, entity_id, operation, version, at FROM activity ORDER BY at DESC, id DESC LIMIT 100",
	).all();
	return json(200, { activity: results });
});

route("GET", "/tokens", async (env, req) => {
	requireAdmin(req);
	return json(200, { tokens: await listApiTokens(env.DB) });
});

route("POST", "/tokens", async (env, req) => {
	const p = requireAdmin(req);
	const { name, role } = await body<{ name?: string; role?: string }>(
		req.request,
	);
	if (!name?.trim() || !ROLES.includes(role as Role)) {
		return problem(
			422,
			"validation",
			`Send { name, role } with role one of ${ROLES.join(", ")}`,
		);
	}
	const created = await createApiToken(
		env.DB,
		{ name: name.trim(), role: role as Role, createdBy: p.actor.id },
		now(env),
	);
	return json(201, created);
});

route("DELETE", "/tokens/:id", async (env, req, [id]) => {
	requireAdmin(req);
	await revokeApiToken(env.DB, String(id), now(env));
	return json(200, { revoked: id });
});

route("GET", "/access", async (env, req) => {
	requireAdmin(req);
	const { results } = await env.DB.prepare(
		"SELECT user_id, kind, target_id, created_by, created_at FROM access_links ORDER BY created_at DESC",
	).all();
	return json(200, { links: results });
});

route("POST", "/access", async (env, req) => {
	const p = requireAdmin(req);
	const { userId, kind, targetId } = await body<{
		userId?: string;
		kind?: string;
		targetId?: string;
	}>(req.request);
	if (!userId || !targetId || (kind !== "person" && kind !== "technology")) {
		return problem(
			422,
			"validation",
			"Send { userId, kind: person|technology, targetId }",
		);
	}
	await env.DB.prepare(
		"INSERT OR IGNORE INTO access_links (user_id, kind, target_id, created_by, created_at) VALUES (?, ?, ?, ?, ?)",
	)
		.bind(userId, kind, targetId, p.actor.id, now(env))
		.run();
	return json(201, { userId, kind, targetId });
});

route(
	"DELETE",
	"/access/:user/:kind/:target",
	async (env, req, [user, kind, target]) => {
		requireAdmin(req);
		await env.DB.prepare(
			"DELETE FROM access_links WHERE user_id = ? AND kind = ? AND target_id = ?",
		)
			.bind(
				decodeURIComponent(String(user)),
				kind,
				decodeURIComponent(String(target)),
			)
			.run();
		return json(200, { removed: true });
	},
);

// Media ------------------------------------------------------------------

route("POST", "/media", async (env, req) => {
	const p = requirePrincipal(req);
	if (!env.MEDIA) return problem(503, "unavailable", "MEDIA is not bound");
	let form: FormData;
	try {
		form = await req.request.formData();
	} catch {
		return problem(
			400,
			"invalid_request",
			"Send multipart/form-data with file, collection and id",
		);
	}
	const file = form.get("file");
	const collection = String(form.get("collection") ?? "");
	const id = String(form.get("id") ?? "");
	if (!(file instanceof File))
		return problem(400, "invalid_request", "file is required");
	const c = findCollection(collection);
	if (!c) return problem(404, "not_found", `No collection "${collection}"`);
	// Uploads are public the moment they land, so only roles that publish
	// directly may upload; proposals carry text, not files.
	if (accessFor(p, c.name, id, await scopeOf(env, p)) !== "write") {
		throw new HttpError(
			problem(403, "forbidden", "Only editors who publish directly can upload"),
		);
	}
	if (file.size > MAX_UPLOAD_BYTES)
		return problem(413, "too_large", "Files are limited to 25 MB");
	const exists = await service(env, c.binding).get(c.model, id);
	if (!exists.ok) {
		return problem(
			404,
			"not_found",
			`Save the ${c.singular.toLowerCase()} before uploading files for it`,
		);
	}
	const bytes = new Uint8Array(await file.arrayBuffer());
	// The type comes from the file's bytes, never the client's claim.
	const contentType = sniffImageType(bytes);
	if (!contentType) {
		return problem(
			415,
			"unsupported",
			"Upload a PNG, JPEG, WebP, GIF or AVIF image",
		);
	}
	const key = mediaKey(
		collection,
		id,
		file.name,
		contentType,
		randomToken(6)
			.toLowerCase()
			.replace(/[^a-z0-9]/g, "x"),
	);
	if (!key) return problem(400, "invalid_request", "Invalid collection or id");
	await env.MEDIA.put(key, bytes, {
		httpMetadata: {
			contentType,
			cacheControl: "public, max-age=31536000, immutable",
		},
		customMetadata: { uploadedBy: p.actor.id },
	});
	const dimensions = imageDimensions(bytes);
	return json(201, {
		key,
		url: `${env.mediaBaseUrl ?? MEDIA_BASE_URL}/${key}`,
		contentType,
		bytes: bytes.length,
		...(dimensions ?? {}),
	});
});

// OpenAPI -----------------------------------------------------------------

route("GET", "/openapi.json", async () => json(200, openApi()));

export function openApi() {
	const collections = COLLECTIONS.map((c) => c.name);
	const ok = { description: "OK" };
	const errors = {
		"401": { description: "No session or API token" },
		"403": { description: "The role may not do this" },
		"404": { description: "Not found" },
		"409": {
			description:
				"Version conflict (send the current ifVersion), id taken, or still referenced",
		},
		"422": { description: "Validation failed; error.issues lists the fields" },
	};
	const collectionParam = {
		name: "collection",
		in: "path",
		required: true,
		schema: { type: "string", enum: collections },
	};
	const idParam = {
		name: "id",
		in: "path",
		required: true,
		schema: { type: "string" },
	};
	return {
		openapi: "3.1.0",
		info: {
			title: "Rawkode Academy CMS",
			version: "1",
			description:
				"Writes content through the platform write models. Authenticate with `Authorization: Bearer cms_...`. Writes the token's role may not make directly are stored as proposals (202) for an admin to approve. Field rules: GET /collections returns each collection's fields as the write model validates them.",
		},
		servers: [{ url: "/api/v1" }],
		components: {
			securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
		},
		security: [{ bearer: [] }],
		paths: {
			"/collections": {
				get: {
					summary: "Collections, their fields and panels",
					responses: { "200": ok, ...errors },
				},
			},
			"/collections/{collection}": {
				parameters: [collectionParam],
				get: {
					summary: "List rows",
					parameters: [
						{ name: "search", in: "query", schema: { type: "string" } },
						{
							name: "limit",
							in: "query",
							schema: { type: "integer", maximum: 200 },
						},
						{ name: "offset", in: "query", schema: { type: "integer" } },
					],
					responses: { "200": ok, ...errors },
				},
				post: {
					summary: "Create a row: { data }",
					responses: {
						"201": ok,
						"202": { description: "Stored as a proposal" },
						...errors,
					},
				},
			},
			"/collections/{collection}/{id}": {
				parameters: [collectionParam, idParam],
				get: {
					summary: "A row with its version and panels",
					responses: { "200": ok, ...errors },
				},
				patch: {
					summary: "Update a row: { patch, ifVersion }",
					responses: {
						"200": ok,
						"202": { description: "Stored as a proposal" },
						...errors,
					},
				},
				delete: {
					summary: "Delete a row (admins): ?ifVersion=n",
					responses: { "200": ok, ...errors },
				},
			},
			"/collections/{collection}/{id}/revisions": {
				parameters: [collectionParam, idParam],
				get: {
					summary: "Revision history",
					responses: { "200": ok, ...errors },
				},
			},
			"/collections/{collection}/{id}/restore": {
				parameters: [collectionParam, idParam],
				post: {
					summary: "Restore a revision (admins): { version }",
					responses: { "200": ok, ...errors },
				},
			},
			"/collections/{collection}/{id}/panels/{panel}": {
				parameters: [
					collectionParam,
					idParam,
					{
						name: "panel",
						in: "path",
						required: true,
						schema: { type: "string" },
					},
				],
				put: {
					summary:
						"Replace a list panel { items, ifVersion } or save an attached row { data, ifVersion }",
					responses: {
						"200": ok,
						"202": { description: "Stored as a proposal" },
						...errors,
					},
				},
			},
			"/media": {
				post: {
					summary:
						"Upload a file (multipart: file, collection, id); returns url, width, height",
					responses: { "201": ok, ...errors },
				},
			},
			"/proposals": {
				get: {
					summary: "Pending proposals (admins: all; others: their own)",
					responses: { "200": ok, ...errors },
				},
			},
			"/proposals/{id}/approve": {
				post: {
					summary: "Apply a proposal (admins): { force? }",
					responses: { "200": ok, ...errors },
				},
			},
			"/proposals/{id}/reject": {
				post: {
					summary: "Reject a proposal (admins): { note? }",
					responses: { "200": ok, ...errors },
				},
			},
		},
	};
}

export async function handleApi(
	env: ApiEnv,
	req: ApiRequest,
): Promise<Response> {
	if (
		req.principal?.via === "session" &&
		!sameOriginWrite(req.request, req.origin)
	) {
		return problem(403, "forbidden", "Cross-origin write refused");
	}
	const method = req.request.method === "HEAD" ? "GET" : req.request.method;
	let pathMatched = false;
	for (const [m, regex, handler] of routes) {
		const match = regex.exec(req.path);
		if (!match) continue;
		pathMatched = true;
		if (m !== method) continue;
		try {
			return await handler(env, req, match.slice(1));
		} catch (error) {
			if (error instanceof HttpError) return error.response;
			console.error(
				"[cms] request failed",
				req.request.method,
				req.path,
				error,
			);
			return problem(500, "internal", "Something went wrong");
		}
	}
	return pathMatched
		? problem(405, "method_not_allowed", "Method not allowed")
		: problem(404, "not_found", "No such endpoint");
}
