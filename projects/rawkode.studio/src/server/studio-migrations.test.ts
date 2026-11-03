import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

const migrationDir = new URL("../../data-model/", import.meta.url);
const databases: DatabaseSync[] = [];
const originalMigrations = [
	"0000_studio_sessions.sql",
	"0001_content_video_sessions.sql",
	"0002_content_video_slugs.sql",
	"0003_stream_state.sql",
];

function createDatabase(): DatabaseSync {
	const db = new DatabaseSync(":memory:");
	databases.push(db);
	db.exec(`
		PRAGMA foreign_keys = ON;
		CREATE TABLE d1_migrations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT UNIQUE,
			applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
		);
	`);
	return db;
}

function applyMigration(db: DatabaseSync, name: string): void {
	const sql = readFileSync(new URL(name, migrationDir), "utf8");
	db.exec("BEGIN");
	try {
		db.exec(sql);
		db.prepare("INSERT INTO d1_migrations (name) VALUES (?)").run(name);
		db.exec("COMMIT");
	} catch (error) {
		db.exec("ROLLBACK");
		throw error;
	}
}

// Wrangler tracks migrations by filename; this exercises that contract with
// SQLite. The production-shaped fixture below is independent of the restored SQL.
function applyPendingMigrations(db: DatabaseSync): string[] {
	const applied = new Set(
		db.prepare("SELECT name FROM d1_migrations").all().map((row) => row.name),
	);
	const pending = readdirSync(migrationDir)
		.filter((name) => /^\d{4}_.+\.sql$/.test(name) && !applied.has(name))
		.sort();
	for (const name of pending) applyMigration(db, name);
	return pending;
}

function applyOriginalMigrations(db: DatabaseSync): void {
	for (const name of originalMigrations) applyMigration(db, name);
}

function addObservedProductionSchema(db: DatabaseSync): void {
	db.exec(`
		ALTER TABLE studio_participants ADD COLUMN realtimekit_custom_participant_id TEXT;
		ALTER TABLE studio_participants ADD COLUMN realtimekit_participant_id TEXT;
		ALTER TABLE studio_participants ADD COLUMN provisioning_state TEXT NOT NULL DEFAULT 'unknown'
			CHECK (provisioning_state IN ('unknown', 'pending', 'ready'));
		ALTER TABLE studio_participants ADD COLUMN invite_token_hash TEXT;
		ALTER TABLE studio_participants ADD COLUMN invite_claim_id TEXT;
		CREATE UNIQUE INDEX studio_participants_realtimekit_identity_idx
			ON studio_participants (session_id, realtimekit_custom_participant_id)
			WHERE realtimekit_custom_participant_id IS NOT NULL;
		ALTER TABLE studio_invite_redemptions ADD COLUMN state TEXT NOT NULL DEFAULT 'redeemed'
			CHECK (state IN ('pending', 'redeemed'));
		ALTER TABLE studio_invite_redemptions ADD COLUMN claim_id TEXT;
		ALTER TABLE studio_invite_redemptions ADD COLUMN finalized_at INTEGER;
	`);
	db.prepare("INSERT INTO d1_migrations (name) VALUES (?)")
		.run("0004_participant_provisioning.sql");
}

function insertSession(db: DatabaseSync): void {
	db.exec(`
		INSERT INTO studio_sessions
			(id, title, show_id, show_title, starts_at, recording_prefix, created_by_id)
		VALUES ('session-1', 'Show', 'show', 'Show', '2026-01-01T00:00:00Z',
			'studio/recordings/session-1/', 'operator');
		INSERT INTO studio_invites (token_hash, session_id, expires_at, created_by_id)
		VALUES ('invite-1', 'session-1', 2000000000, 'operator');
	`);
}

function indexSql(db: DatabaseSync, name: string): unknown {
	return db.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?")
		.get(name)?.sql;
}

afterEach(() => {
	for (const db of databases.splice(0)) db.close();
});

describe("Studio participant migration compatibility", () => {
	it("applies all migrations to a fresh database and preserves main-schema rows", () => {
		const db = createDatabase();
		applyOriginalMigrations(db);
		insertSession(db);
		db.exec(`
			INSERT INTO studio_participants (session_id, user_id, role, name)
			VALUES ('session-1', 'user-1', 'guest', 'Guest');
			INSERT INTO studio_invite_redemptions (token_hash, user_id)
			VALUES ('invite-1', 'user-1');
		`);

		const pending = applyPendingMigrations(db);
		expect(pending.indexOf("0004_participant_provisioning.sql"))
			.toBeLessThan(pending.indexOf("0006_realtimekit_participant_identity.sql"));
		expect(pending).toContain("0009_stream_output_inputs.sql");
		expect(db.prepare("SELECT name, provisioning_state, realtimekit_participant_id FROM studio_participants").get())
			.toMatchObject({ name: "Guest", provisioning_state: "unknown", realtimekit_participant_id: null });
		expect(db.prepare("SELECT user_id, state, claim_id, finalized_at FROM studio_invite_redemptions").get())
			.toMatchObject({ user_id: "user-1", state: "redeemed", claim_id: null, finalized_at: null });
		expect(indexSql(db, "studio_participants_realtimekit_identity_idx")).toContain("realtimekit_custom_participant_id");
		expect(indexSql(db, "studio_participants_realtimekit_participant_id_idx")).toContain("realtimekit_participant_id");
		expect(applyPendingMigrations(db)).toEqual([]);
	});

	it("upgrades the observed production shape without replaying its recorded 0004", () => {
		const db = createDatabase();
		applyOriginalMigrations(db);
		addObservedProductionSchema(db);
		insertSession(db);
		db.exec(`
			INSERT INTO studio_participants
				(session_id, user_id, role, name, realtimekit_custom_participant_id,
				 realtimekit_participant_id, provisioning_state, invite_token_hash, invite_claim_id)
			VALUES ('session-1', 'user-1', 'guest', 'Guest', 'custom-1',
				'provider-1', 'ready', 'invite-1', 'claim-1');
			INSERT INTO studio_invite_redemptions
				(token_hash, user_id, state, claim_id, finalized_at)
			VALUES ('invite-1', 'user-1', 'pending', 'claim-1', NULL);
		`);

		const pending = applyPendingMigrations(db);
		expect(pending).not.toContain("0004_participant_provisioning.sql");
		expect(pending).toContain("0006_realtimekit_participant_identity.sql");
		expect(db.prepare(`SELECT name, realtimekit_custom_participant_id,
			realtimekit_participant_id, provisioning_state, invite_token_hash, invite_claim_id
			FROM studio_participants`).get()).toMatchObject({
			name: "Guest", realtimekit_custom_participant_id: "custom-1",
			realtimekit_participant_id: "provider-1", provisioning_state: "ready",
			invite_token_hash: "invite-1", invite_claim_id: "claim-1",
		});
		expect(db.prepare("SELECT state, claim_id, finalized_at FROM studio_invite_redemptions").get())
			.toMatchObject({ state: "pending", claim_id: "claim-1", finalized_at: null });
		expect(indexSql(db, "studio_participants_realtimekit_identity_idx")).toContain("realtimekit_custom_participant_id");
		expect(indexSql(db, "studio_participants_realtimekit_participant_id_idx")).toContain("realtimekit_participant_id");
		expect(() => db.exec(`INSERT INTO studio_participants
			(session_id, user_id, role, name, realtimekit_participant_id)
			VALUES ('session-1', 'user-2', 'guest', 'Other', 'provider-1')`))
			.toThrow(/UNIQUE constraint failed/);
	});

	it("fails the new identity index without deleting duplicate production-shaped rows", () => {
		const db = createDatabase();
		applyOriginalMigrations(db);
		addObservedProductionSchema(db);
		insertSession(db);
		db.exec(`
			INSERT INTO studio_participants (session_id, user_id, role, name, realtimekit_participant_id)
			VALUES ('session-1', 'user-1', 'guest', 'First', 'duplicate'),
			       ('session-1', 'user-2', 'guest', 'Second', 'duplicate');
		`);

		expect(() => applyPendingMigrations(db)).toThrow(/UNIQUE constraint failed/);
		expect(db.prepare("SELECT COUNT(*) AS count FROM studio_participants").get()).toMatchObject({ count: 2 });
		expect(indexSql(db, "studio_participants_realtimekit_participant_id_idx")).toBeUndefined();
		expect(db.prepare("SELECT name FROM d1_migrations WHERE name = ?")
			.get("0006_realtimekit_participant_identity.sql")).toBeUndefined();
	});

	it("fails closed when an old 0006 was applied without the recorded 0004", () => {
		const db = createDatabase();
		applyOriginalMigrations(db);
		db.exec(`
			ALTER TABLE studio_participants ADD COLUMN realtimekit_participant_id TEXT;
			CREATE UNIQUE INDEX studio_participants_realtimekit_participant_id_idx
				ON studio_participants (session_id, realtimekit_participant_id)
				WHERE realtimekit_participant_id IS NOT NULL;
		`);
		db.prepare("INSERT INTO d1_migrations (name) VALUES (?)")
			.run("0006_realtimekit_participant_identity.sql");

		expect(() => applyPendingMigrations(db)).toThrow(/duplicate column name/);
		expect(db.prepare("PRAGMA table_info(studio_participants)").all()
			.some((column) => column.name === "realtimekit_custom_participant_id")).toBe(false);
		expect(db.prepare("SELECT name FROM d1_migrations WHERE name = ?")
			.get("0004_participant_provisioning.sql")).toBeUndefined();
	});
});
