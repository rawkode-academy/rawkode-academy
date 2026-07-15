import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { env } from "cloudflare:workers";
import type { StudioEnv } from "../env";
import { createSessionInputSchema } from "./createSessionInput";
import {
	confirmStudioStream,
	createStudioInvite,
	createStudioSession,
	endStudioSession,
	issueStudioParticipantToken,
	markStudioRecordingReady,
	startStudioStream,
	StudioOperationError,
	stopStudioStream,
} from "../server/operations";

const optionalPositiveInt = (max: number) =>
	z.preprocess(
		(value) => {
			if (value == null) return undefined;
			if (typeof value === "string") {
				const trimmed = value.trim();
				if (!trimmed) return undefined;
				return Number(trimmed);
			}
			return value;
		},
		z.number().int().min(1).max(max).optional(),
	);

function requireUser(context: { locals: App.Locals }) {
	if (!context.locals.user) {
		throw new ActionError({
			code: "UNAUTHORIZED",
			message: "Sign in with rawkode.academy identity to use Studio.",
		});
	}
	return context.locals.user;
}

function toActionError(error: unknown): never {
	if (error instanceof StudioOperationError) {
		throw new ActionError({
			code: ActionError.statusToCode(error.status),
			message: error.message,
		});
	}
	throw error;
}

export const server = {
	createSession: defineAction({
		accept: "form",
		input: createSessionInputSchema,
		handler: async (input, context) => {
			const user = requireUser(context);
			const studioEnv = env as StudioEnv;
			try {
				const result = await createStudioSession(studioEnv, user, input);

				return {
					sessionId: result.session.id,
					provider: result.provider,
					meeting: result.meeting,
					status: result.status,
				};
			} catch (error) {
				toActionError(error);
			}
		},
	}),

	startStream: defineAction({
		input: z.object({
			sessionId: z.string().min(1),
			streamToken: z.string().min(1).optional(),
		}),
		handler: async (input, context) => {
			const user = requireUser(context);
			const studioEnv = env as StudioEnv;
			try {
				return await startStudioStream(studioEnv, user, input);
			} catch (error) {
				toActionError(error);
			}
		},
	}),

	confirmStream: defineAction({
		input: z.object({
			sessionId: z.string().min(1),
			streamToken: z.string().min(1).optional(),
		}),
		handler: async (input, context) => {
			const user = requireUser(context);
			const studioEnv = env as StudioEnv;
			try {
				return await confirmStudioStream(studioEnv, user, input);
			} catch (error) {
				toActionError(error);
			}
		},
	}),

	stopStream: defineAction({
		input: z.object({
			sessionId: z.string().min(1),
			streamToken: z.string().min(1).optional(),
		}),
		handler: async (input, context) => {
			const user = requireUser(context);
			const studioEnv = env as StudioEnv;
			try {
				return await stopStudioStream(studioEnv, user, input);
			} catch (error) {
				toActionError(error);
			}
		},
	}),

	endSession: defineAction({
		accept: "form",
		input: z.object({
			sessionId: z.string().min(1),
		}),
		handler: async (input, context) => {
			const user = requireUser(context);
			const studioEnv = env as StudioEnv;
			try {
				return await endStudioSession(studioEnv, user, input);
			} catch (error) {
				toActionError(error);
			}
		},
	}),

	issueParticipantToken: defineAction({
		input: z.object({
			inviteToken: z.string().min(1).optional(),
			sessionId: z.string().min(1),
			role: z.enum(["guest", "host", "producer", "program"]),
		}),
		handler: async (input, context) => {
			const user = requireUser(context);
			const studioEnv = env as StudioEnv;
			try {
				return await issueStudioParticipantToken(studioEnv, user, input);
			} catch (error) {
				toActionError(error);
			}
		},
	}),

	markRecordingReady: defineAction({
		input: z.object({
			recordingId: z.string().min(1).optional(),
			sessionId: z.string().min(1),
			sourceBucket: z.string().min(1).optional(),
			sourceEtag: z.string().min(1),
			sourceFormat: z.enum(["mkv", "mp4", "webm"]),
			sourceKey: z.string().min(1),
			videoId: z.string().min(1).optional(),
		}),
		handler: async (input, context) => {
			const user = requireUser(context);
			const studioEnv = env as StudioEnv;
			try {
				return await markStudioRecordingReady(studioEnv, user, input);
			} catch (error) {
				toActionError(error);
			}
		},
	}),

	createInvite: defineAction({
		accept: "form",
		input: z.object({
			expiresInHours: optionalPositiveInt(24 * 30),
			maxUses: optionalPositiveInt(25),
			sessionId: z.string().min(1),
		}),
		handler: async (input, context) => {
			const user = requireUser(context);
			const studioEnv = env as StudioEnv;
			try {
				return await createStudioInvite(studioEnv, user, input);
			} catch (error) {
				toActionError(error);
			}
		},
	}),
};
