import type { Env } from "../env";
import { randomId } from "./crypto";

export class ResultProjector {
	constructor(private readonly env: Env) {}

	async project(roomId: string, gameKey: string, scores: Array<{ principalId: string; teamId?: string; score: number }>, contentRevisionId?: string, seasonId?: string): Promise<void> {
		// A completed room is immutable: the insert is the idempotency gate, not a
		// preceding read (which would race two outbox consumers).
		if (await this.env.DB.prepare("SELECT id FROM arcade_completed_games WHERE room_id = ?").bind(roomId).first<{ id: string }>()) return;
		const completedAt = new Date().toISOString();
		const checksum = await this.checksum(JSON.stringify({ roomId, gameKey, scores }));
		// D1 batch is transactional: never make completion visible until every
		// result (and seasonal projection) is durable. A retry after any failure
		// therefore sees no completed row and repeats the whole projection.
		const statements: D1PreparedStatement[] = [this.env.DB.prepare(
			"INSERT INTO arcade_completed_games (id, room_id, game_key, content_revision_id, season_id, completed_at, result_checksum) VALUES (?, ?, ?, ?, ?, ?, ?)",
		).bind(randomId("game"), roomId, gameKey, contentRevisionId ?? null, seasonId ?? null, completedAt, checksum)];
		statements.push(...scores.map((entry) => this.env.DB.prepare(
			"INSERT OR REPLACE INTO arcade_results (room_id, principal_id, team_id, game_key, score, completed_at) VALUES (?, ?, ?, ?, ?, ?)",
		).bind(roomId, entry.principalId, entry.teamId ?? null, gameKey, entry.score, completedAt)));
		if (seasonId) statements.push(...scores.map((entry) => this.env.DB.prepare("INSERT INTO arcade_leaderboard_entries (season_id, game_key, principal_id, team_id, score, games_played, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?) ON CONFLICT(season_id, game_key, principal_id) DO UPDATE SET score = score + excluded.score, games_played = games_played + 1, updated_at = excluded.updated_at")
			.bind(seasonId, gameKey, entry.principalId, entry.teamId ?? null, entry.score, completedAt)));
		await this.env.DB.batch(statements);
	}

	async consumeOutbox(limit = 100): Promise<number> {
		const rows = await this.env.DB.prepare("SELECT o.id, o.payload_json FROM arcade_room_outbox o LEFT JOIN arcade_room_outbox_projections p ON p.outbox_id = o.id WHERE o.kind = 'result.completed' AND p.outbox_id IS NULL ORDER BY o.occurred_at LIMIT ?")
			.bind(limit).all<{ id: string; payload_json: string }>();
		for (const row of rows.results) {
			const payload = JSON.parse(row.payload_json) as { roomId: string; gameKey: string; teams: Array<{ id: string; score: number }> };
			await this.project(payload.roomId, payload.gameKey, payload.teams.map((team) => ({ principalId: team.id, teamId: team.id, score: team.score })));
			await this.env.DB.prepare("INSERT OR IGNORE INTO arcade_room_outbox_projections (outbox_id, projected_at) VALUES (?, ?)").bind(row.id, new Date().toISOString()).run();
		}
		return rows.results.length;
	}

	private async checksum(value: string): Promise<string> {
		const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
		return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
	}
}
