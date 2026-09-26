import type { Env } from "../env";

export interface LeaderboardEntry { principalId: string; teamId: string | null; score: number; rank: number; }

export class Leaderboards {
	constructor(private readonly env: Env) {}

	async forGame(gameKey: string, limit = 50): Promise<LeaderboardEntry[]> {
		const result = await this.env.DB.prepare(
			"SELECT principal_id, team_id, score, RANK() OVER (ORDER BY score DESC, completed_at ASC) AS rank FROM arcade_results WHERE game_key = ? ORDER BY score DESC, completed_at ASC LIMIT ?",
		).bind(gameKey, Math.min(Math.max(limit, 1), 100)).all<{ principal_id: string; team_id: string | null; score: number; rank: number }>();
		return result.results.map((row) => ({ principalId: row.principal_id, teamId: row.team_id, score: row.score, rank: row.rank }));
	}

	async forRoom(roomId: string): Promise<LeaderboardEntry[]> {
		const result = await this.env.DB.prepare("SELECT principal_id, team_id, score, RANK() OVER (ORDER BY score DESC, principal_id) AS rank FROM arcade_results WHERE room_id = ? ORDER BY score DESC, principal_id").bind(roomId).all<{ principal_id: string; team_id: string | null; score: number; rank: number }>();
		return result.results.map((row) => ({ principalId: row.principal_id, teamId: row.team_id, score: row.score, rank: row.rank }));
	}
}
