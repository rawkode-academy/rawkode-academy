import { getSessionCampaignAttribution } from "@/lib/analytics/attribution";

export const GROWTH_EVENTS = {
	ACTIVATED_USER: "activated_user",
	COURSE_SIGNUP: "course_signup",
	COHORT_CTA_CLICKED: "cohort_cta_clicked",
	COHORT_CHECKOUT_STARTED: "cohort_checkout_started",
	COHORT_ENROLLED: "cohort_enrolled",
	COHORT_INVOICE_REQUESTED: "cohort_invoice_requested",
	LEAD_MAGNET_VIEWED: "lead_magnet_viewed",
	LEAD_MAGNET_CLICKED: "lead_magnet_clicked",
	LEAD_MAGNET_SUBMISSION_ATTEMPTED: "lead_magnet_submission_attempted",
	LEAD_MAGNET_SIGNUP: "lead_magnet_signup",
	NEWSLETTER_CTA_IMPRESSION: "newsletter_cta_impression",
	NEWSLETTER_CTA_CLICKED: "newsletter_cta_clicked",
	NEWSLETTER_SUBMISSION_ATTEMPTED: "newsletter_submission_attempted",
	NEWSLETTER_SUBSCRIBED: "newsletter_subscribed",
	NEWSLETTER_UNSUBSCRIBED: "newsletter_unsubscribed",
	NEWSLETTER_PREFERENCE_UPDATED: "newsletter_preference_updated",
	NEWSLETTER_UNSUBSCRIBE_ALL: "newsletter_unsubscribe_all",
} as const;

export type GrowthEvent = (typeof GROWTH_EVENTS)[keyof typeof GROWTH_EVENTS];

export function captureGrowthClientEvent(
	event: GrowthEvent,
	properties?: Record<string, unknown>,
): void {
	try {
		const campaignAttribution = getSessionCampaignAttribution();
		(
			window as Window & {
				posthog?: {
					capture?: (
						eventName: string,
						props?: Record<string, unknown>,
					) => void;
				};
			}
		).posthog?.capture?.(event, {
			...campaignAttribution,
			...properties,
		});
	} catch {
		// Ignore tracking errors on the client.
	}
}
