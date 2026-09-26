import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { gameById, type GameId } from "@/lib/game-catalogue";
import { projectRoundProgress } from "@/lib/round-progress";
import { viewScopeHeaders, type ScopedViewRole } from "@/lib/view-scope";
import {
	acceptsDeliverySequence,
	acceptsRoomVersion,
} from "@/lib/version-guard";
import type {
	CommandEnvelope,
	ConnectionState,
	PublicRoomState,
	RoomSocketPort,
	ServerEnvelope,
} from "@/lib/live-contract";

/** A safe loading projection. Authoritative snapshots always replace this value. */
const initialRoom = (
	game: GameId,
	roomId = "pending-room",
	roomCode = "…",
): PublicRoomState => ({
	roomId,
	roomCode,
	game,
	version: 0,
	phase: "lobby",
	questionNumber: 0,
	questionTotal: 0,
	teams: [],
	leaderboard: [],
	audienceCount: 0,
	audienceResponseCount: 0,
	audienceFrozen: false,
	connection: "connecting",
	serverNow: new Date().toISOString(),
});

/**
 * Durable Object adapter. Tickets are supplied as a subprotocol so they never
 * appear in URLs, browser history, referrers, or ordinary request logs.
 */
export const createWebSocketPort = (): RoomSocketPort => {
	let socket: WebSocket | undefined;
	return {
		connect({ roomId, ticket, socketUrl, onMessage, onConnection }) {
			if (!ticket || typeof window === "undefined") {
				onConnection("offline");
				return () => undefined;
			}
			onConnection("connecting");
			const url = new URL(
				socketUrl ?? `/api/rooms/${encodeURIComponent(roomId)}/socket`,
				window.location.origin,
			);
			url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
			socket = new WebSocket(url, `arcade-ticket.${ticket}`);
			socket.onopen = () => onConnection("connected");
			socket.onclose = () => onConnection("reconnecting");
			socket.onerror = () => onConnection("offline");
			socket.onmessage = (event) => {
				try {
					onMessage(JSON.parse(String(event.data)) as ServerEnvelope);
				} catch {
					onConnection("offline");
				}
			};
			return () => socket?.close();
		},
		send(envelope) {
			if (socket?.readyState === WebSocket.OPEN)
				socket.send(JSON.stringify(envelope));
		},
	};
};

const isGameId = (value: unknown): value is GameId =>
	typeof value === "string" &&
	[
		"merge-conflict",
		"spinlock",
		"principal-engineer",
		"race-condition",
		"ten-nines",
		"null-pointer",
	].includes(value);
const asRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" ? (value as Record<string, unknown>) : {};

/**
 * Audience votes travel through a durable admission queue. `audience.queued`
 * only means the shard received the command; it is deliberately not a UI
 * success state. A later `audience.accepted` or command-scoped error settles
 * the pending control. Other command events are authoritative game commands.
 */
export function commandSettlement(message: ServerEnvelope):
	| "pending"
	| "accepted"
	| "rejected"
	| undefined {
	if (message.type !== "event" && message.type !== "error") return undefined;
	if (!message.commandId) return undefined;
	if (message.type === "error") return "rejected";
	if (message.type !== "event") return undefined;
	if (message.event === "audience.queued") return "pending";
	if (message.event === "audience.accepted") return "accepted";
	return message.event.startsWith("audience.") ? undefined : "accepted";
}

function publicPrompt(active: Record<string, unknown>) {
	if (typeof active.prompt !== "string") return undefined;
	const choices = Array.isArray(active.choices)
		? active.choices.flatMap((choice) => {
				const item = asRecord(choice);
				return typeof item.id === "string" && typeof item.label === "string"
					? [{ id: item.id, label: item.label }]
					: [];
			})
		: [];
	return {
		id: typeof active.id === "string" ? active.id : "prompt",
		label: typeof active.label === "string" ? active.label : "Live prompt",
		text: active.prompt,
		choices,
	};
}

/** Validate the reducer's game-specific projection at the browser boundary. */
export function mapPublicGameBoard(value: unknown): PublicRoomState["gameBoard"] {
	const board = asRecord(value);
	if (board.kind === "merge-conflict" && typeof board.total === "number") {
		const entries = Array.isArray(board.entries)
			? board.entries.flatMap((entry) => {
				const item = asRecord(entry);
				return typeof item.rank === "number" && typeof item.revealed === "boolean"
					? [{
						rank: item.rank,
						revealed: item.revealed,
						...(item.revealed && typeof item.label === "string" ? { label: item.label } : {}),
					}]
					: [];
			})
			: [];
		return { mergeConflict: { entries, total: board.total } };
	}
	if (
		board.kind === "spinlock" &&
		typeof board.board === "string" &&
		typeof board.activeValue === "number"
	)
		return {
			spinlock: {
				board: board.board,
				letters: Array.isArray(board.letters)
					? board.letters.filter((letter): letter is string => typeof letter === "string")
					: [],
				activeValue: board.activeValue,
				...(typeof board.turn === "number" ? { turn: board.turn } : {}),
			},
		};
	if (
		board.kind === "principal-engineer" &&
		typeof board.index === "number" &&
		typeof board.total === "number"
	)
		return { principalEngineer: { index: board.index, total: board.total } };
	if (
		board.kind === "race-condition" &&
		typeof board.playerPosition === "number" &&
		typeof board.chaserPosition === "number" &&
		typeof board.total === "number"
	) {
		const teamPositions = Object.fromEntries(
			Object.entries(asRecord(board.teamPositions)).flatMap(
				([teamId, position]) =>
					typeof position === "number" ? [[teamId, position]] : [],
			),
		);
		return {
			raceCondition: {
				teamPositions,
				playerPosition: board.playerPosition,
				chaserPosition: board.chaserPosition,
				total: board.total,
			},
		};
	}
	if (
		board.kind === "ten-nines" &&
		Array.isArray(board.found) &&
		typeof board.total === "number"
	)
		return {
			tenNines: {
				found: board.found.filter((entry): entry is string => typeof entry === "string"),
				total: board.total,
			},
		};
	if (board.kind === "null-pointer") {
		const distribution = Array.isArray(board.distribution)
			? board.distribution.flatMap((entry) => {
				const item = asRecord(entry);
				return typeof item.label === "string" && typeof item.count === "number"
					? [{ label: item.label, count: item.count }]
					: [];
			})
			: [];
		return { nullPointer: { distribution } };
	}
	return {};
}

export function normalizeRoomSnapshot(
	message: Extract<ServerEnvelope, { type: "snapshot" }>,
	fallback: PublicRoomState,
): PublicRoomState {
	const state = asRecord(message.state);
	if ("roomCode" in state && "game" in state)
		return {
			...(state as PublicRoomState),
			version: message.version,
			connection: fallback.connection,
			serverNow: message.serverTime,
		};
	const game = isGameId(state.gameKey) ? state.gameKey : fallback.game;
	const teams = Object.entries(asRecord(state.teams)).map(
		([id, value], index) => {
			const team = asRecord(value);
			return {
				id,
				name: typeof team.name === "string" ? team.name : id,
				score: typeof team.score === "number" ? team.score : 0,
			};
		},
	);
	const active = asRecord(state.activePrompt);
	const audience = asRecord(state.audience);
	const audienceDistribution = asRecord(state.audienceDistribution);
	const spinlock = asRecord(state.spinlock);
	const principalEngineer = asRecord(state.principalEngineer);
	const gameBoard = mapPublicGameBoard(state.gameBoard);
	const roundProgress = projectRoundProgress(asRecord(state.round), state.phase);
	const audienceResponseCount = Object.values(asRecord(audience.totals)).reduce<number>(
		(total, value) => (typeof value === "number" ? total + value : total),
		0,
	);
	const audienceFrozen = audience.frozen === true;
	return {
		...fallback,
		roomId: typeof state.roomId === "string" ? state.roomId : fallback.roomId,
		roomCode:
			typeof state.roomCode === "string" ? state.roomCode : fallback.roomCode,
		game,
		version: message.version,
		questionNumber: roundProgress.questionNumber,
		questionTotal: roundProgress.questionTotal,
		phase:
			state.status === "complete"
				? "complete"
				: state.status === "lobby"
					? "lobby"
					: roundProgress.phase,
		prompt: publicPrompt(active),
		teams,
		audienceCount:
			typeof state.audienceCount === "number" ? state.audienceCount : 0,
		audienceResponseCount,
		audienceFrozen,
		gameBoard,
		// Aggregates stay available to the host for pacing, but bins are only
		// rendered to the broadcast UI after the server freezes the distribution.
		audienceDistribution:
			audienceFrozen && Object.keys(audienceDistribution).length
				? Object.fromEntries(
						Object.entries(audienceDistribution).flatMap(([key, value]) =>
							typeof value === "number" ? [[key, value]] : [],
						),
					)
				: undefined,
		spinlock:
			typeof spinlock.board === "string" &&
			typeof spinlock.activeValue === "number"
				? {
					board: spinlock.board,
					letters: Array.isArray(spinlock.letters)
						? spinlock.letters.filter(
							(letter): letter is string => typeof letter === "string",
						)
						: [],
					activeValue: spinlock.activeValue,
					turn:
						typeof spinlock.turn === "number" ? spinlock.turn : 0,
					solved: spinlock.solved === true,
				}
				: undefined,
		principalEngineer:
			typeof principalEngineer.fiftyFiftyUsed === "boolean" &&
			typeof principalEngineer.askAudienceUsed === "boolean"
				? {
					fiftyFiftyUsed: principalEngineer.fiftyFiftyUsed,
					askAudienceUsed: principalEngineer.askAudienceUsed,
					fiftyFiftyActive: principalEngineer.fiftyFiftyActive === true,
					askAudienceActive: principalEngineer.askAudienceActive === true,
					eliminatedChoiceIds: Array.isArray(principalEngineer.eliminatedChoiceIds)
						? principalEngineer.eliminatedChoiceIds.filter((choice): choice is string => typeof choice === "string")
						: [],
					audienceAdvice: Object.fromEntries(Object.entries(asRecord(principalEngineer.audienceAdvice)).flatMap(([choice, total]) => typeof total === "number" ? [[choice, total]] : [])),
				}
				: undefined,
		buzzerWinner:
			typeof state.buzzerWinner === "string" ? state.buzzerWinner : undefined,
		revealedAnswer:
			typeof state.revealedAnswer === "string"
				? state.revealedAnswer
				: undefined,
		serverNow: message.serverTime,
	};
}

export function useRoomSocket(
	input: {
		game?: GameId;
		roomId?: string;
		roomCode?: string;
		ticket?: string;
		socketUrl?: string;
		isHost?: boolean;
		/** Keep a lower-scoped audience/display tab downscoped after reconnect. */
		viewRole?: ScopedViewRole;
	} = {},
) {
	const game = input.game ?? "merge-conflict";
	const room = ref<PublicRoomState>(
		initialRoom(game, input.roomId, input.roomCode),
	);
	const connection = ref<ConnectionState>("connecting");
	const lastError = ref("");
	const lastErrorCommandId = ref("");
	const lastAcceptedCommandId = ref("");
	const hostPrivateMarker = ref("");
	const reconnectAttempt = ref(0);
	let activeTicket = input.ticket;
	let latestDeliverySequence = -1;
	let stop: (() => void) | undefined;
	let retryTimer: ReturnType<typeof setTimeout> | undefined;
	let disposed = false;
	const port = createWebSocketPort();
	const gameDefinition = computed(() => gameById(room.value.game));
	const isLive = computed(() => connection.value === "connected");
	const send = (type: string, payload: Record<string, unknown> = {}) => {
		const envelope: CommandEnvelope = {
			v: 1,
			id: crypto.randomUUID(),
			type,
			expectedVersion: room.value.version,
			payload,
			sentAt: new Date().toISOString(),
		};
		port.send(envelope);
		return envelope;
	};
	const apply = (message: ServerEnvelope) => {
		if (message.type === "snapshot") {
			if (typeof message.deliverySequence === "number") {
				if (
					!acceptsDeliverySequence(
						latestDeliverySequence,
						message.deliverySequence,
					)
				)
					return;
				latestDeliverySequence = message.deliverySequence;
			} else if (!acceptsRoomVersion(room.value.version, message.version))
				return;
			room.value = normalizeRoomSnapshot(message, room.value);
			if (input.isHost) {
				const privateState = asRecord(asRecord(message.state).private);
				hostPrivateMarker.value =
					typeof privateState.e2ePrivateMarker === "string"
						? privateState.e2ePrivateMarker
						: "";
			}
			try {
				sessionStorage.setItem(
					"rawkode-arcade-last-room",
					JSON.stringify({
						roomId: room.value.roomId,
						gameKey: room.value.game,
					}),
				);
			} catch {
				/* Storage is optional; socket state remains authoritative. */
			}
		}
		if (message.type === "event") {
			if (acceptsRoomVersion(room.value.version, message.version))
				room.value = { ...room.value, version: message.version };
			if (commandSettlement(message) === "accepted" && message.commandId)
				lastAcceptedCommandId.value = message.commandId;
		}
		if (message.type === "error") {
			lastError.value = message.message;
			if (commandSettlement(message) === "rejected")
				lastErrorCommandId.value = message.commandId ?? "";
		}
	};
	const roomId = () => input.roomId ?? room.value.roomId;
	const refreshSnapshot = async () => {
		try {
			const response = await fetch(
				`/api/rooms/${encodeURIComponent(roomId())}/state`,
				{ credentials: "same-origin", headers: viewScopeHeaders(input.viewRole) },
			);
			if (response.ok) apply((await response.json()) as ServerEnvelope);
		} catch {
			/* A fresh socket snapshot remains the recovery fallback. */
		}
	};
	const requestReticket = async () => {
		const response = await fetch(
			`/api/rooms/${encodeURIComponent(roomId())}/ws-ticket`,
			{
				method: "POST",
				credentials: "same-origin",
				headers: viewScopeHeaders(input.viewRole),
			},
		);
		if (!response.ok)
			throw new Error(
				"Your live session expired. Rejoin the room to continue.",
			);
		const value = (await response.json()) as {
			ticket?: string;
			wsTicket?: string;
		};
		const ticket = value.wsTicket ?? value.ticket;
		if (!ticket)
			throw new Error(
				"The room did not issue a replacement connection ticket.",
			);
		activeTicket = ticket;
	};
	const scheduleReconnect = () => {
		if (disposed || retryTimer) return;
		const delay = Math.min(1_000 * 2 ** reconnectAttempt.value, 15_000);
		retryTimer = setTimeout(async () => {
			retryTimer = undefined;
			try {
				await requestReticket();
				reconnectAttempt.value += 1;
				connect(false);
			} catch (cause) {
				lastError.value =
					cause instanceof Error
						? cause.message
						: "Unable to restore the live connection.";
				connection.value = "offline";
				scheduleReconnect();
			}
		}, delay);
	};
	const connect = async (renew = false) => {
		if (retryTimer) {
			clearTimeout(retryTimer);
			retryTimer = undefined;
		}
		stop?.();
		if (renew) await requestReticket();
		lastError.value = "";
		stop = port.connect({
			roomId: roomId(),
			ticket: activeTicket,
			socketUrl: input.socketUrl,
			onMessage: apply,
			onConnection: (state) => {
				connection.value = state;
				room.value = { ...room.value, connection: state };
				if (state === "connected") {
					reconnectAttempt.value = 0;
					void refreshSnapshot();
				}
				if (state === "reconnecting" || state === "offline")
					scheduleReconnect();
			},
		});
	};
	onMounted(() => void connect());
	onBeforeUnmount(() => {
		disposed = true;
		if (retryTimer) clearTimeout(retryTimer);
		stop?.();
	});
	return {
		room,
		connection,
		gameDefinition,
		isLive,
		lastError,
		lastErrorCommandId,
		lastAcceptedCommandId,
		hostPrivateMarker,
		send,
		reconnect: () => connect(true),
	};
}
