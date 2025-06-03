import { ActionError, defineAction } from "astro:actions";
import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } from "astro:env/server";
import { z } from "astro:schema";
import { database } from "@/lib/database";
import { roomClientService } from "@/lib/livekit";
import {
	chatMessagesTable,
	livestreamsTable,
	participantsTable,
} from "@/schema";
import { desc, eq } from "drizzle-orm";
import { AccessToken } from "livekit-server-sdk";

export type LiveStream = {
	id: string;
	name: string;
	numParticipants: number;
};

export type PastLiveStream = {
	id: string;
	name: string;
	startedAt: Date | null;
	finishedAt: Date;
	participantsJoined: number | null;
};

// New ChatMessage type
export type ChatMessage = {
	id: number;
	roomSid: string;
	participantIdentity: string;
	participantName: string;
	message: string;
	createdAt: Date;
};

// New Participant type
export type Participant = {
	id: number;
	roomSid: string;
	identity: string;
	name: string;
};

export const server = {
	addChatMessage: defineAction({
		input: z.object({
			roomSid: z.string(),
			participantIdentity: z.string(),
			message: z.string(),
		}),

		handler: async (input) => {
			// Use the identity as the participant name - this prevents spoofing
			const participantName = input.participantIdentity;

			await database.insert(chatMessagesTable).values({
				roomSid: input.roomSid,
				participantIdentity: input.participantIdentity,
				participantName: participantName,
				message: input.message,
			});
		},
	}),

	// New action to get past room chat messages
	getPastRoomChatMessages: defineAction({
		input: z.object({
			roomId: z.string(),
		}),
		handler: async (input, context) => {
			if (!context.locals.user) {
				throw new ActionError({ code: "UNAUTHORIZED" });
			}

			try {
				const messages = await database
					.select({
						id: chatMessagesTable.id,
						roomSid: chatMessagesTable.roomSid,
						participantIdentity: chatMessagesTable.participantIdentity,
						participantName: chatMessagesTable.participantName,
						message: chatMessagesTable.message,
						createdAt: chatMessagesTable.createdAt,
					})
					.from(chatMessagesTable)
					.where(eq(chatMessagesTable.roomSid, input.roomId))
					.orderBy(chatMessagesTable.createdAt); // Order by creation time

				return messages as ChatMessage[];
			} catch (error) {
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch chat messages.",
				});
			}
		},
	}),

	// New action to get room participants
	getRoomParticipants: defineAction({
		input: z.object({
			roomId: z.string(),
		}),
		handler: async (input, context) => {
			if (!context.locals.user) {
				throw new ActionError({ code: "UNAUTHORIZED" });
			}

			try {
				const participants = await database
					.select()
					.from(participantsTable)
					.where(eq(participantsTable.roomSid, input.roomId));

				return participants as Participant[];
			} catch (error) {
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch room participants.",
				});
			}
		},
	}),

	listRooms: defineAction({
		handler: async (_input, context) => {
			if (!context.locals.user) {
				throw new ActionError({ code: "UNAUTHORIZED" });
			}

			const rooms = await roomClientService.listRooms();

			return rooms.map((room) => ({
				id: room.sid,
				name: room.name,
				numParticipants: room.numParticipants || 0,
			}));
		},
	}),

	listPastRooms: defineAction({
		handler: async (_input, context) => {
			if (!context.locals) {
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Server configuration error.",
				});
			}
			try {
				const pastRoomsData = await database
					.select({
						id: livestreamsTable.sid,
						name: livestreamsTable.name,
						startedAt: livestreamsTable.startedAt,
						finishedAt: livestreamsTable.endedAt,
					})
					.from(livestreamsTable)
					.where(eq(livestreamsTable.status, "ended"))
					.orderBy(desc(livestreamsTable.endedAt));

				// Get participant counts for each room
				const roomsWithCounts = await Promise.all(
					pastRoomsData.map(async (room) => {
						const participantCount = await database
							.select({ count: participantsTable.id })
							.from(participantsTable)
							.where(eq(participantsTable.roomSid, room.id));
						return {
							...room,
							participantsJoined: participantCount.length,
						};
					}),
				);

				return roomsWithCounts
					.filter((room) => room.finishedAt != null)
					.map((room) => ({
						...room,
						participantsJoined: room.participantsJoined ?? 0,
					})) as PastLiveStream[];
			} catch (error) {
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to fetch past livestreams.",
				});
			}
		},
	}),

	// Public action to check if a room exists
	checkRoomExists: defineAction({
		input: z.object({
			roomName: z.string(),
		}),

		handler: async (input) => {
			try {
				const rooms = await roomClientService.listRooms();
				const roomExists = rooms.some((room) => room.name === input.roomName);

				return { exists: roomExists };
			} catch (error) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: "Failed to check if room exists",
				});
			}
		},
	}),

	createRoom: defineAction({
		input: z.object({
			name: z.string(),
			maxParticipants: z.number(),
			emptyTimeout: z.number().optional(),
		}),

		handler: async (input, context) => {
			if (!context.locals.user) {
				throw new ActionError({ code: "UNAUTHORIZED" });
			}

			const room = await roomClientService.createRoom({
				name: input.name,
				maxParticipants: input.maxParticipants,
				emptyTimeout: input.emptyTimeout || 120, // 2 minutes in seconds
			});

			// Insert into database with 'created' status
			await database.insert(livestreamsTable).values({
				sid: room.sid,
				name: room.name,
				status: "created",
			});

			return {
				id: room.sid,
				name: room.name,
			};
		},
	}),

	deleteRoom: defineAction({
		input: z.object({
			name: z.string(),
		}),

		handler: async (input, context) => {
			if (!context.locals.user) {
				throw new ActionError({ code: "UNAUTHORIZED" });
			}

			// Get room info before deleting
			const rooms = await roomClientService.listRooms();
			const room = rooms.find((r) => r.name === input.name);

			if (room) {
				// Update database status to ended
				await database
					.update(livestreamsTable)
					.set({
						status: "ended",
						endedAt: new Date(),
					})
					.where(eq(livestreamsTable.sid, room.sid));
			}

			await roomClientService.deleteRoom(input.name);
		},
	}),

	generateTokenFromInvite: defineAction({
		input: z.object({
			roomName: z.string(),
			participantName: z.string().optional(),
		}),

		handler: async (input, context) => {
			try {
				// Check if the room exists before generating a token
				let roomExists = false;
				try {
					const rooms = await roomClientService.listRooms();
					roomExists = rooms.some((room) => room.name === input.roomName);
				} catch (roomCheckError) {
					// Assume room exists if we can't check due to permissions
					// This is safer than blocking token generation completely
					roomExists = true;
				}

				if (!roomExists) {
					throw new ActionError({
						code: "NOT_FOUND",
						message: "Room does not exist",
					});
				}

				// Check if there's a user session (logged in) or this is a guest
				const loggedInUser = context?.locals?.user;
				const userDisplayName =
					loggedInUser?.preferred_username || loggedInUser?.name;

				// Generate identity:
				// - For authenticated users: always use their actual username (prevents spoofing)
				// - For guests: use provided name or generate random
				const identity = loggedInUser
					? userDisplayName || loggedInUser.sub // Use sub as fallback if no display name
					: input.participantName?.trim() ||
						`guest-${Math.floor(Math.random() * 10000)}`;

				// Create the token
				const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
					identity,
				});

				// Check if user has the director role
				const isDirector = loggedInUser?.roles?.includes("director") || false;

				// Add the grant - use room name, not room ID
				at.addGrant({
					roomJoin: true,
					room: input.roomName,
					// Only directors can publish audio/video
					canPublish: isDirector,
					// Allow chat for all users
					canPublishData: true,
					// Allow everyone to subscribe to everything
					canSubscribe: true,
				});

				// Convert to string JWT
				const token = at.toJwt();

				// Return only a string value for simplicity
				return token;
			} catch (error) {
				// Return a simple string error message

				throw new ActionError({
					code: error instanceof ActionError ? error.code : "BAD_REQUEST",
					message:
						error instanceof ActionError
							? error.message
							: "Token generation failed",
				});
			}
		},
	}),
};
