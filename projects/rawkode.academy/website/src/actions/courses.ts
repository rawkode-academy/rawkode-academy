import process from "node:process";
import { ActionError, defineAction } from "astro:actions";
import { getSecret } from "astro:env/server";
import { z } from "astro/zod";
import { env } from "cloudflare:workers";
import { Resend } from "resend";
import { parseCampaignAttribution } from "@/lib/analytics/attribution";
import { GROWTH_EVENTS } from "@/lib/analytics/growth";
import {
	captureServerEvent,
	getAttributionFromSource,
	getDistinctId,
	getEventAttribution,
} from "../server/analytics";

const SignupSchema = z.object({
	email: z.email("Please enter a valid email address").optional(),
	audienceId: z.string().min(1, "Audience ID is required"),
	sponsorAudienceId: z.string().optional(),
	allowSponsorContact: z.boolean().optional().default(false),
	source: z.string().optional(),
	attribution: z.string().optional(),
});

// A provider error is returned as data, not necessarily thrown. Keep retries
// idempotent: a course subscription may already exist after a sponsor failure.
async function subscribeToAudience(
	resend: Resend,
	email: string,
	audienceId: string,
) {
	const contact = await resend.contacts.get({ email, audienceId });
	if (
		contact.error &&
		contact.error.name !== "not_found" &&
		contact.error.statusCode !== 404
	) {
		throw new Error("Unable to check subscription");
	}
	if (contact.data?.unsubscribed === false) return;

	const response = contact.data
		? await resend.contacts.update({
				id: contact.data.id,
				audienceId,
				unsubscribed: false,
			})
		: await resend.contacts.create({ email, audienceId, unsubscribed: false });
	if (response.error || !response.data?.id) {
		throw new Error("Unable to save subscription");
	}
}

export const signupForCourseUpdates = defineAction({
	input: SignupSchema,
	accept: "form",
	handler: async (data, ctx) => {
		const {
			audienceId,
			sponsorAudienceId,
			allowSponsorContact,
			source,
			attribution: campaignAttribution,
		} = data;

		// Get email: prefer authenticated user email over form input to prevent misuse
		const email = ctx.locals?.user?.email || data.email;

		if (!email) {
			throw new ActionError({
				code: "BAD_REQUEST",
				message: "Email address is required",
			});
		}

		const resendApiKey =
			getSecret("RESEND_API_KEY") || process.env.RESEND_API_KEY;

		if (!resendApiKey) {
			throw new ActionError({
				code: "INTERNAL_SERVER_ERROR",
				message: "An error occurred while processing your request",
			});
		}

		let sponsorStatus: "not_requested" | "subscribed" | "unconfirmed" = "not_requested";
		try {
			const resend = new Resend(resendApiKey);

			await subscribeToAudience(resend, email, audienceId);

			// If user opted in to sponsor contact and sponsor audience ID is provided, add to sponsor audience too
			if (allowSponsorContact && sponsorAudienceId) {
				try {
					await subscribeToAudience(resend, email, sponsorAudienceId);
					sponsorStatus = "subscribed";
				} catch {
					// The course subscription is already saved. Do not undo it or
					// describe an uncertain sponsor outcome as a total failure.
					sponsorStatus = "unconfirmed";
				}
			}

			// Store in session that this email has signed up for this course
			if (ctx.session) {
				const signedUpCourses =
					(await ctx.session.get("signedUpCourses")) || {};
				signedUpCourses[audienceId] = email;
				await ctx.session.set("signedUpCourses", signedUpCourses);
			}

			// Analytics: capture course signup (without sending PII)
			const distinctId = getDistinctId(ctx);
			const analytics = env.ANALYTICS as Fetcher | undefined;
			const attribution = getAttributionFromSource(source);
			const campaign = parseCampaignAttribution(campaignAttribution);
			const cookieAttribution = getEventAttribution(ctx.request);
			await captureServerEvent(
				{
					event: GROWTH_EVENTS.COURSE_SIGNUP,
					distinctId,
					properties: {
						audience_id: audienceId,
						allow_sponsor_contact: !!allowSponsorContact,
						is_authenticated: !!ctx.locals.user,
						...(source ? { source } : {}),
						...attribution,
						...campaign,
						...cookieAttribution,
					},
				},
				analytics,
			);
			await captureServerEvent(
				{
					event: GROWTH_EVENTS.ACTIVATED_USER,
					distinctId,
					properties: {
						audience_id: audienceId,
						allow_sponsor_contact: !!allowSponsorContact,
						is_authenticated: !!ctx.locals.user,
						activation_trigger: GROWTH_EVENTS.COURSE_SIGNUP,
						activation_surface: attribution.source_surface ?? "course-signup",
						...(attribution.source_context
							? { activation_context: attribution.source_context }
							: {}),
						...(source ? { source } : {}),
						...attribution,
						...campaign,
						...cookieAttribution,
					},
				},
				analytics,
			);
		} catch {
			throw new ActionError({
				code: "INTERNAL_SERVER_ERROR",
				message: "An error occurred while processing your request",
			});
		}

		return {
			success: true,
			sponsorStatus,
			message: sponsorStatus === "unconfirmed"
				? "Course updates are saved. Sponsor signup could not be confirmed. You can choose to retry below."
				: sponsorStatus === "subscribed"
					? "Course updates and sponsor signup are confirmed."
					: "Course updates are saved. We'll notify you when new course content is available.",
		};
	},
});
