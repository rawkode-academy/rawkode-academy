import type { Env } from "../env";

export interface StudioShow {
	id: string;
	title: string;
	show: string;
	startsAt: string;
}

export interface LiveStudioShow extends StudioShow {
	startedAt: number | null;
	playbackUrl: string;
}

export interface StudioLineup {
	live: LiveStudioShow | null;
	upcoming: StudioShow[];
}

export interface ShowParticipation {
	studioSessionId: string;
	roomId: string;
	gameKey: string;
	enabled: boolean;
}

const lineupUrl = "https://studio.internal/api/studio/show-lineup";

function isShow(value: unknown): value is StudioShow {
	if (!value || typeof value !== "object") return false;
	const show = value as Partial<StudioShow>;
	return typeof show.id === "string" && !!show.id && typeof show.title === "string" &&
		typeof show.show === "string" && typeof show.startsAt === "string";
}

export async function loadStudioLineup(env: Env): Promise<StudioLineup | undefined> {
	if (!env.STUDIO) return undefined;
	try {
		const response = await env.STUDIO.fetch(lineupUrl);
		if (!response.ok) return undefined;
		const value = await response.json() as { live?: unknown; upcoming?: unknown };
		if (!Array.isArray(value.upcoming)) return undefined;
		const upcoming = value.upcoming.filter(isShow);
		let live: LiveStudioShow | null = null;
		if (isShow(value.live)) {
			const candidate = value.live as LiveStudioShow;
			if (typeof candidate.playbackUrl === "string" && /^https:\/\//.test(candidate.playbackUrl)) {
				live = { ...candidate, startedAt: typeof candidate.startedAt === "number" ? candidate.startedAt : null };
			}
		}
		return { live, upcoming };
	} catch {
		return undefined;
	}
}

export async function showParticipation(env: Env, studioSessionId: string): Promise<ShowParticipation | undefined> {
	const row = await env.DB.prepare(`SELECT p.studio_session_id, p.room_id, p.enabled, r.game_key
		FROM arcade_show_participation p JOIN arcade_room_directory r ON r.id = p.room_id
		WHERE p.studio_session_id = ?`).bind(studioSessionId)
		.first<{ studio_session_id: string; room_id: string; enabled: number; game_key: string }>();
	return row ? { studioSessionId: row.studio_session_id, roomId: row.room_id, enabled: row.enabled === 1, gameKey: row.game_key } : undefined;
}

/** Fail closed if Studio is unavailable, the show ended, or participation is off. */
export async function roomAcceptsPublicParticipation(env: Env, roomId: string): Promise<boolean> {
	if (env.ENVIRONMENT === "test") return true;
	const row = await env.DB.prepare("SELECT studio_session_id FROM arcade_show_participation WHERE room_id = ? AND enabled = 1")
		.bind(roomId).first<{ studio_session_id: string }>();
	if (!row) return false;
	const lineup = await loadStudioLineup(env);
	return lineup?.live?.id === row.studio_session_id;
}
