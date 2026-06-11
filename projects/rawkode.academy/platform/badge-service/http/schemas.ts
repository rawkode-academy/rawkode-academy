import { z } from "zod";

const ValidUntilSchema = z
	.union([z.string().datetime(), z.date()])
	.optional()
	.transform((value) => (value ? new Date(value) : undefined));

export const IssueBadgeRequestSchema = z.object({
	userId: z.string().min(1, "userId is required"),
	recipientEmail: z.string().email("recipientEmail must be a valid email"),
	achievementType: z.string().min(1, "achievementType is required"),
	achievementName: z.string().min(1, "achievementName is required"),
	achievementDescription: z
		.string()
		.min(1, "achievementDescription is required"),
	validUntil: ValidUntilSchema,
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
