import { defineAction } from "astro:actions";
import { z } from "astro/zod";
import { EmailMessage } from "cloudflare:email";
import { env } from "cloudflare:workers";
import { SPRINT_APPLICATION_PATH } from "@/lib/partnerships";

// Sender must be on a domain onboarded to Cloudflare Email Routing.
// rawkode.academy's MX points at Google Workspace, so we send from
// rawkode.email and deliver to the verified destination address below.
const FROM_ADDRESS = "partnerships@rawkode.email";
const TO_ADDRESS = "david@rawkode.academy";

/** Strip CR/LF so user input can never inject extra MIME headers. */
const sanitizeHeader = (value: string): string =>
	value.replace(/[\r\n]+/g, " ").trim();

/** RFC 2047 encode a header value when it contains non-ASCII characters. */
const encodeHeader = (value: string): string => {
	const clean = sanitizeHeader(value);
	if (/^[\x20-\x7e]*$/.test(clean)) {
		return clean;
	}
	const bytes = new TextEncoder().encode(clean);
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return `=?utf-8?B?${btoa(binary)}?=`;
};

export const partnership = {
	apply: defineAction({
		input: z.object({
			email: z.email("Please enter a valid work email"),
			company: z
				.string()
				.trim()
				.min(1, "Please tell us about your company and product")
				.max(1000),
			technicalBuyer: z
				.string()
				.trim()
				.min(1, "Please tell us who the technical buyer is")
				.max(2000),
			challenge: z
				.string()
				.trim()
				.min(1, "Please describe the adoption problem")
				.max(5000),
			links: z.string().trim().max(2000).optional(),
		}),
		handler: async (input) => {
			const subject = encodeHeader(
				`${SPRINT_APPLICATION_PATH}: ${input.company}`.slice(0, 180),
			);

			const body = [
				`Email: ${input.email}`,
				`Path: ${SPRINT_APPLICATION_PATH}`,
				"",
				"Company/product:",
				input.company,
				"",
				"Technical buyer:",
				input.technicalBuyer,
				"",
				"Adoption problem:",
				input.challenge,
				...(input.links ? ["", "Links:", input.links] : []),
				"",
			].join("\r\n");

			const raw = [
				`From: Rawkode Academy Partnerships <${FROM_ADDRESS}>`,
				`To: <${TO_ADDRESS}>`,
				`Reply-To: <${sanitizeHeader(input.email)}>`,
				`Subject: ${subject}`,
				`Message-ID: <${crypto.randomUUID()}@rawkode.email>`,
				`Date: ${new Date().toUTCString()}`,
				"MIME-Version: 1.0",
				'Content-Type: text/plain; charset="utf-8"',
				"Content-Transfer-Encoding: 8bit",
				"",
				body,
			].join("\r\n");

			try {
				await env.PARTNERSHIP_APPLICATIONS.send(
					new EmailMessage(FROM_ADDRESS, TO_ADDRESS, raw),
				);
			} catch (error) {
				console.error("Failed to send partnership application:", error);
				throw new Error(
					"We could not send your application. Please email david@rawkode.academy directly.",
				);
			}

			return { success: true };
		},
	}),
};
