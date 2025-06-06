import { ActionError, defineAction } from "astro:actions";
import {
	S3_ACCESS_KEY,
	S3_BUCKET_NAME,
	S3_ENDPOINT,
	S3_SECRET_KEY,
} from "astro:env/server";
import { z } from "astro:schema";
import { database } from "@/lib/database";
import { roomClientService } from "@/lib/livekit";
import {
	chatMessagesTable,
	livestreamsTable,
	participantsTable,
} from "@/schema";
import { desc, eq } from "drizzle-orm";
import {
	AutoParticipantEgress,
	AutoTrackEgress,
	type CreateOptions,
	EncodedFileOutput,
	EncodingOptions,
	RoomCompositeEgressRequest,
	RoomEgress,
	SegmentedFileOutput,
	VideoCodec,
} from "livekit-server-sdk";

const DEFAULT_ENCODING = {
	WIDTH: 1920,
	HEIGHT: 1080,
	VIDEO_CODEC: "VP8" as const,
	VIDEO_BITRATE: 14_000,
	FRAMERATE: 60,
};

const ROOM_DEFAULTS = {
	EMPTY_TIMEOUT: 2 * 60, // 2 minutes in seconds
	LAYOUT: "speaker-light" as const,
};

const CODEC_MAP: Record<string, VideoCodec> = {
	VP8: VideoCodec.VP8,
	H264: VideoCodec.H264_BASELINE,
};

function createS3Config() {
	return {
		endpoint: S3_ENDPOINT,
		accessKey: S3_ACCESS_KEY,
		secret: S3_SECRET_KEY,
		bucket: S3_BUCKET_NAME,
	};
}

function createFilePaths() {
	return {
		participantVideo:
			"livekit-recordings/{room_name}/participant_{publisher_identity}.mp4",
		participantSegmentPrefix:
			"livekit-recordings/{room_name}/participant_{publisher_identity}",
		participantPlaylist: "participant_{publisher_identity}.m3u8",
		track:
			"livekit-recordings/{room_name}/track_{publisher_identity}-{track_source}-{track_type}",
		roomVideo: "livekit-recordings/{room_name}/room_{room_name}.mp4",
		roomSegmentPrefix: "livekit-recordings/{room_name}/room_{room_name}",
		roomPlaylist: "room_{room_name}.m3u8",
	};
}

function createEncodingOptions(input: {
	videoWidth?: number;
	videoHeight?: number;
	videoCodec?: string;
	videoBitrate?: number;
	framerate?: number;
}) {
	return new EncodingOptions({
		width: input.videoWidth || DEFAULT_ENCODING.WIDTH,
		height: input.videoHeight || DEFAULT_ENCODING.HEIGHT,
		videoCodec:
			CODEC_MAP[input.videoCodec || DEFAULT_ENCODING.VIDEO_CODEC] ||
			VideoCodec.VP8,
		videoBitrate: input.videoBitrate || DEFAULT_ENCODING.VIDEO_BITRATE,
		framerate: input.framerate || DEFAULT_ENCODING.FRAMERATE,
	});
}

function createRoomEgress(roomName: string, encodingOptions: EncodingOptions) {
	const s3Config = createS3Config();
	const filePaths = createFilePaths();

	return new RoomEgress({
		// Individual participant recordings
		participant: new AutoParticipantEgress({
			options: {
				case: "advanced",
				value: encodingOptions,
			},
			fileOutputs: [
				new EncodedFileOutput({
					filepath: filePaths.participantVideo,
					output: { case: "s3", value: s3Config },
				}),
			],
			segmentOutputs: [
				new SegmentedFileOutput({
					filenamePrefix: filePaths.participantSegmentPrefix,
					playlistName: filePaths.participantPlaylist,
					output: { case: "s3", value: s3Config },
				}),
			],
		}),

		// Individual track recordings
		tracks: new AutoTrackEgress({
			filepath: filePaths.track,
			output: { case: "s3", value: s3Config },
		}),

		// Composite room recording
		room: new RoomCompositeEgressRequest({
			roomName: roomName,
			layout: ROOM_DEFAULTS.LAYOUT,
			options: {
				case: "advanced",
				value: encodingOptions,
			},
			fileOutputs: [
				new EncodedFileOutput({
					filepath: filePaths.roomVideo,
					output: { case: "s3", value: s3Config },
				}),
			],
			segmentOutputs: [
				new SegmentedFileOutput({
					filenamePrefix: filePaths.roomSegmentPrefix,
					playlistName: filePaths.roomPlaylist,
					output: { case: "s3", value: s3Config },
				}),
			],
		}),
	});
}

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

export type ChatMessage = {
	id: number;
	roomSid: string;
	participantIdentity: string;
	participantName: string;
	message: string;
	createdAt: Date;
};

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

	createRoom: defineAction({
		input: z.object({
			name: z.string(),
			maxParticipants: z.number(),
			emptyTimeout: z.number().optional(),
			enableAutoEgress: z.boolean().optional(),
			videoWidth: z.number().optional(),
			videoHeight: z.number().optional(),
			videoCodec: z.string().optional(),
			videoBitrate: z.number().optional(),
			framerate: z.number().optional(),
		}),

		handler: async (input, context) => {
			if (!context.locals.user) {
				throw new ActionError({ code: "UNAUTHORIZED" });
			}

			const createRoomOptions: CreateOptions = {
				name: input.name,
				maxParticipants: input.maxParticipants,
				emptyTimeout: input.emptyTimeout || ROOM_DEFAULTS.EMPTY_TIMEOUT,
			};

			if (input.enableAutoEgress) {
				const encodingOptions = createEncodingOptions(input);
				createRoomOptions.egress = createRoomEgress(
					input.name,
					encodingOptions,
				);
			}

			const room = await roomClientService.createRoom(createRoomOptions);

			// Insert into database with 'created' status
			await database
				.insert(livestreamsTable)
				.values({
					sid: room.sid,
					name: room.name,
					status: "created",
				})
				.onConflictDoNothing();

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
};
