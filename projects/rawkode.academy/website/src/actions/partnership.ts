import { defineAction } from "astro:actions";
import { env } from "cloudflare:workers";
import { escapeHtml } from "@rawkodeacademy/rich-text";
import { z } from "astro/zod";
import {
	applicationPathLabels,
	applicationPaths,
	PARTNERSHIP_EMAIL,
	resolveApplicationPath,
} from "@/lib/partnerships";

const ENQUIRY_SENDER = {
	email: "david@rawkode.email",
	name: "Rawkode Academy enquiries",
};

type EnquiryErrorCode =
	| "email_unconfigured"
	| "email_send_failed"
	| "enquiry_unavailable";

const enquiryFallback = (code: EnquiryErrorCode) => {
	// Provider errors may contain the submitted address or message. Log only
	// our own failure code; never expose submitted content or provider messages.
	console.error("Failed to email Academy enquiry", { code });
	return { success: false, fallback: "mailto", code } as const;
};

const rateLimitKey = async (request: Request): Promise<string> => {
	const address =
		request.headers.get("CF-Connecting-IP") ??
		request.headers.get("x-forwarded-for") ??
		"unknown";
	const source = new TextEncoder().encode(`partnership-enquiry:${address}`);
	const digest = await crypto.subtle.digest("SHA-256", source);
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
};

const enquiryInput = z.object({
	name: z.string().trim().min(1, "Please tell us your name").max(200),
	email: z.email("Please enter a valid work email").max(254),
	company: z.string().trim().min(1, "Please tell us your company").max(1000),
	path: z
		.string()
		.transform((path) => resolveApplicationPath(path) ?? path)
		.pipe(z.enum(applicationPaths)),
	message: z.string().trim().min(1, "Please add a message").max(5000),
	website: z.string().trim().max(500).optional().default(""),
});

const sendEnquiry = async (
	input: z.infer<typeof enquiryInput>,
	context: { request: Request },
) => {
	if (input.website) {
		return { success: true, accepted: false } as const;
	}

	try {
		const rateLimit = await env.PARTNERSHIP_FORM_RATE_LIMITER.limit({
			key: await rateLimitKey(context.request),
		});
		if (!rateLimit.success) {
			return { success: false, rateLimited: true } as const;
		}
	} catch {
		return enquiryFallback("enquiry_unavailable");
	}

	if (!env.PARTNERSHIP_EMAIL) {
		return enquiryFallback("email_unconfigured");
	}

	const route = applicationPathLabels[input.path];
	const details = [
		["Name", input.name],
		["Email", input.email],
		["Company", input.company],
		["Interested in", route],
	] as const;
	const text = [
		"New Academy enquiry from rawkode.academy",
		"",
		...details.map(([label, value]) => `${label}: ${value}`),
		"",
		"Message:",
		input.message,
	].join("\n");
	const html = [
		"<h1>New Academy enquiry</h1>",
		"<dl>",
		...details.map(
			([label, value]) => `<dt>${label}</dt><dd>${escapeHtml(value)}</dd>`,
		),
		"</dl><h2>Message</h2>",
		`<div style="white-space: pre-wrap">${escapeHtml(input.message)}</div>`,
	].join("\n");

	try {
		// Only trusted copy goes into the subject. The binding also restricts
		// delivery to David, so this public form cannot choose another recipient.
		await env.PARTNERSHIP_EMAIL.send({
			from: ENQUIRY_SENDER,
			to: PARTNERSHIP_EMAIL,
			replyTo: input.email,
			subject: `Rawkode Academy enquiry: ${route}`,
			text,
			html,
		});
	} catch {
		return enquiryFallback("email_send_failed");
	}

	return { success: true, accepted: true } as const;
};

export const partnership = {
	apply: defineAction({
		input: enquiryInput,
		handler: sendEnquiry,
	}),
	// Native form posts. The JSON action above stays for the hydrated client.
	applyForm: defineAction({
		accept: "form",
		input: enquiryInput,
		handler: sendEnquiry,
	}),
};
