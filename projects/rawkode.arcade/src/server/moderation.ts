import type { Env } from "../env";
import { randomId } from "./crypto";

export class ModerationService {
	constructor(private readonly env: Env) {}

	async record(roomId: string, actorId: string, action: string, targetId?: string, reason?: string): Promise<void> {
		await this.env.DB.prepare(
			"INSERT INTO arcade_moderation_actions (id, room_id, actor_id, action, target_id, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		).bind(randomId("mod"), roomId, actorId, action, targetId ?? null, reason?.slice(0, 500) ?? null, new Date().toISOString()).run();
	}
}
