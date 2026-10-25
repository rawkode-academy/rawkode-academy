// POST /api/cohorts/operations-for-ai/checkout: a native form post from the
// sales page. Creates a Stripe Checkout session and redirects to it.
// Same-origin is enforced by Astro's security.checkOrigin.

import { getSecret } from "astro:env/server";
import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { GROWTH_EVENTS } from "@/lib/analytics/growth";
import {
	abstract,
	COHORT_PATH,
	clampSeats,
	offer,
	startsLabel,
} from "@/lib/cohorts/operations-for-ai";
import { createCheckoutSession } from "@/lib/stripe";
import {
	captureServerEvent,
	getDistinctId,
	getEventAttribution,
} from "@/server/analytics";

export const prerender = false;

const back = (origin: string, reason: string) =>
	new Response(null, {
		status: 303,
		headers: {
			Location: `${origin}${COHORT_PATH}?checkout=${reason}#enrol`,
			"Cache-Control": "no-store",
		},
	});

export const POST: APIRoute = async (context) => {
	const origin = new URL(context.request.url).origin;
	if (offer.status !== "open") return back(origin, "sold-out");

	const secretKey = getSecret("STRIPE_SECRET_KEY");
	if (!secretKey) {
		console.error("Cohort checkout unavailable", {
			code: "stripe_unconfigured",
		});
		return back(origin, "unavailable");
	}

	let seats = 1;
	try {
		seats = clampSeats((await context.request.formData()).get("seats"));
	} catch {
		seats = 1;
	}

	const distinctId = getDistinctId(context);
	try {
		const session = await createCheckoutSession(secretKey, {
			intakeId: offer.intakeId,
			productName: `${offer.title}: live cohort`,
			productDescription: `${startsLabel()}. ${abstract}`,
			unitAmountUsd: offer.priceUsd,
			seats,
			maxSeatsPerOrder: offer.maxSeatsPerOrder,
			successUrl: `${origin}${COHORT_PATH}/enrolled?session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${origin}${COHORT_PATH}?checkout=cancelled#enrol`,
			clientReferenceId: distinctId,
			customerEmail: context.locals.user?.email,
		});
		if (!session.url) throw new Error("Stripe returned no checkout URL");

		await captureServerEvent(
			{
				event: GROWTH_EVENTS.COHORT_CHECKOUT_STARTED,
				distinctId,
				properties: {
					content_id: offer.intakeId,
					seats,
					is_authenticated: !!context.locals.user,
					page_path: COHORT_PATH,
					...getEventAttribution(context.request),
				},
			},
			env.ANALYTICS as Fetcher | undefined,
		);

		return new Response(null, {
			status: 303,
			headers: { Location: session.url, "Cache-Control": "no-store" },
		});
	} catch (error) {
		console.error("Cohort checkout failed", {
			message: error instanceof Error ? error.message : "unknown",
			status: (error as { status?: number }).status,
		});
		return back(origin, "error");
	}
};
