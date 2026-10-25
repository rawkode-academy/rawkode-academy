import { defineAction } from "astro:actions";
import { getSecret } from "astro:env/server";
import { env } from "cloudflare:workers";
import { z } from "astro/zod";
import {
	applicationPathDeals,
	applicationPathLabels,
	applicationPaths,
} from "@/lib/partnerships";
import {
	attioAttributeExists,
	attioRequest,
	createNote,
	DEAL_OWNER,
	rateLimitKey,
	upsertCompanyAndPerson,
} from "@/server/attio";

const DEFAULT_DEAL_STAGE = "In Progress";
const DEFAULT_OFFER_ATTRIBUTE = "offer";
const DEFAULT_SOURCE_ATTRIBUTE = "source";
const DEFAULT_SOURCE_VALUE = "Inbound: partnerships page";

const ENQUIRY_ERROR_CODES = [
	"crm_unconfigured",
	"invalid_email",
	"crm_lookup_failed",
	"crm_write_failed",
	"crm_note_failed",
	"crm_unavailable",
] as const;
type EnquiryErrorCode = (typeof ENQUIRY_ERROR_CODES)[number];

const enquiryFallback = (code: EnquiryErrorCode) =>
	({
		success: false,
		fallback: "mailto",
		code,
	}) as const;

const isEnquiryErrorCode = (value: unknown): value is EnquiryErrorCode =>
	typeof value === "string" &&
	(ENQUIRY_ERROR_CODES as readonly string[]).includes(value);

const failureDetails = (error: unknown) => {
	const details =
		error && typeof error === "object"
			? (error as { code?: unknown; status?: unknown; attioCode?: unknown })
			: undefined;
	const code = details?.code;
	return {
		code: isEnquiryErrorCode(code) ? code : "crm_unavailable",
		status: typeof details?.status === "number" ? details.status : undefined,
		attioCode:
			typeof details?.attioCode === "string" ? details.attioCode : undefined,
	};
};

const companyReviewContent = (
	domain: string,
	companyName: string,
	email: string,
) =>
	[
		"A public partnership form matched this company by an unverified email domain.",
		`Email domain: ${domain}`,
		`Submitted company name: ${companyName}`,
		`Submitted email: ${email}`,
		"The company record was not changed. Review this match before relying on it.",
	].join("\n");

const personReviewContent = (
	name: string,
	email: string,
	companyName: string,
) =>
	[
		"A public partnership form matched this person by an unverified email address.",
		`Submitted name: ${name}`,
		`Submitted email: ${email}`,
		`Submitted company: ${companyName}`,
		"The person record was not changed. Review this match before relying on it.",
	].join("\n");

const enquiryInput = z.object({
	name: z.string().trim().min(1, "Please tell us your name").max(200),
	email: z.email("Please enter a valid work email"),
	company: z.string().trim().min(1, "Please tell us your company").max(1000),
	path: z.enum(applicationPaths),
	message: z.string().trim().min(1, "Please add a message").max(5000),
	website: z.string().trim().max(500).optional().default(""),
});

const saveEnquiry = async (
	input: z.infer<typeof enquiryInput>,
	context: { request: Request },
) => {
	if (input.website) {
		return { success: true, accepted: false } as const;
	}

	const apiKey = getSecret("ATTIO_API_KEY");
	if (!apiKey) {
		console.error("Failed to save partnership enquiry in Attio", {
			code: "crm_unconfigured",
		});
		return enquiryFallback("crm_unconfigured");
	}

	const rateLimit = await env.PARTNERSHIP_FORM_RATE_LIMITER.limit({
		key: await rateLimitKey(context.request, "partnership-enquiry"),
	});
	if (!rateLimit.success) {
		return { success: false, rateLimited: true } as const;
	}

	const emailDomain = input.email.split("@")[1]?.toLowerCase();
	if (!emailDomain) {
		console.error("Failed to save partnership enquiry in Attio", {
			code: "invalid_email",
		});
		return enquiryFallback("invalid_email");
	}

	try {
		const { companyId, existingCompanyId, personId, existingPersonId } =
			await upsertCompanyAndPerson(apiKey, input);

		const sourceAttribute =
			env.ATTIO_SOURCE_ATTRIBUTE?.trim() || DEFAULT_SOURCE_ATTRIBUTE;
		const sourceValue = env.ATTIO_SOURCE_VALUE?.trim() || DEFAULT_SOURCE_VALUE;
		const hasSourceAttribute = await attioAttributeExists(
			apiKey,
			sourceAttribute,
		);

		if (existingCompanyId) {
			await createNote(
				apiKey,
				"companies",
				existingCompanyId,
				"Review partnership enquiry: existing company",
				companyReviewContent(emailDomain, input.company, input.email),
			);
		}
		if (existingPersonId) {
			await createNote(
				apiKey,
				"people",
				existingPersonId,
				"Review partnership enquiry: existing person",
				personReviewContent(input.name, input.email, input.company),
			);
		}
		await createNote(
			apiKey,
			"people",
			personId,
			hasSourceAttribute
				? `Partnership enquiry: ${applicationPathLabels[input.path]}`
				: `Partnership enquiry [Source: ${sourceValue}]: ${applicationPathLabels[input.path]}`,
			input.message,
		);

		const dealStage =
			env.ATTIO_INBOUND_DEAL_STAGE?.trim() || DEFAULT_DEAL_STAGE;
		// Attio's built-in deal value inherits its currency from the
		// workspace attribute, which David has configured as USD.
		const mappedDeal = applicationPathDeals[input.path];
		const offerAttribute =
			env.ATTIO_INBOUND_DEAL_OFFER_ATTRIBUTE?.trim() || DEFAULT_OFFER_ATTRIBUTE;
		try {
			await attioRequest(apiKey, "/objects/deals/records", {
				name: `${input.company}: ${applicationPathLabels[input.path]}`,
				stage: dealStage,
				owner: DEAL_OWNER,
				value: mappedDeal.valueUsd,
				[offerAttribute]: mappedDeal.offer,
				...(hasSourceAttribute ? { [sourceAttribute]: sourceValue } : {}),
				associated_people: [
					{
						target_object: "people",
						target_record_id: personId,
					},
				],
				associated_company: {
					target_object: "companies",
					target_record_id: companyId,
				},
			});
		} catch (error) {
			console.error("Failed to create Attio deal", failureDetails(error));
		}
	} catch (error) {
		const details = failureDetails(error);
		console.error("Failed to save partnership enquiry in Attio", details);
		return enquiryFallback(details.code);
	}

	return { success: true, accepted: true } as const;
};

export const partnership = {
	apply: defineAction({
		input: enquiryInput,
		handler: saveEnquiry,
	}),
	// Native form posts. The JSON action above stays for the hydrated client.
	applyForm: defineAction({
		accept: "form",
		input: enquiryInput,
		handler: saveEnquiry,
	}),
};
