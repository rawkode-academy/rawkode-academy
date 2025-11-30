import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { createEmailId, createLearnerId } from "./newsletter";

const TECHNOLOGY_COOKIE_PREFIX = "technology:updates:";
const TECHNOLOGY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year in seconds

/**
 * Create a technology-specific audience identifier.
 * Format: technology:{technologyId}
 */
export function createTechnologyAudience(technologyId: string): string {
	return `technology:${technologyId.toLowerCase().trim()}`;
}

export const technology = {
	/**
	 * Subscribe to updates for a specific technology (authenticated users)
	 */
	subscribeToUpdates: defineAction({
		input: z.object({
			technologyId: z.string().min(1, "Technology ID is required"),
			source: z.string().optional(),
		}),
		handler: async (input, context) => {
			if (!context.locals.user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "Unauthorized",
				});
			}

			const prefixedUserId = createLearnerId(context.locals.user.id);
			const audience = createTechnologyAudience(input.technologyId);

			const result =
				await context.locals.runtime.env.EMAIL_PREFERENCES.setPreference(
					prefixedUserId,
					{
						audience,
						channel: "newsletter",
						status: "subscribed",
						source: input.source || `website:technology:${input.technologyId}`,
					},
				);

			return {
				...result,
				success: true,
			};
		},
	}),

	/**
	 * Subscribe to updates for a specific technology with email only
	 */
	subscribeToUpdatesWithEmail: defineAction({
		input: z.object({
			email: z.string().email("Please enter a valid email address"),
			technologyId: z.string().min(1, "Technology ID is required"),
			source: z.string().optional(),
		}),
		handler: async (input, context) => {
			const email = input.email.toLowerCase().trim();
			const prefixedUserId = createEmailId(email);
			const audience = createTechnologyAudience(input.technologyId);

			const result =
				await context.locals.runtime.env.EMAIL_PREFERENCES.setPreference(
					prefixedUserId,
					{
						audience,
						channel: "newsletter",
						status: "subscribed",
						source: input.source || `website:technology:${input.technologyId}`,
					},
				);

			// Set cookie to suppress CTA in future visits
			const cookieName = `${TECHNOLOGY_COOKIE_PREFIX}${input.technologyId}`;
			context.cookies.set(cookieName, "true", {
				path: "/",
				maxAge: TECHNOLOGY_COOKIE_MAX_AGE,
				httpOnly: false,
				secure: true,
				sameSite: "lax",
			});

			return {
				...result,
				success: true,
			};
		},
	}),

	/**
	 * Request more content for a specific technology (authenticated users)
	 */
	requestContent: defineAction({
		input: z.object({
			technologyId: z.string().min(1, "Technology ID is required"),
			source: z.string().optional(),
		}),
		handler: async (input, context) => {
			if (!context.locals.user) {
				throw new ActionError({
					code: "UNAUTHORIZED",
					message: "Unauthorized",
				});
			}

			const prefixedUserId = createLearnerId(context.locals.user.id);
			const audience = createTechnologyAudience(input.technologyId);

			// Use "marketing" channel for content requests to distinguish from update subscriptions
			const result =
				await context.locals.runtime.env.EMAIL_PREFERENCES.setPreference(
					prefixedUserId,
					{
						audience,
						channel: "marketing",
						status: "subscribed",
						source:
							input.source ||
							`website:technology:${input.technologyId}:content-request`,
					},
				);

			return {
				...result,
				success: true,
			};
		},
	}),

	/**
	 * Request more content for a specific technology with email only
	 */
	requestContentWithEmail: defineAction({
		input: z.object({
			email: z.string().email("Please enter a valid email address"),
			technologyId: z.string().min(1, "Technology ID is required"),
			source: z.string().optional(),
		}),
		handler: async (input, context) => {
			const email = input.email.toLowerCase().trim();
			const prefixedUserId = createEmailId(email);
			const audience = createTechnologyAudience(input.technologyId);

			// Use "marketing" channel for content requests
			const result =
				await context.locals.runtime.env.EMAIL_PREFERENCES.setPreference(
					prefixedUserId,
					{
						audience,
						channel: "marketing",
						status: "subscribed",
						source:
							input.source ||
							`website:technology:${input.technologyId}:content-request`,
					},
				);

			// Set cookie to suppress content request CTA
			const cookieName = `${TECHNOLOGY_COOKIE_PREFIX}${input.technologyId}:content`;
			context.cookies.set(cookieName, "true", {
				path: "/",
				maxAge: TECHNOLOGY_COOKIE_MAX_AGE,
				httpOnly: false,
				secure: true,
				sameSite: "lax",
			});

			return {
				...result,
				success: true,
			};
		},
	}),
};
