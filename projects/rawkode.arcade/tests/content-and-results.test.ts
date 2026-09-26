import { describe, expect, test } from "bun:test";
import type { Env } from "../src/env";
import { ContentRepository, ContentValidationError } from "../src/server/content";
import { ResultProjector } from "../src/server/results";

describe("content repository validation", () => {
	test("rejects invalid pack and revision input before persistence", async () => {
		const repository = new ContentRepository();
		await expect(
			repository.createPack({ gameKey: "unknown", slug: "bad", title: "Bad" }, "operator"),
		).rejects.toBeInstanceOf(ContentValidationError);
		await expect(repository.createRevision("pack", [], "operator")).rejects.toBeInstanceOf(
			ContentValidationError,
		);
	});
});

describe("Cloudflare release ordering", () => {
	test("keeps admission closed through remote migration and credential installation", async () => {
		const source = await Bun.file(
			new URL("../scripts/deploy-cloudflare.ts", import.meta.url),
		).text();
		const findAfter = (pattern: RegExp, offset: number) => {
			const match = pattern.exec(source.slice(Math.max(0, offset)));
			return match ? Math.max(0, offset) + match.index : -1;
		};
		const closed = source.indexOf('ADMISSION_ENABLED = "false"');
		const firstDeploy = findAfter(/"deploy"\s*,\s*"--config"/, closed);
		const migration = findAfter(/"d1"\s*,\s*"migrations"\s*,\s*"apply"/, firstDeploy);
		const secrets = findAfter(/"secret"\s*,\s*"bulk"/, firstDeploy);
		const opened = source.indexOf('ADMISSION_ENABLED = "true"', migration);
		const finalDeploy = findAfter(/"deploy"\s*,\s*"--config"/, opened);

		expect(closed).toBeGreaterThan(-1);
		expect(firstDeploy).toBeGreaterThan(closed);
		expect(migration).toBeGreaterThan(firstDeploy);
		expect(secrets).toBeGreaterThan(firstDeploy);
		expect(secrets).toBeLessThan(opened);
		expect(opened).toBeGreaterThan(migration);
		expect(finalDeploy).toBeGreaterThan(opened);
	});
});

describe("result projection", () => {
	test("does not apply an outbox retry twice", async () => {
		const completed = new Set<string>();
		let resultWrites = 0;
		const database = {
			prepare: (sql: string) => ({
				bind: (...values: unknown[]) => ({
					first: async () => sql.includes("arcade_completed_games WHERE room_id") ? (completed.has(String(values[0])) ? { id: "game" } : null) : null,
					run: async () => {
						if (sql.includes("INSERT INTO arcade_completed_games")) completed.add(String(values[1]));
						if (sql.includes("INSERT OR REPLACE INTO arcade_results")) resultWrites += 1;
					},
				}),
			}),
			batch: async (statements: Array<{ run: () => Promise<void> }>) => { await Promise.all(statements.map((statement) => statement.run())); },
		};
		const projector = new ResultProjector({ DB: database } as unknown as Env);
		await projector.project("room-1", "spinlock", [{ principalId: "player-1", teamId: "red", score: 500 }]);
		await projector.project("room-1", "spinlock", [{ principalId: "player-1", teamId: "red", score: 500 }]);
		expect(resultWrites).toBe(1);
	});

	test("retries a failed atomic completion without losing its result", async () => {
		const completed = new Set<string>();
		let resultWrites = 0;
		let failOnce = true;
		const database = {
			prepare: (sql: string) => ({ bind: (...values: unknown[]) => ({
				first: async () => sql.includes("arcade_completed_games WHERE room_id") ? (completed.has(String(values[0])) ? { id: "game" } : null) : null,
				run: async () => { if (sql.includes("INSERT INTO arcade_completed_games")) completed.add(String(values[1])); if (sql.includes("arcade_results")) resultWrites += 1; },
			}) }),
			batch: async (statements: Array<{ run: () => Promise<void> }>) => {
				if (failOnce) { failOnce = false; throw new Error("simulated D1 transaction failure"); }
				await Promise.all(statements.map((statement) => statement.run()));
			},
		};
		const projector = new ResultProjector({ DB: database } as unknown as Env);
		await expect(projector.project("room-retry", "spinlock", [{ principalId: "player", score: 500 }])).rejects.toThrow("simulated D1 transaction failure");
		expect(completed.has("room-retry")).toBeFalse();
		await projector.project("room-retry", "spinlock", [{ principalId: "player", score: 500 }]);
		expect(resultWrites).toBe(1);
	});
});
