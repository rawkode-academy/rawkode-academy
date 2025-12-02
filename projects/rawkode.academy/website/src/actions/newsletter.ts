import { defineAction } from "astro:actions";
import { z } from "astro:schema";

/**
 * Helper to create a prefixed user ID for email preferences.
 * - For registered learners: `learner:{userId}`
 * - For email-only subscribers: `email:{email}`
 */
export function createLearnerId(userId: string): string {
	return `learner:${userId}`;
}

export function createEmailId(email: string): string {
	return `email:${email.toLowerCase().trim()}`;
}

const NEWSLETTER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year in seconds

function getNewsletterCookieName(audience: string): string {
	return `newsletter:${audience}:updates`;
}

export const newsletter = {
	subscribe: defineAction({
		input: z.object({
			audience: z.string().default("academy"),
			source: z.string().optional(),
		}),
		handler: async (input, context) => {
			if (!context.locals.user) {
				throw new Error("Unauthorized");
			}

			const prefixedUserId = createLearnerId(context.locals.user.id);

			const result =
				await context.locals.runtime.env.EMAIL_PREFERENCES.setPreference(
					prefixedUserId,
					{
						audience: input.audience,
						channel: "newsletter",
						status: "subscribed",
						source: input.source || "website:newsletter:unknown",
					},
				);

			return {
				...result,
				success: true,
			};
		},
	}),
	unsubscribe: defineAction({
		input: z.object({
			audience: z.string().default("academy"),
			source: z.string().optional(),
		}),
		handler: async (input, context) => {
			if (!context.locals.user) {
				throw new Error("Unauthorized");
			}

			const prefixedUserId = createLearnerId(context.locals.user.id);

			const result =
				await context.locals.runtime.env.EMAIL_PREFERENCES.setPreference(
					prefixedUserId,
					{
						audience: input.audience,
						channel: "newsletter",
						status: "unsubscribed",
						source: input.source || "website:newsletter:unknown",
					},
				);

			return {
				...result,
				success: true,
			};
		},
	}),
	subscribeWithEmail: defineAction({
		input: z.object({
			email: z.string().email("Please enter a valid email address"),
			audience: z.string().default("academy"),
			source: z.string().optional(),
		}),
		handler: async (input, context) => {
			const email = input.email.toLowerCase().trim();
			const prefixedUserId = createEmailId(email);

			const result =
				await context.locals.runtime.env.EMAIL_PREFERENCES.setPreference(
					prefixedUserId,
					{
						audience: input.audience,
						channel: "newsletter",
						status: "subscribed",
						source: input.source || "website:newsletter:unknown",
					},
				);

			// Set cookie for anonymous users to suppress CTA in future visits
			context.cookies.set(getNewsletterCookieName(input.audience), "true", {
				path: "/",
				maxAge: NEWSLETTER_COOKIE_MAX_AGE,
				httpOnly: false, // Allow client-side reading for CTA suppression
				secure: true,
				sameSite: "lax",
			});

			return {
				...result,
				success: true,
			};
		},
	}),
	unsubscribeWithEmail: defineAction({
		input: z.object({
			email: z.string().email("Please enter a valid email address"),
			audience: z.string().default("academy"),
			source: z.string().optional(),
		}),
		handler: async (input, context) => {
			const email = input.email.toLowerCase().trim();
			const prefixedUserId = createEmailId(email);

			const result =
				await context.locals.runtime.env.EMAIL_PREFERENCES.setPreference(
					prefixedUserId,
					{
						audience: input.audience,
						channel: "newsletter",
						status: "unsubscribed",
						source: input.source || "website:newsletter:unknown",
					},
				);

			// Clear the newsletter cookie on unsubscribe
			context.cookies.delete(getNewsletterCookieName(input.audience), {
				path: "/",
			});

			return {
				...result,
				success: true,
			};
		},
	}),
};
