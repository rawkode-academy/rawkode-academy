import { defineAction } from "astro:actions";
import { getSecret } from "astro:env/server";
import { env } from "cloudflare:workers";
import { z } from "astro/zod";
import { GROWTH_EVENTS } from "@/lib/analytics/growth";
import { formatUsd, offer, startsLabel } from "@/lib/cohorts/operations-for-ai";
import {
	captureServerEvent,
	getDistinctId,
	getEventAttribution,
} from "@/server/analytics";
import {
	attioRequest,
	createNote,
	DEAL_OWNER,
	rateLimitKey,
	upsertCompanyAndPerson,
} from "@/server/attio";

const DEFAULT_DEAL_STAGE = "In Progress";

export const invoiceOptions = ["public", "private"] as const;

const invoiceInput = z.object({
	name: z
		.string({ error: "Please tell us your name" })
		.trim()
		.min(1, "Please tell us your name")
		.max(200),
	email: z.email({ error: "Please enter a valid work email" }),
	company: z
		.string({ error: "Please tell us your company" })
		.trim()
		.min(1, "Please tell us your company")
		.max(1000),
	option: z.enum(invoiceOptions).default("public"),
	seats: z.coerce
		.number()
		.int("Seats must be a whole number")
		.min(1, "At least one seat")
		.max(offer.seats, `At most ${offer.seats} seats`),
	purchaseOrder: z.string().trim().max(200).optional().default(""),
	message: z.string().trim().max(5000).optional().default(""),
	// Honeypot: real people never see or fill this field.
	website: z.string().trim().max(500).optional().default(""),
});

type InvoiceInput = z.infer<typeof invoiceInput>;

export const invoiceRequestNote = (input: InvoiceInput) =>
	[
		input.option === "private"
			? `Private cohort enquiry for ${input.seats} engineers.`
			: `Invoice request for ${input.seats} seat${input.seats === 1 ? "" : "s"} on ${offer.title} (${offer.intakeId}, ${startsLabel().toLowerCase()}).`,
		input.option === "public"
			? `Value: ${formatUsd(input.seats * offer.priceUsd)} at ${formatUsd(offer.priceUsd)} per seat.`
			: "Value: to be quoted.",
		`Contact: ${input.name} <${input.email}>`,
		`Company: ${input.company}`,
		input.purchaseOrder
			? `PO number: ${input.purchaseOrder}`
			: "PO number: not given",
		"Source: Inbound: Operations for AI page",
		...(input.message ? ["", input.message] : []),
	].join("\n");

const requestInvoice = async (
	input: InvoiceInput,
	context: {
		request: Request;
		locals: { user?: { id: string } };
	},
) => {
	if (input.website) {
		return { success: true, accepted: false } as const;
	}

	const apiKey = getSecret("ATTIO_API_KEY");
	if (!apiKey) {
		console.error("Failed to save cohort invoice request", {
			code: "crm_unconfigured",
		});
		return { success: false, fallback: "mailto" } as const;
	}

	const rateLimit = await env.PARTNERSHIP_FORM_RATE_LIMITER.limit({
		key: await rateLimitKey(context.request, "cohort-invoice"),
	});
	if (!rateLimit.success) {
		return { success: false, rateLimited: true } as const;
	}

	try {
		const { companyId, personId } = await upsertCompanyAndPerson(apiKey, input);
		const title =
			input.option === "private"
				? `${offer.title}: private cohort enquiry`
				: `${offer.title}: invoice request`;
		await createNote(
			apiKey,
			"people",
			personId,
			title,
			invoiceRequestNote(input),
		);

		try {
			await attioRequest(apiKey, "/objects/deals/records", {
				name:
					input.option === "private"
						? `${input.company}: ${offer.title} private cohort`
						: `${input.company}: ${offer.title} × ${input.seats}`,
				stage: env.ATTIO_INBOUND_DEAL_STAGE?.trim() || DEFAULT_DEAL_STAGE,
				owner: DEAL_OWNER,
				// Private cohorts are quoted, so they carry no value until then.
				...(input.option === "public"
					? { value: input.seats * offer.priceUsd }
					: {}),
				associated_people: [
					{ target_object: "people", target_record_id: personId },
				],
				associated_company: {
					target_object: "companies",
					target_record_id: companyId,
				},
			});
		} catch (error) {
			// The person and note are saved; David still sees the request.
			console.error("Failed to create Attio deal for cohort invoice", {
				code: (error as { code?: string }).code,
			});
		}
	} catch (error) {
		console.error("Failed to save cohort invoice request", {
			code: (error as { code?: string }).code ?? "crm_unavailable",
		});
		return { success: false, fallback: "mailto" } as const;
	}

	await captureServerEvent(
		{
			event: GROWTH_EVENTS.COHORT_INVOICE_REQUESTED,
			distinctId: getDistinctId(context),
			properties: {
				content_id: offer.intakeId,
				seats: input.seats,
				option: input.option,
				...getEventAttribution(context.request),
			},
		},
		env.ANALYTICS as Fetcher | undefined,
	);

	return { success: true, accepted: true } as const;
};

export const cohort = {
	requestInvoice: defineAction({
		accept: "form",
		input: invoiceInput,
		handler: requestInvoice,
	}),
};
