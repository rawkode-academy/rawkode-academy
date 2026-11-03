import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { checkD1SchemaOutput } from "./verify-live-checks";
import { schemaFlags, schemaQuery } from "./verify-live-schema";

const databases: DatabaseSync[] = [];

function migratedDatabase(): DatabaseSync {
	const db = new DatabaseSync(":memory:");
	databases.push(db);
	db.exec("CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL)");
	const directory = new URL("../data-model/", import.meta.url);
	for (const name of readdirSync(directory).filter((entry) => entry.endsWith(".sql")).sort()) {
		db.exec(readFileSync(new URL(name, directory), "utf8"));
		db.prepare("INSERT INTO d1_migrations (name) VALUES (?)").run(name);
	}
	return db;
}

function schemaResult(db: DatabaseSync) {
	return checkD1SchemaOutput(
		JSON.stringify([{ results: [db.prepare(schemaQuery).get()] }]),
		schemaFlags,
	);
}

afterEach(() => {
	for (const db of databases.splice(0)) db.close();
});

describe("live schema verification", () => {
	it("accepts the schema produced by every checked-in migration", () => {
		expect(schemaResult(migratedDatabase())).toEqual({ ok: true });
	});

	it("rejects a missing cancellation migration or table", () => {
		const db = migratedDatabase();
		db.prepare("DELETE FROM d1_migrations WHERE name = ?").run("0010_stream_cancelled_attempts.sql");
		expect(schemaResult(db).detail).toContain("migration_0010");
		db.prepare("INSERT INTO d1_migrations (name) VALUES (?)").run("0010_stream_cancelled_attempts.sql");
		db.exec("DROP TABLE studio_stream_cancelled_attempts");
		expect(schemaResult(db).detail).toContain("cancelled_stream_attempts_table");
	});

	it("rejects an incomplete participant provisioning schema", () => {
		const db = migratedDatabase();
		db.exec("ALTER TABLE studio_participants DROP COLUMN provisioning_state");
		db.exec("ALTER TABLE studio_invite_redemptions DROP COLUMN claim_id");
		expect(schemaResult(db).detail).toContain("participant_provisioning_columns");
		expect(schemaResult(db).detail).toContain("invite_redemption_provisioning_columns");
	});

	it("rejects a missing WHIP migration and missing lifecycle tables", () => {
		const db = migratedDatabase();
		db.prepare("DELETE FROM d1_migrations WHERE name = ?").run("0011_whip_provider_lifecycle.sql");
		expect(schemaResult(db).detail).toContain("migration_0011");
		db.prepare("INSERT INTO d1_migrations (name) VALUES (?)").run("0011_whip_provider_lifecycle.sql");
		db.exec("DROP TABLE studio_whip_legacy_owners");
		expect(schemaResult(db).detail).toContain("whip_legacy_owners_table");
		expect(schemaResult(db).detail).toContain("whip_legacy_owner_columns");
	});

	it.each([
		["DROP INDEX studio_whip_provider_one_prod_idx", "whip_one_prod_index"],
		["DROP INDEX studio_whip_provider_one_session_idx", "whip_one_session_index"],
		["DROP INDEX studio_whip_provider_reaper_idx", "whip_reaper_index"],
		["DROP INDEX studio_whip_provider_takeover_starting_idx", "whip_takeover_starting_index"],
		["DROP INDEX studio_whip_provider_takeover_live_idx", "whip_takeover_live_index"],
		["DROP TRIGGER studio_whip_provider_attempt_identity_immutable", "whip_identity_trigger"],
		["DROP TRIGGER studio_whip_provider_attempt_pending_not_deleted", "whip_pending_delete_trigger"],
		["DROP TRIGGER studio_whip_provider_gate_requires_legacy_retirement", "whip_legacy_gate_trigger"],
	])("rejects missing WHIP invariant: %s", (sql, flag) => {
		const db = migratedDatabase();
		db.exec(sql);
		expect(schemaResult(db).detail).toContain(flag);
	});

	it("rejects a same-named production index that does not enforce the barrier", () => {
		const db = migratedDatabase();
		db.exec("DROP INDEX studio_whip_provider_one_prod_idx");
		db.exec("CREATE INDEX studio_whip_provider_one_prod_idx ON studio_whip_provider_attempts (stream_environment)");
		expect(schemaResult(db).detail).toContain("whip_one_prod_index");
		db.exec("DROP INDEX studio_whip_provider_one_prod_idx");
		db.exec("CREATE UNIQUE INDEX studio_whip_provider_one_prod_idx ON studio_whip_provider_attempts (attempt_id) WHERE stream_environment = 'prod' AND state <> 'retired'");
		expect(schemaResult(db).detail).toContain("whip_one_prod_index");
	});
});
