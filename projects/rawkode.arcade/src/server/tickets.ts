import type { Principal } from "../domain/protocol";
import type { Env } from "../env";
import { signJson, verifyJson } from "./crypto";

export interface RoomTicket { roomId: string; principal: Principal; exp: number; nonce: string; }

export async function issueRoomTicket(env: Env, roomId: string, principal: Principal): Promise<string> {
	return signJson({ roomId, principal, exp: Date.now() + 1000 * 60 * 5, nonce: crypto.randomUUID() } satisfies RoomTicket, env.TICKET_SECRET);
}

export async function verifyRoomTicket(env: Env, token: string | null, roomId: string): Promise<RoomTicket | undefined> {
	if (!token) return undefined;
	const ticket = await verifyJson<RoomTicket>(token, env.TICKET_SECRET);
	if (!ticket || ticket.exp <= Date.now() || ticket.roomId !== roomId) return undefined;
	return ticket;
}
