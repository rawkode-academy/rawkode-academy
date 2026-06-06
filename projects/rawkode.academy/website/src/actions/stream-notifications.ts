import { ActionError, defineAction } from "astro:actions";
import { getCollection } from "astro:content";
import { z } from "astro/zod";
import { env } from "cloudflare:workers";
import {
	buildStreamNotification,
	isUpcomingLiveVideo,
	streamNotificationDedupeKey,
} from "@/lib/stream-notifications";
import type { RegisterNotificationInput } from "notifications/src/contracts.js";

const PushSubscriptionSchema = z.object({
	endpoint: z.url(),
	expirationTime: z.number().nullable().optional(),
	keys: z.object({
		p256dh: z.string().min(1),
		auth: z.string().min(1),
	}),
});

async function getUpcomingLiveVideo(slug: string) {
	const videos = await getCollection("videos");
	const video = videos.find((entry) => entry.data.slug === slug);
	if (!video) {
		throw new ActionError({
			code: "NOT_FOUND",
			message: "Stream not found.",
		});
	}
	if (!isUpcomingLiveVideo(video.data)) {
		throw new ActionError({
			code: "BAD_REQUEST",
			message: "Notifications are only available for upcoming live streams.",
		});
	}
	return video;
}

export const streamNotifications = {
	register: defineAction({
		input: z.object({
			videoSlug: z.string().min(1),
			subscription: PushSubscriptionSchema,
		}),
		handler: async (input, context) => {
			const video = await getUpcomingLiveVideo(input.videoSlug);
			const notification = buildStreamNotification({
				slug: video.data.slug,
				id: video.data.id,
				title: video.data.title,
				origin: new URL(context.request.url).origin,
			});
			const registerInput: RegisterNotificationInput = {
				subscription: input.subscription,
				notification,
			};
			if (context.locals.user?.id) {
				registerInput.userId = context.locals.user.id;
			}
			const userAgent = context.request.headers.get("user-agent");
			if (userAgent) {
				registerInput.userAgent = userAgent;
			}

			return env.NOTIFICATIONS.registerNotification(registerInput);
		},
	}),

	status: defineAction({
		input: z.object({
			videoSlug: z.string().min(1),
			endpoint: z.url(),
		}),
		handler: async (input) => {
			await getUpcomingLiveVideo(input.videoSlug);
			return env.NOTIFICATIONS.getNotificationStatus({
				dedupeKey: streamNotificationDedupeKey(input.videoSlug),
				endpoint: input.endpoint,
			});
		},
	}),

	cancel: defineAction({
		input: z.object({
			videoSlug: z.string().min(1),
			endpoint: z.url(),
		}),
		handler: async (input) => {
			await getUpcomingLiveVideo(input.videoSlug);
			return env.NOTIFICATIONS.cancelNotification({
				dedupeKey: streamNotificationDedupeKey(input.videoSlug),
				endpoint: input.endpoint,
			});
		},
	}),
};
