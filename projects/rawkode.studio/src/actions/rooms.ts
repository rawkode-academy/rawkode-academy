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
import { livestreamsTable, participantsTable } from "@/schema";
import { desc, eq } from "drizzle-orm";
import {
	AutoParticipantEgress,
	AutoTrackEgress,
	type CreateOptions,
	EncodedFileOutput,
	EncodingOptionsPreset,
	RoomCompositeEgressRequest,
	RoomEgress,
	SegmentedFileOutput,
} from "livekit-server-sdk";

const ROOM_DEFAULTS = {
	EMPTY_TIMEOUT: 2 * 60, // 2 minutes in seconds
	LAYOUT: "speaker-light" as const,
	DEFAULT_PRESET: EncodingOptionsPreset.H264_1080P_60,
};

const PRESET_MAP: Record<string, EncodingOptionsPreset> = {
	H264_720P_30: EncodingOptionsPreset.H264_720P_30,
	H264_720P_60: EncodingOptionsPreset.H264_720P_60,
	H264_1080P_30: EncodingOptionsPreset.H264_1080P_30,
	H264_1080P_60: EncodingOptionsPreset.H264_1080P_60,
	PORTRAIT_H264_720P_30: EncodingOptionsPreset.PORTRAIT_H264_720P_30,
	PORTRAIT_H264_720P_60: EncodingOptionsPreset.PORTRAIT_H264_720P_60,
	PORTRAIT_H264_1080P_30: EncodingOptionsPreset.PORTRAIT_H264_1080P_30,
	PORTRAIT_H264_1080P_60: EncodingOptionsPreset.PORTRAIT_H264_1080P_60,
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

function createRoomEgress(roomName: string, preset: EncodingOptionsPreset) {
	const s3Config = createS3Config();
	const filePaths = createFilePaths();

	return new RoomEgress({
		// Individual participant recordings
		participant: new AutoParticipantEgress({
			options: {
				case: "preset",
				value: preset,
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
				case: "preset",
				value: preset,
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

export const rooms = {
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
			encodingPreset: z.string().optional(),
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
				const preset = input.encodingPreset
					? PRESET_MAP[input.encodingPreset] || ROOM_DEFAULTS.DEFAULT_PRESET
					: ROOM_DEFAULTS.DEFAULT_PRESET;

				createRoomOptions.egress = createRoomEgress(input.name, preset);
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
			const rooms = await roomClientService.listRooms([input.name]);
			const room = rooms[0];

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

	updateRoomLayout: defineAction({
		input: z.object({
			roomName: z.string(),
			metadata: z.string(),
		}),

		handler: async (input, context) => {
			if (!context.locals.user) {
				throw new ActionError({ code: "UNAUTHORIZED" });
			}

			try {
				// Check if room exists
				const rooms = await roomClientService.listRooms([input.roomName]);
				const room = rooms[0];

				if (!room) {
					throw new ActionError({
						code: "NOT_FOUND",
						message: "Room not found",
					});
				}

				// Update room metadata
				await roomClientService.updateRoomMetadata(
					input.roomName,
					input.metadata,
				);

				return { success: true };
			} catch (error) {
				if (error instanceof ActionError) {
					throw error;
				}
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to update room layout",
				});
			}
		},
	}),
};
