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
  type FramerateKey,
  type ResolutionKey,
  getFramerateValue,
  getResolutionDimensions,
  recordingSettingsSchema,
} from "@/lib/recordingConfig";
import { hasDirectorRole } from "@/lib/security";
import { livestreamsTable, participantsTable } from "@/schema";
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

const ROOM_DEFAULTS = {
  EMPTY_TIMEOUT: 2 * 60, // 2 minutes in seconds
  LAYOUT: "speaker-light" as const,
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
      "livekit-recordings/{room_name}/participant_{publisher_identity}.webm",
    participantSegmentPrefix:
      "livekit-recordings/{room_name}/participant_{publisher_identity}",
    participantPlaylist: "participant_{publisher_identity}.m3u8",
    track:
      "livekit-recordings/{room_name}/track_{publisher_identity}-{track_source}-{track_type}",
    roomVideo: "livekit-recordings/{room_name}/room_{room_name}.webm",
    roomSegmentPrefix: "livekit-recordings/{room_name}/room_{room_name}",
    roomPlaylist: "room_{room_name}.m3u8",
  };
}

function createRoomEgress(
  roomName: string,
  options: {
    participantRecording?: {
      resolution: string;
      framerate: string;
      videoBitrate: number;
    };
    trackRecording?: boolean;
    compositeRecording?: {
      resolution: string;
      framerate: string;
      videoBitrate: number;
    };
    layout?: string;
  },
) {
  const s3Config = createS3Config();
  const filePaths = createFilePaths();

  const egressConfig: {
    participant?: AutoParticipantEgress;
    tracks?: AutoTrackEgress;
    room?: RoomCompositeEgressRequest;
  } = {};

  // Individual participant recordings
  if (options.participantRecording) {
    // Create participant encoding options from provided values
    const createParticipantEncodingOptions = (): EncodingOptions => {
      const resolution = options.participantRecording?.resolution || "1080";
      const framerate = options.participantRecording?.framerate || "60";
      const videoBitrate = options.participantRecording?.videoBitrate || 6000;

      const dimensions = getResolutionDimensions(resolution as ResolutionKey);
      const framerateValue = getFramerateValue(framerate as FramerateKey);

      return new EncodingOptions({
        width: dimensions.width,
        height: dimensions.height,
        framerate: framerateValue,
        videoBitrate: videoBitrate,
        videoCodec: VideoCodec.VP8,
        audioBitrate: 128000, // 128 kbps
      });
    };

    egressConfig.participant = new AutoParticipantEgress({
      options: {
        case: "advanced",
        value: createParticipantEncodingOptions(),
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
    });
  }

  // Individual track recordings
  if (options.trackRecording) {
    egressConfig.tracks = new AutoTrackEgress({
      filepath: filePaths.track,
      output: { case: "s3", value: s3Config },
    });
  }

  // Composite room recording with custom options
  if (options.compositeRecording) {
    // Create composite encoding options from provided values
    const createCompositeEncodingOptions = (): EncodingOptions => {
      const resolution = options.compositeRecording?.resolution || "1080";
      const framerate = options.compositeRecording?.framerate || "60";
      const videoBitrate = options.compositeRecording?.videoBitrate || 6000;

      const dimensions = getResolutionDimensions(resolution as ResolutionKey);
      const framerateValue = getFramerateValue(framerate as FramerateKey);

      return new EncodingOptions({
        width: dimensions.width,
        height: dimensions.height,
        framerate: framerateValue,
        videoBitrate: videoBitrate,
        videoCodec: VideoCodec.VP8,
        audioBitrate: 128000, // 128 kbps
      });
    };

    egressConfig.room = new RoomCompositeEgressRequest({
      roomName: roomName,
      layout: options.layout || ROOM_DEFAULTS.LAYOUT,
      options: {
        case: "advanced",
        value: createCompositeEncodingOptions(),
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
    });
  }

  return new RoomEgress(egressConfig);
}

export type LiveStream = {
  id: string;
  livekitSid: string;
  displayName: string;
  numParticipants: number;
};

export type PastLiveStream = {
  id: string;
  livekitSid: string;
  displayName: string;
  startedAt: Date | null;
  finishedAt: Date;
  participantsCount: number | null;
};

export const rooms = {
  listRooms: defineAction({
    handler: async (_input, context) => {
      if (!context.locals.user) {
        throw new ActionError({ code: "UNAUTHORIZED" });
      }

      const rooms = await roomClientService.listRooms();

      return rooms.map((room) => {
        // Parse metadata to get display name
        let displayName = room.name;
        if (room.metadata) {
          try {
            const metadata = JSON.parse(room.metadata);
            displayName = metadata.displayName || room.name;
          } catch (e) {
            // If metadata parsing fails, use room name as fallback
          }
        }

        return {
          id: room.name, // The room name IS the ID now
          livekitSid: room.sid,
          displayName: displayName,
          numParticipants: room.numParticipants || 0,
        };
      });
    },
  }),

  listRunningRooms: defineAction({
    handler: async (_input, context) => {
      if (!context.locals.user) {
        throw new ActionError({ code: "UNAUTHORIZED" });
      }

      // Get running rooms from database
      const runningRooms = await database
        .select({
          id: livestreamsTable.id,
          displayName: livestreamsTable.displayName,
          startedAt: livestreamsTable.startedAt,
        })
        .from(livestreamsTable)
        .where(eq(livestreamsTable.status, "running"))
        .orderBy(desc(livestreamsTable.startedAt));

      // Get participant counts for each room
      const roomsWithCounts = await Promise.all(
        runningRooms.map(async (room) => {
          const participants = await database
            .select()
            .from(participantsTable)
            .where(eq(participantsTable.roomId, room.id));

          return {
            id: room.id,
            displayName: room.displayName,
            participantCount: participants.length,
            startedAt: room.startedAt,
          };
        }),
      );

      return roomsWithCounts;
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
            id: livestreamsTable.id,
            livekitSid: livestreamsTable.livekitSid,
            displayName: livestreamsTable.displayName,
            startedAt: livestreamsTable.startedAt,
            finishedAt: livestreamsTable.endedAt,
          })
          .from(livestreamsTable)
          .where(eq(livestreamsTable.status, "ended"))
          .orderBy(desc(livestreamsTable.endedAt));

        // Get participant counts for each room
        const roomsWithCounts = await Promise.all(
          pastRoomsData.map(async (room) => {
            const participants = await database
              .select()
              .from(participantsTable)
              .where(eq(participantsTable.roomId, room.id));
            return {
              ...room,
              participantsCount: participants.length,
            };
          }),
        );

        return roomsWithCounts
          .filter((room) => room.finishedAt != null)
          .map((room) => ({
            ...room,
            participantsCount: room.participantsCount ?? 0,
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
      displayName: z.string(),
      roomId: z.string(), // Required room ID from client
      maxParticipants: z.number(),
      emptyTimeout: z.number().optional(),
      layout: z.string().optional().default("speaker-light"),
      // Recording settings - presence of object means recording is enabled
      participantRecording: recordingSettingsSchema.optional(),
      trackRecording: z.boolean().optional(),
      compositeRecording: recordingSettingsSchema.optional(),
    }),

    handler: async (input, context) => {
      if (!context.locals.user) {
        throw new ActionError({ code: "UNAUTHORIZED" });
      }

      // Check if user has director role
      if (!hasDirectorRole(context.locals.user)) {
        throw new ActionError({
          code: "FORBIDDEN",
          message: "Insufficient permissions",
        });
      }

      // Check if the provided ID already exists
      const existing = await database
        .select({ id: livestreamsTable.id })
        .from(livestreamsTable)
        .where(eq(livestreamsTable.id, input.roomId))
        .limit(1);

      if (existing.length > 0) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "A room with this ID already exists. Please try again.",
        });
      }

      const finalRoomId = input.roomId;

      const createRoomOptions: CreateOptions = {
        name: finalRoomId, // Use the generated ID as the LiveKit room name
        maxParticipants: input.maxParticipants,
        emptyTimeout: input.emptyTimeout || ROOM_DEFAULTS.EMPTY_TIMEOUT,
        metadata: JSON.stringify({
          displayName: input.displayName,
          layout: input.layout || ROOM_DEFAULTS.LAYOUT,
        }),
      };

      // Check if any recording is enabled
      const hasRecording =
        input.participantRecording ||
        input.trackRecording ||
        input.compositeRecording;

      if (hasRecording) {
        createRoomOptions.egress = createRoomEgress(finalRoomId, {
          participantRecording: input.participantRecording,
          trackRecording: input.trackRecording,
          compositeRecording: input.compositeRecording,
          layout: input.layout || ROOM_DEFAULTS.LAYOUT,
        });
      }

      const room = await roomClientService.createRoom(createRoomOptions);

      // Insert into database with 'created' status
      await database
        .insert(livestreamsTable)
        .values({
          id: finalRoomId,
          livekitSid: room.sid,
          displayName: input.displayName,
          status: "created",
        })
        .onConflictDoNothing();

      return {
        id: finalRoomId,
        livekitSid: room.sid,
        displayName: input.displayName,
      };
    },
  }),

  deleteRoom: defineAction({
    input: z.object({
      id: z.string(),
    }),

    handler: async (input, context) => {
      if (!context.locals.user) {
        throw new ActionError({ code: "UNAUTHORIZED" });
      }

      // Check if user has director role
      if (!hasDirectorRole(context.locals.user)) {
        throw new ActionError({
          code: "FORBIDDEN",
          message: "Insufficient permissions",
        });
      }

      // Get room info from database
      const dbRoom = await database
        .select({
          livekitSid: livestreamsTable.livekitSid,
        })
        .from(livestreamsTable)
        .where(eq(livestreamsTable.id, input.id))
        .limit(1);

      if (dbRoom.length === 0) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Room not found",
        });
      }

      // Update database status to ended
      await database
        .update(livestreamsTable)
        .set({
          status: "ended",
          endedAt: new Date(),
        })
        .where(eq(livestreamsTable.id, input.id));

      // Delete the room from LiveKit using the room ID (which is also the LiveKit room name)
      await roomClientService.deleteRoom(input.id);
    },
  }),

  updateRoomLayout: defineAction({
    input: z.object({
      roomId: z.string(),
      metadata: z.string(),
    }),

    handler: async (input, context) => {
      if (!context.locals.user) {
        throw new ActionError({ code: "UNAUTHORIZED" });
      }

      try {
        // Check if room exists
        const rooms = await roomClientService.listRooms([input.roomId]);
        const room = rooms[0];

        if (!room) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Room not found",
          });
        }

        // Update room metadata
        await roomClientService.updateRoomMetadata(
          input.roomId,
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
