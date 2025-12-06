import { z } from "zod";

export const IssueBadgeRequestSchema = z.object({
	userId: z.string().min(1, "userId is required"),
	achievementType: z.string().min(1, "achievementType is required"),
	achievementName: z.string().min(1, "achievementName is required"),
	achievementDescription: z
		.string()
		.min(1, "achievementDescription is required"),
	validUntil: z.coerce.date().optional(),
});

export const IssueBadgeResponseSchema = z.object({
	success: z.boolean(),
	badgeId: z.string(),
	credentialUrl: z.string(),
	imageUrl: z.string(),
});

export const ErrorResponseSchema = z.object({
	error: z.string(),
	details: z.record(z.unknown()).optional(),
});

export type IssueBadgeRequest = z.infer<typeof IssueBadgeRequestSchema>;
export type IssueBadgeResponse = z.infer<typeof IssueBadgeResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
