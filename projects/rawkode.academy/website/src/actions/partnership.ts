import { defineAction } from "astro:actions";
import { z } from "astro/zod";
import { EmailMessage } from "cloudflare:email";
import { env } from "cloudflare:workers";
import { applicationPaths } from "@/lib/partnerships";

const FROM_ADDRESS = "partnerships@rawkode.academy";
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
			name: z.string().trim().min(1, "Please tell us your name").max(200),
			email: z.email("Please enter a valid work email"),
			company: z
				.string()
				.trim()
				.min(1, "Please tell us about your company and product")
				.max(1000),
			path: z.enum(applicationPaths),
			targetDevelopers: z
				.string()
				.trim()
				.min(1, "Please tell us which developers you need to reach")
				.max(2000),
			challenge: z
				.string()
				.trim()
				.min(1, "Please describe your current adoption challenge")
				.max(5000),
			links: z.string().trim().max(2000).optional(),
			// Honeypot: real users never fill this in.
			website: z.string().optional(),
		}),
		handler: async (input) => {
			if (input.website) {
				return { success: true };
			}

			const subject = encodeHeader(
				`Partnership application: ${input.path} - ${input.company}`.slice(
					0,
					180,
				),
			);

			const body = [
				`Name: ${input.name}`,
				`Email: ${input.email}`,
				`Preferred path: ${input.path}`,
				"",
				"Company and product:",
				input.company,
				"",
				"Target developers or platform teams:",
				input.targetDevelopers,
				"",
				"Current adoption challenge:",
				input.challenge,
				...(input.links ? ["", "Links worth a look:", input.links] : []),
				"",
			].join("\r\n");

			const raw = [
				`From: Rawkode Academy Partnerships <${FROM_ADDRESS}>`,
				`To: <${TO_ADDRESS}>`,
				`Reply-To: <${sanitizeHeader(input.email)}>`,
				`Subject: ${subject}`,
				`Message-ID: <${crypto.randomUUID()}@rawkode.academy>`,
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
