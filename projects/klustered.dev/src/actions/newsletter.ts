import { defineAction, type ActionAPIContext } from "astro:actions";
import { z } from "astro:schema";

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

function getEnv(context: ActionAPIContext) {
	return context.locals.runtime.env;
}

export const newsletter = {
	subscribe: defineAction({
		input: z.object({
			audience: z.string().default("klustered-watch"),
			source: z.string().optional(),
		}),
		handler: async (input, context) => {
			if (!context.locals.user) {
				throw new Error("Unauthorized");
			}

			const env = getEnv(context);
			const prefixedUserId = createLearnerId(context.locals.user.id);

			const result =
				await env.EMAIL_PREFERENCES.setPreference(
					prefixedUserId,
					{
						audience: input.audience,
						channel: "newsletter",
						status: "subscribed",
						source: input.source || `klustered.dev:newsletter`,
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
			audience: z.string().default("klustered-watch"),
			source: z.string().optional(),
		}),
		handler: async (input, context) => {
			const env = getEnv(context);
			const email = input.email.toLowerCase().trim();
			const prefixedUserId = createEmailId(email);

			const result =
				await env.EMAIL_PREFERENCES.setPreference(
					prefixedUserId,
					{
						audience: input.audience,
						channel: "newsletter",
						status: "subscribed",
						source: input.source || `klustered.dev:newsletter`,
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

	registerCompetitor: defineAction({
		input: z.object({
			source: z.string().optional(),
		}),
		handler: async (input, context) => {
			if (!context.locals.user) {
				throw new Error("Unauthorized");
			}

			const env = getEnv(context);
			const prefixedUserId = createLearnerId(context.locals.user.id);

			const result =
				await env.EMAIL_PREFERENCES.setPreference(
					prefixedUserId,
					{
						audience: "klustered-compete",
						channel: "newsletter",
						status: "subscribed",
						source: input.source || "klustered.dev:compete-registration",
					},
				);

			return {
				...result,
				success: true,
			};
		},
	}),

	updateCompetitorRegistration: defineAction({
		input: z.object({
			type: z.enum(["solo", "team"]),
			action: z.enum(["subscribe", "unsubscribe"]),
			source: z.string().optional(),
		}),
		handler: async (input, context) => {
			if (!context.locals.user) {
				throw new Error("Unauthorized");
			}

			const env = getEnv(context);
			const prefixedUserId = createLearnerId(context.locals.user.id);
			const audience = `klustered-${input.type}`;

			const result =
				await env.EMAIL_PREFERENCES.setPreference(
					prefixedUserId,
					{
						audience,
						channel: "newsletter",
						status: input.action === "subscribe" ? "subscribed" : "unsubscribed",
						source: input.source || `klustered.dev:compete-registration:${input.type}`,
					},
				);

			return {
				...result,
				success: true,
			};
		},
	}),
};
