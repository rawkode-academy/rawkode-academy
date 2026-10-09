// Test doubles only: a D1 database on node:sqlite with the real Studio
// migrations applied, and an in-memory R2 bucket with etag preconditions.
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

type Value = string | number | null;

export function createSqliteD1() {
	const sqlite = new DatabaseSync(":memory:");
	sqlite.exec("PRAGMA foreign_keys=ON");
	const migrations = new URL("../../../data-model/", import.meta.url);
	for (const file of readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort()) {
		sqlite.exec(readFileSync(new URL(file, migrations), "utf8"));
	}
	class Prepared {
		values: Value[] = [];
		constructor(readonly query: string) {}
		bind(...values: unknown[]) {
			this.values = values.map((value) =>
				value === undefined ? null : typeof value === "boolean" ? Number(value) : value as Value
			);
			return this;
		}
		async first<T>() {
			return (sqlite.prepare(this.query).get(...this.values) ?? null) as T | null;
		}
		async all<T>() {
			return { results: sqlite.prepare(this.query).all(...this.values) as T[] };
		}
		async run() {
			const result = sqlite.prepare(this.query).run(...this.values);
			const changes = Number(result.changes);
			return { meta: { changes, rows_written: changes }, success: true };
		}
	}
	const db = {
		prepare: (query: string) => new Prepared(query),
		async batch(statements: Prepared[]) {
			sqlite.exec("BEGIN");
			try {
				const results = [];
				for (const statement of statements) results.push(await statement.run());
				sqlite.exec("COMMIT");
				return results;
			} catch (error) {
				sqlite.exec("ROLLBACK");
				throw error;
			}
		},
	} as unknown as D1Database;
	return {
		db,
		sqlite,
		row: (sql: string, ...values: Value[]) =>
			sqlite.prepare(sql).get(...values) as Record<string, unknown> | undefined,
	};
}

export function createBucketDouble() {
	const objects = new Map<string, { etag: string; value: string; uploaded: number }>();
	let sequence = 0;
	let clock: number | null = null;
	const nowMs = () => clock ?? Date.now();
	const puts: Array<{ key: string; onlyIf?: unknown }> = [];
	const objectFor = (key: string) => {
		const object = objects.get(key);
		if (!object) return null;
		return {
			key,
			etag: object.etag,
			httpEtag: `"${object.etag}"`,
			size: object.value.length,
			uploaded: new Date(object.uploaded),
		} as unknown as R2Object;
	};
	const bucket = {
		async head(key: string) {
			return objectFor(key);
		},
		async get(key: string) {
			const object = objects.get(key);
			if (!object) return null;
			return {
				...objectFor(key),
				json: async () => JSON.parse(object.value),
				text: async () => object.value,
			} as unknown as R2ObjectBody;
		},
		async put(key: string, value: string, options?: R2PutOptions) {
			puts.push({ key, onlyIf: options?.onlyIf });
			const condition = options?.onlyIf as { etagMatches?: string } | undefined;
			if (condition?.etagMatches !== undefined && objects.get(key)?.etag !== condition.etagMatches) {
				return null;
			}
			objects.set(key, { etag: `etag-${++sequence}`, value: String(value), uploaded: nowMs() });
			return objectFor(key);
		},
	} as unknown as R2Bucket;
	return {
		bucket,
		puts,
		set(key: string, value: string, etag: string) {
			objects.set(key, { etag, value, uploaded: nowMs() });
		},
		// Pins the upload time of later writes (seconds), or restores the real clock.
		setClock(seconds: number | null) {
			clock = seconds === null ? null : seconds * 1000;
		},
		remove: (key: string) => objects.delete(key),
		text: (key: string) => objects.get(key)?.value ?? null,
		etag: (key: string) => objects.get(key)?.etag ?? null,
	};
}
