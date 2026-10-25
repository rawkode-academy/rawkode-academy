import {
	and,
	asc,
	type Column,
	desc,
	eq,
	getTableColumns,
	like,
	max,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { getTableConfig, type SQLiteTable } from "drizzle-orm/sqlite-core";
import type { z } from "zod";
import type { EntityModel, ListModel, Model, ServiceModels } from "./model";
import { contentRevisions } from "./revisions";
import {
	type Actor,
	type ChangeEvent,
	fail,
	type ListPage,
	type ListQuery,
	type Operation,
	ok,
	type Result,
	type Revision,
	type Row,
	type Versioned,
} from "./types";

export interface ContentWriteEnv {
	DB: D1Database;
	/** content-changes queue; when unbound, writes still commit and the website's hourly job catches up. */
	CONTENT_CHANGES?: Queue<ChangeEvent>;
}

// D1 binds at most 100 parameters per statement.
const MAX_PARAMS = 100;
const MAX_LIMIT = 200;

// biome-ignore lint/suspicious/noExplicitAny: queries are built over tables only known at runtime
type AnyQuery = any;

const columnsOf = (table: SQLiteTable) =>
	getTableColumns(table) as Record<string, Column>;

const issuesOf = (error: z.ZodError) =>
	error.issues.map((issue) => ({
		path: issue.path.join("."),
		message: issue.message,
	}));

const isUniqueViolation = (error: unknown, table: string) =>
	String((error as { message?: unknown })?.message ?? error).includes(
		`UNIQUE constraint failed: ${table}`,
	);

/**
 * Every column, with its default (or null) where the row has no value. Writes
 * then set the whole row, so a restored snapshot also clears what was empty
 * then, and snapshots hold exactly what is stored.
 */
function complete(columns: Record<string, Column>, row: Row): Row {
	const out: Row = {};
	for (const [prop, column] of Object.entries(columns)) {
		if (row[prop] !== undefined) {
			out[prop] = row[prop];
			continue;
		}
		const { defaultFn, default: value } = column as Column & {
			defaultFn?: () => unknown;
		};
		out[prop] = defaultFn ? defaultFn() : column.hasDefault ? value : null;
	}
	return out;
}

/** The primary-key properties of a list's items (the key minus the parent). */
function listItemKey(def: ListModel): string[] {
	const columns = columnsOf(def.table);
	const byColumn = new Map(
		Object.entries(columns).map(([prop, c]) => [c, prop]),
	);
	const config = getTableConfig(def.table);
	const keyColumns =
		config.primaryKeys[0]?.columns ??
		Object.values(columns).filter((c) => c.primary);
	return keyColumns
		.map((c) => byColumn.get(c as Column))
		.filter((p): p is string => !!p && !def.parent.includes(p));
}

const actorOk = (actor: Actor | undefined): actor is Actor =>
	!!actor &&
	typeof actor.id === "string" &&
	actor.id.length > 0 &&
	(actor.kind === "user" || actor.kind === "agent");

/**
 * Validated, versioned writes over one service's D1. Every mutation commits
 * the row change and its revision in one D1 batch, then announces the change
 * on the content-changes queue.
 */
export class ContentStore {
	readonly #db: DrizzleD1Database;
	readonly #models: Map<string, Model>;
	readonly #queue: Queue<ChangeEvent> | undefined;
	readonly #service: string;
	readonly #now: () => Date;

	constructor(
		service: ServiceModels,
		env: ContentWriteEnv,
		options: { now?: () => Date } = {},
	) {
		this.#db = drizzle(env.DB);
		this.#models = new Map(service.models.map((m) => [m.name, m]));
		this.#queue = env.CONTENT_CHANGES;
		this.#service = service.service;
		this.#now = options.now ?? (() => new Date());
	}

	/** Names and kinds of the models this service writes. */
	models(): {
		name: string;
		kind: Model["kind"];
		key?: string;
		parent?: string[];
	}[] {
		return [...this.#models.values()].map((m) =>
			m.kind === "entity"
				? { name: m.name, kind: m.kind, key: m.key }
				: { name: m.name, kind: m.kind, parent: m.parent },
		);
	}

	// ---------------------------------------------------------------- reads

	async get(model: string, id: string): Promise<Result<Versioned<Row>>> {
		const m = this.#entity(model);
		if (!m.ok) return m;
		const row = await this.#find(m.value, id);
		if (!row) return fail("not_found", `${model} "${id}" does not exist`);
		return ok({ value: row, version: await this.#version(model, id) });
	}

	async list(model: string, query: ListQuery = {}): Promise<Result<ListPage>> {
		const found = this.#models.get(model);
		if (!found) return fail("unknown_model", `Unknown model "${model}"`);
		const columns = columnsOf(found.table);
		const filters: SQL[] = [];
		for (const [prop, value] of Object.entries(query.where ?? {})) {
			const column = columns[prop];
			if (!column) return fail("invalid_request", `Unknown column "${prop}"`);
			filters.push(eq(column, value));
		}
		const term = query.search?.trim();
		if (term && found.kind === "entity" && found.search?.length) {
			const pattern = `%${term.replace(/[%_]/g, "")}%`;
			const matches = found.search
				.map((prop) => columns[prop])
				.filter((c): c is Column => !!c)
				.map((c) => like(c, pattern));
			const any = or(...matches);
			if (any) filters.push(any);
		}
		const where = filters.length ? and(...filters) : undefined;
		const limit = Math.min(Math.max(query.limit ?? 50, 1), MAX_LIMIT);
		const offset = Math.max(query.offset ?? 0, 0);
		const order = this.#order(found);
		const rows = (await (this.#db as AnyQuery)
			.select()
			.from(found.table)
			.where(where)
			.orderBy(...order)
			.limit(limit)
			.offset(offset)) as Row[];
		const [count] = (await (this.#db as AnyQuery)
			.select({ total: sql<number>`count(*)` })
			.from(found.table)
			.where(where)) as { total: number }[];
		return ok({ rows, total: Number(count?.total ?? 0) });
	}

	async revisions(model: string, id: string): Promise<Result<Revision[]>> {
		if (!this.#models.has(model)) {
			return fail("unknown_model", `Unknown model "${model}"`);
		}
		const rows = await this.#db
			.select()
			.from(contentRevisions)
			.where(
				and(
					eq(contentRevisions.model, model),
					eq(contentRevisions.entityId, id),
				),
			)
			.orderBy(desc(contentRevisions.version));
		return ok(
			rows.map((r) => ({
				version: r.version,
				operation: r.operation,
				actor: {
					id: r.actorId,
					kind: r.actorKind,
					...(r.actorName ? { name: r.actorName } : {}),
				},
				createdAt: r.createdAt,
				snapshot: r.snapshot,
			})),
		);
	}

	async getList(model: string, parent: Row): Promise<Result<Versioned<Row[]>>> {
		const m = this.#list(model);
		if (!m.ok) return m;
		const parentKey = this.#parentKey(m.value, parent);
		if (!parentKey.ok) return parentKey;
		const items = await this.#items(m.value, parent);
		return ok({
			value: items,
			version: await this.#version(model, parentKey.value),
		});
	}

	/** Rows of a list table where `column` equals `value`: what references an entity. */
	async findReferences(
		model: string,
		column: string,
		value: string,
	): Promise<Result<Row[]>> {
		const found = this.#models.get(model);
		if (!found) return fail("unknown_model", `Unknown model "${model}"`);
		const col = columnsOf(found.table)[column];
		if (!col) return fail("invalid_request", `Unknown column "${column}"`);
		const rows = (await (this.#db as AnyQuery)
			.select()
			.from(found.table)
			.where(eq(col, value))
			.limit(MAX_LIMIT)) as Row[];
		return ok(rows);
	}

	// --------------------------------------------------------------- writes

	async create(
		model: string,
		input: Row,
		actor: Actor,
	): Promise<Result<Versioned<Row>>> {
		const m = this.#entity(model);
		if (!m.ok) return m;
		if (!actorOk(actor)) return fail("invalid_request", "An actor is required");
		const def = m.value;
		const keyColumn = columnsOf(def.table)[def.key];
		const candidate: Row = { ...input };
		if (candidate[def.key] === undefined || candidate[def.key] === "") {
			const generate = (keyColumn as { defaultFn?: () => unknown } | undefined)
				?.defaultFn;
			if (!generate) {
				return fail("validation", `${def.key} is required`, {
					issues: [{ path: def.key, message: "Required" }],
				});
			}
			candidate[def.key] = generate();
		}
		const row = this.#validate(def, candidate);
		if (!row.ok) return row;
		const id = String(row.value[def.key]);
		if (await this.#find(def, id)) {
			return fail("exists", `${model} "${id}" already exists`);
		}
		const version = (await this.#version(model, id)) + 1;
		const committed = await this.#commit(
			def.table,
			model,
			id,
			version,
			"create",
			actor,
			row.value,
			[(this.#db as AnyQuery).insert(def.table).values(row.value)],
		);
		if (!committed.ok) return committed;
		await this.#announce(
			model,
			id,
			"create",
			version,
			def.tags(row.value),
			actor,
		);
		return ok({ value: row.value, version });
	}

	async update(
		model: string,
		id: string,
		patch: Row,
		options: { ifVersion: number },
		actor: Actor,
	): Promise<Result<Versioned<Row>>> {
		const m = this.#entity(model);
		if (!m.ok) return m;
		if (!actorOk(actor)) return fail("invalid_request", "An actor is required");
		const def = m.value;
		if (def.key in patch && String(patch[def.key]) !== id) {
			return fail("validation", `${def.key} cannot change`, {
				issues: [{ path: def.key, message: "Ids are immutable" }],
			});
		}
		const current = await this.#find(def, id);
		if (!current) return fail("not_found", `${model} "${id}" does not exist`);
		const versionNow = await this.#version(model, id);
		if (versionNow !== options?.ifVersion) {
			return fail(
				"conflict",
				`${model} "${id}" changed since version ${options?.ifVersion}`,
				{
					currentVersion: versionNow,
				},
			);
		}
		const row = this.#validate(def, {
			...current,
			...patch,
			[def.key]: current[def.key],
		});
		if (!row.ok) return row;
		const version = versionNow + 1;
		const committed = await this.#commit(
			def.table,
			model,
			id,
			version,
			"update",
			actor,
			row.value,
			[
				(this.#db as AnyQuery)
					.update(def.table)
					.set(row.value)
					.where(this.#keyEq(def, id)),
			],
		);
		if (!committed.ok) return committed;
		await this.#announce(
			model,
			id,
			"update",
			version,
			[...def.tags(current), ...def.tags(row.value)],
			actor,
		);
		return ok({ value: row.value, version });
	}

	async delete(
		model: string,
		id: string,
		options: { ifVersion: number },
		actor: Actor,
	): Promise<Result<{ version: number }>> {
		const m = this.#entity(model);
		if (!m.ok) return m;
		if (!actorOk(actor)) return fail("invalid_request", "An actor is required");
		const def = m.value;
		const current = await this.#find(def, id);
		if (!current) return fail("not_found", `${model} "${id}" does not exist`);
		const versionNow = await this.#version(model, id);
		if (versionNow !== options?.ifVersion) {
			return fail(
				"conflict",
				`${model} "${id}" changed since version ${options?.ifVersion}`,
				{
					currentVersion: versionNow,
				},
			);
		}
		const version = versionNow + 1;
		// The snapshot keeps the deleted row, so restore() can bring it back.
		const committed = await this.#commit(
			def.table,
			model,
			id,
			version,
			"delete",
			actor,
			current,
			[(this.#db as AnyQuery).delete(def.table).where(this.#keyEq(def, id))],
		);
		if (!committed.ok) return committed;
		await this.#announce(
			model,
			id,
			"delete",
			version,
			def.tags(current),
			actor,
		);
		return ok({ version });
	}

	/** Writes an earlier revision's snapshot back as the current row. */
	async restore(
		model: string,
		id: string,
		fromVersion: number,
		actor: Actor,
	): Promise<Result<Versioned<Row>>> {
		const m = this.#entity(model);
		if (!m.ok) return m;
		if (!actorOk(actor)) return fail("invalid_request", "An actor is required");
		const def = m.value;
		const [revision] = await this.#db
			.select()
			.from(contentRevisions)
			.where(
				and(
					eq(contentRevisions.model, model),
					eq(contentRevisions.entityId, id),
					eq(contentRevisions.version, fromVersion),
				),
			);
		if (!revision?.snapshot) {
			return fail(
				"not_found",
				`${model} "${id}" has no version ${fromVersion}`,
			);
		}
		const row = this.#validate(def, {
			...(revision.snapshot as Row),
			[def.key]: id,
		});
		if (!row.ok) return row;
		const current = await this.#find(def, id);
		const version = (await this.#version(model, id)) + 1;
		const write = current
			? (this.#db as AnyQuery)
					.update(def.table)
					.set(row.value)
					.where(this.#keyEq(def, id))
			: (this.#db as AnyQuery).insert(def.table).values(row.value);
		const committed = await this.#commit(
			def.table,
			model,
			id,
			version,
			"restore",
			actor,
			row.value,
			[write],
		);
		if (!committed.ok) return committed;
		await this.#announce(
			model,
			id,
			"restore",
			version,
			[...(current ? def.tags(current) : []), ...def.tags(row.value)],
			actor,
		);
		return ok({ value: row.value, version });
	}

	/** Replaces a parent's whole list (items, order) in one batch. */
	async setList(
		model: string,
		parent: Row,
		items: Row[],
		options: { ifVersion: number },
		actor: Actor,
	): Promise<Result<Versioned<Row[]>>> {
		const m = this.#list(model);
		if (!m.ok) return m;
		if (!actorOk(actor)) return fail("invalid_request", "An actor is required");
		if (!Array.isArray(items))
			return fail("invalid_request", "items must be an array");
		const def = m.value;
		const parentKey = this.#parentKey(def, parent);
		if (!parentKey.ok) return parentKey;
		const parentValues = Object.fromEntries(
			def.parent.map((p) => [p, parent[p]]),
		);
		const rows: Row[] = [];
		const issues: { path: string; message: string }[] = [];
		items.forEach((item, index) => {
			const parsed = def.item.safeParse(item);
			if (!parsed.success) {
				for (const issue of issuesOf(parsed.error)) {
					issues.push({
						path: `${index}.${issue.path}`,
						message: issue.message,
					});
				}
				return;
			}
			rows.push({
				...(parsed.data as Row),
				...parentValues,
				...(def.position ? { [def.position]: index } : {}),
			});
		});
		// Items that would collide on the table's primary key, reported per item
		// rather than as one opaque UNIQUE failure at commit.
		const itemKey = listItemKey(def);
		if (itemKey.length && !issues.length) {
			const seen = new Map<string, number>();
			rows.forEach((row, index) => {
				const key = JSON.stringify(itemKey.map((k) => row[k]));
				const first = seen.get(key);
				if (first === undefined) {
					seen.set(key, index);
					return;
				}
				issues.push({
					path: `${index}.${itemKey.join(",")}`,
					message: `Duplicates item ${first}`,
				});
			});
		}
		if (issues.length)
			return fail("validation", "Some items are invalid", { issues });
		const versionNow = await this.#version(model, parentKey.value);
		if (versionNow !== options?.ifVersion) {
			return fail(
				"conflict",
				`${model} for ${parentKey.value} changed since version ${options?.ifVersion}`,
				{ currentVersion: versionNow },
			);
		}
		const before = await this.#items(def, parent);
		const statements: AnyQuery[] = [
			(this.#db as AnyQuery)
				.delete(def.table)
				.where(this.#parentEq(def, parent)),
		];
		const width = Object.keys(columnsOf(def.table)).length;
		const chunk = Math.max(1, Math.floor(MAX_PARAMS / width));
		for (let i = 0; i < rows.length; i += chunk) {
			statements.push(
				(this.#db as AnyQuery)
					.insert(def.table)
					.values(rows.slice(i, i + chunk)),
			);
		}
		const version = versionNow + 1;
		const committed = await this.#commit(
			def.table,
			model,
			parentKey.value,
			version,
			"set",
			actor,
			rows,
			statements,
		);
		if (!committed.ok) return committed;
		await this.#announce(
			model,
			parentKey.value,
			"set",
			version,
			def.tags(parentValues, [...before, ...rows]),
			actor,
		);
		return ok({ value: rows, version });
	}

	// -------------------------------------------------------------- helpers

	#entity(model: string): Result<EntityModel> {
		const found = this.#models.get(model);
		if (!found) return fail("unknown_model", `Unknown model "${model}"`);
		if (found.kind !== "entity") {
			return fail(
				"invalid_request",
				`"${model}" is a list; use getList/setList`,
			);
		}
		return ok(found);
	}

	#list(model: string): Result<ListModel> {
		const found = this.#models.get(model);
		if (!found) return fail("unknown_model", `Unknown model "${model}"`);
		if (found.kind !== "list") {
			return fail("invalid_request", `"${model}" is an entity; use get/update`);
		}
		return ok(found);
	}

	#validate(def: EntityModel, candidate: Row): Result<Row> {
		const parsed = def.schema.safeParse(candidate);
		if (!parsed.success) {
			return fail("validation", `Invalid ${def.name}`, {
				issues: issuesOf(parsed.error),
			});
		}
		let row = parsed.data as Row;
		if (def.derive) row = def.derive(row);
		const columns = columnsOf(def.table);
		if ("updatedAt" in columns) row = { ...row, updatedAt: this.#now() };
		return ok(complete(columns, row));
	}

	#keyEq(def: EntityModel, id: string): SQL {
		const column = columnsOf(def.table)[def.key] as Column;
		return eq(column, id);
	}

	#parentEq(def: ListModel, parent: Row): SQL {
		const columns = columnsOf(def.table);
		return and(
			...def.parent.map((p) => eq(columns[p] as Column, parent[p] as string)),
		) as SQL;
	}

	#parentKey(def: ListModel, parent: Row): Result<string> {
		const values = def.parent.map((p) => parent?.[p]);
		if (values.some((v) => typeof v !== "string" || v.length === 0)) {
			return fail("invalid_request", `Parent needs ${def.parent.join(", ")}`);
		}
		return ok(values.length === 1 ? String(values[0]) : JSON.stringify(values));
	}

	#order(model: Model): SQL[] {
		const columns = columnsOf(model.table);
		if (model.kind === "entity") {
			const by = model.orderBy ?? {
				column: model.key,
				direction: "asc" as const,
			};
			const column = columns[by.column] as Column;
			return [by.direction === "desc" ? desc(column) : asc(column)];
		}
		const props = [...model.parent, model.position ?? model.orderBy].filter(
			(p): p is string => !!p,
		);
		return props.map((p) => asc(columns[p] as Column));
	}

	async #find(def: EntityModel, id: string): Promise<Row | undefined> {
		const [row] = (await (this.#db as AnyQuery)
			.select()
			.from(def.table)
			.where(this.#keyEq(def, id))
			.limit(1)) as Row[];
		return row;
	}

	async #items(def: ListModel, parent: Row): Promise<Row[]> {
		return (await (this.#db as AnyQuery)
			.select()
			.from(def.table)
			.where(this.#parentEq(def, parent))
			.orderBy(...this.#order(def))) as Row[];
	}

	async #version(model: string, id: string): Promise<number> {
		const [row] = await this.#db
			.select({ version: max(contentRevisions.version) })
			.from(contentRevisions)
			.where(
				and(
					eq(contentRevisions.model, model),
					eq(contentRevisions.entityId, id),
				),
			);
		return Number(row?.version ?? 0);
	}

	async #commit(
		table: SQLiteTable,
		model: string,
		id: string,
		version: number,
		operation: Operation,
		actor: Actor,
		snapshot: unknown,
		statements: AnyQuery[],
	): Promise<Result<true>> {
		// The revision goes first: if another writer took this version, the
		// unique index fails the batch before any row changes.
		const revision = this.#db.insert(contentRevisions).values({
			model,
			entityId: id,
			version,
			operation,
			actorId: actor.id,
			actorKind: actor.kind,
			actorName: actor.name ?? null,
			snapshot,
			createdAt: this.#now(),
		});
		try {
			await this.#db.batch([revision, ...statements] as [
				AnyQuery,
				...AnyQuery[],
			]);
		} catch (error) {
			if (isUniqueViolation(error, "content_revisions")) {
				return fail(
					"conflict",
					`${model} "${id}" was changed by another writer`,
					{
						currentVersion: await this.#version(model, id),
					},
				);
			}
			const tableName = (table as unknown as Record<symbol, string>)[
				Symbol.for("drizzle:Name")
			];
			if (tableName && isUniqueViolation(error, tableName)) {
				return fail("validation", `${model}: a unique value is already taken`, {
					issues: [{ path: "", message: String((error as Error).message) }],
				});
			}
			throw error;
		}
		return ok(true);
	}

	async #announce(
		model: string,
		id: string,
		operation: Operation,
		version: number,
		tags: string[],
		actor: Actor,
	): Promise<void> {
		if (!this.#queue) return;
		const event: ChangeEvent = {
			model,
			id,
			operation,
			version,
			tags: [...new Set(tags)],
			actor,
			at: this.#now().getTime(),
		};
		try {
			await this.#queue.send(event);
		} catch (error) {
			// The write is committed; the website's hourly change detection
			// still picks it up, so a queue outage only delays the page.
			console.error(
				JSON.stringify({
					event: "content.change-event.failed",
					service: this.#service,
					model,
					id,
					error: error instanceof Error ? error.message : String(error),
				}),
			);
		}
	}
}
