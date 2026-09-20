export type ArcadeRole = "host" | "producer" | "player" | "audience" | "display";

export type RoomBootstrap = {
	roomId: string;
	wsTicket: string;
	socketUrl: string;
	role: ArcadeRole;
	code?: string;
};

export const joinBootstrapKey = "rawkode-arcade-join-bootstrap";
export const hostBootstrapKey = "rawkode-arcade-host-bootstrap";

export function isBootstrap(value: unknown): value is RoomBootstrap {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<RoomBootstrap>;
	return Boolean(
		candidate.roomId &&
			candidate.wsTicket &&
			candidate.socketUrl &&
			candidate.role,
	);
}

/** Tickets may be held only long enough to mount their owning live route. */
export function consumeBootstrap(
	key: string,
	validate: (value: RoomBootstrap) => boolean,
): RoomBootstrap | undefined {
	try {
		const raw = sessionStorage.getItem(key);
		sessionStorage.removeItem(key);
		const value: unknown = raw ? JSON.parse(raw) : undefined;
		return isBootstrap(value) && validate(value) ? value : undefined;
	} catch {
		sessionStorage.removeItem(key);
		return undefined;
	}
}

export async function requestJoin(
	code: string,
	input: { displayName?: string; teamId?: string; desiredRole?: ArcadeRole },
): Promise<RoomBootstrap> {
	const response = await fetch(`/api/join/${encodeURIComponent(code)}`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		credentials: "same-origin",
		body: JSON.stringify(input),
	});
	if (!response.ok)
		throw new Error("That room is unavailable. Check the code and try again.");
	const value: unknown = await response.json();
	if (!isBootstrap(value))
		throw new Error("The room did not return a valid live connection.");
	// Deliberately discard any legacy aliases or server metadata before this
	// short-lived object reaches reactive state or session storage.
	return {
		roomId: value.roomId,
		wsTicket: value.wsTicket,
		socketUrl: value.socketUrl,
		role: value.role,
	};
}

export async function requestExistingRoom(roomId: string): Promise<RoomBootstrap> {
	const membership = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/membership`, { credentials: "same-origin" });
	if (!membership.ok) throw new Error("This account is not authorized for the room.");
	const member = (await membership.json()) as { role?: ArcadeRole };
	if (member.role !== "host" && member.role !== "producer") throw new Error("Producer access is required for this room.");
	const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/ws-ticket`, { method: "POST", credentials: "same-origin" });
	if (!response.ok) throw new Error("Unable to renew the producer connection.");
	const value = (await response.json()) as { ticket?: string };
	if (!value.ticket) throw new Error("The room did not return a valid live connection.");
	return { roomId, wsTicket: value.ticket, socketUrl: `/api/rooms/${roomId}/socket`, role: member.role };
}
