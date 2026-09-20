import type { Env } from "../env";
import type { Role } from "../domain/protocol";
import { randomId } from "./crypto";

export interface RoomRecord { id: string; gameKey: string; title: string; status: string; contentRevisionId?: string; createdAt: string; }

export class RoomDirectory {
	constructor(private readonly env: Env) {}

	async create(gameKey: string, title: string, createdBy?: string, contentRevisionId?: string): Promise<RoomRecord> {
		const id = randomId("room");
		const createdAt = new Date().toISOString();
		await this.env.DB.prepare("INSERT INTO arcade_room_directory (id, game_key, content_revision_id, title, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'lobby', ?, ?, ?)")
			.bind(id, gameKey, contentRevisionId ?? null, title.slice(0, 120), createdBy ?? null, createdAt, createdAt).run();
		return { id, gameKey, title: title.slice(0, 120), status: "lobby", contentRevisionId, createdAt };
	}

	async get(id: string): Promise<RoomRecord | undefined> {
		const row = await this.env.DB.prepare("SELECT id, game_key, title, status, content_revision_id, created_at FROM arcade_room_directory WHERE id = ?").bind(id).first<{ id: string; game_key: string; title: string; status: string; content_revision_id: string | null; created_at: string }>();
		if (!row) return undefined;
		return { id: row.id, gameKey: row.game_key, title: row.title, status: row.status, contentRevisionId: row.content_revision_id ?? undefined, createdAt: row.created_at };
	}

	stub(id: string): DurableObjectStub { return this.env.GAME_ROOM.get(this.env.GAME_ROOM.idFromName(id)); }

	async createInvite(roomId: string, role: Role, expiresAt: string): Promise<string> {
		const code = randomId("invite");
		await this.env.DB.prepare("INSERT INTO arcade_room_invites (code, room_id, role, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
			.bind(code, roomId, role, expiresAt, new Date().toISOString()).run();
		return code;
	}

	async redeemInvite(code: string): Promise<{ code: string; roomId: string; role: Role } | undefined> {
		// Join forms may normalize manually entered codes. Codes are opaque but
		// hex-only generated IDs are safely case-insensitive at this boundary.
		const row = await this.env.DB.prepare("SELECT code, room_id, role FROM arcade_room_invites WHERE code = ? COLLATE NOCASE AND expires_at > ?")
			.bind(code, new Date().toISOString()).first<{ code: string; room_id: string; role: Role }>();
		if (!row) return undefined;
		return { code: row.code, roomId: row.room_id, role: row.role };
	}

	async consumeInvite(code: string, principalId: string): Promise<{ roomId: string; role: Role } | undefined> {
		const invite = await this.redeemInvite(code);
		if (!invite) return undefined;
		await this.env.DB.prepare("INSERT OR IGNORE INTO arcade_room_invite_uses (invite_code, principal_id, used_at) VALUES (?, ?, ?)")
			.bind(invite.code, principalId, new Date().toISOString()).run();
		return { roomId: invite.roomId, role: invite.role };
	}

	/** Records the server-chosen role/team; clients cannot elevate it by editing a ticket. */
	async admit(roomId: string, principal: { id: string; role: Role; teamId?: string; displayName?: string }): Promise<void> {
		const now = new Date().toISOString();
		await this.env.DB.prepare("INSERT INTO arcade_room_memberships (room_id, principal_id, role, team_id, display_name, joined_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(room_id, principal_id) DO UPDATE SET role = excluded.role, team_id = excluded.team_id, display_name = excluded.display_name, updated_at = excluded.updated_at")
			.bind(roomId, principal.id, principal.role, principal.teamId ?? null, principal.displayName ?? null, now, now).run();
	}

	async presence(roomId: string): Promise<Array<{ principalId: string; role: Role; teamId?: string; displayName?: string; shardId?: string; connections: number; lastSeenAt: string }>> {
		const rows = await this.env.DB.prepare("SELECT p.principal_id, p.role, p.shard_id, p.connections, p.last_seen_at, m.team_id, m.display_name FROM arcade_room_presence p LEFT JOIN arcade_room_memberships m ON m.room_id = p.room_id AND m.principal_id = p.principal_id WHERE p.room_id = ? ORDER BY p.last_seen_at DESC")
			.bind(roomId).all<{ principal_id: string; role: Role; shard_id: string | null; connections: number; last_seen_at: string; team_id: string | null; display_name: string | null }>();
		return rows.results.map((row) => ({ principalId: row.principal_id, role: row.role, teamId: row.team_id ?? undefined, displayName: row.display_name ?? undefined, shardId: row.shard_id ?? undefined, connections: row.connections, lastSeenAt: row.last_seen_at }));
	}

	async membership(roomId: string, principalId: string): Promise<{ role: Role; teamId?: string; displayName?: string } | undefined> {
		const row = await this.env.DB.prepare("SELECT role, team_id, display_name FROM arcade_room_memberships WHERE room_id = ? AND principal_id = ?")
			.bind(roomId, principalId).first<{ role: Role; team_id: string | null; display_name: string | null }>();
		return row ? { role: row.role, teamId: row.team_id ?? undefined, displayName: row.display_name ?? undefined } : undefined;
	}
}
