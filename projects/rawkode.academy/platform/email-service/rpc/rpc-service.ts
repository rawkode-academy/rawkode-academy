import { WorkerEntrypoint } from "cloudflare:workers";
import { CloudEvent } from "cloudevents";
import { EmailMessage } from "cloudflare:email";
import type { Env } from "./main.js";

/**
 * Email envelope types for different email categories
 */
export type EmailEnvelopeType = "service" | "marketing" | "transactional";

/**
 * Email recipient information
 */
export interface EmailRecipient {
	email: string;
	name?: string;
	userId?: string;
}

/**
 * Email content structure
 */
export interface EmailContent {
	subject: string;
	htmlBody: string;
	textBody: string;
}

/**
 * Common email options
 */
export interface EmailOptions {
	recipient: EmailRecipient;
	content: EmailContent;
	replyTo?: string;
	unsubscribeUrl?: string;
	preferencesUrl?: string;
}

/**
 * Result of sending an email
 */
export interface SendEmailResult {
	success: boolean;
	messageId?: string;
	error?: string;
}

/**
 * Email service configuration
 */
const EMAIL_CONFIG = {
	fromAddress: "david@rawkode.email",
	fromName: "Rawkode Academy",
	defaultUnsubscribeUrl: "https://rawkode.academy/email/unsubscribe",
	defaultPreferencesUrl: "https://rawkode.academy/email/preferences",
};

export class EmailService extends WorkerEntrypoint<Env> {
	async fetch(request: Request): Promise<Response> {
		// Health check endpoint
		if (new URL(request.url).pathname === "/health") {
			return new Response("ok", { headers: { "Content-Type": "text/plain" } });
		}

		return new Response("Not Found", { status: 404 });
	}

	/**
	 * Track an analytics event via the analytics service
	 */
	private async trackAnalyticsEvent(
		eventType: string,
		data: Record<string, unknown>,
	): Promise<void> {
		if (!this.env.ANALYTICS) {
			console.warn("Analytics service not configured");
			return;
		}

		const cloudEvent = new CloudEvent({
			specversion: "1.0",
			type: eventType,
			source: "/email-service",
			id: crypto.randomUUID(),
			time: new Date().toISOString(),
			datacontenttype: "application/json",
			data,
		});

		try {
			await this.env.ANALYTICS.fetch("https://analytics.internal/track", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					event: cloudEvent,
					attributes: ["email_type", "recipient_email"],
				}),
			});
		} catch (err) {
			console.error("Failed to track analytics event", err);
		}
	}

	/**
	 * Send a service email (account-related, password resets, etc.)
	 * These emails have minimal envelope decoration and are always sent.
	 */
	async sendServiceEmail(options: EmailOptions): Promise<SendEmailResult> {
		return this.sendEmail("service", options);
	}

	/**
	 * Send a marketing email (newsletters, promotions, etc.)
	 * These emails include full unsubscribe links and respect email preferences.
	 */
	async sendMarketingEmail(options: EmailOptions): Promise<SendEmailResult> {
		return this.sendEmail("marketing", options);
	}

	/**
	 * Send a transactional email (order confirmations, event registrations, etc.)
	 * These emails include preference management links.
	 */
	async sendTransactionalEmail(options: EmailOptions): Promise<SendEmailResult> {
		return this.sendEmail("transactional", options);
	}

	/**
	 * Internal method to send an email with the appropriate envelope
	 */
	private async sendEmail(
		envelopeType: EmailEnvelopeType,
		options: EmailOptions,
	): Promise<SendEmailResult> {
		try {
			const { recipient, content, replyTo, unsubscribeUrl, preferencesUrl } = options;

			// Build the email with envelope
			const emailContent = this.buildEmailWithEnvelope(
				envelopeType,
				content,
				recipient,
				unsubscribeUrl ?? EMAIL_CONFIG.defaultUnsubscribeUrl,
				preferencesUrl ?? EMAIL_CONFIG.defaultPreferencesUrl,
			);

			// Build the raw email message
			const rawEmail = this.buildRawEmail({
				from: `${EMAIL_CONFIG.fromName} <${EMAIL_CONFIG.fromAddress}>`,
				to: recipient.name
					? `${recipient.name} <${recipient.email}>`
					: recipient.email,
				subject: content.subject,
				htmlBody: emailContent.html,
				textBody: emailContent.text,
				replyTo,
				envelopeType,
				unsubscribeUrl: unsubscribeUrl ?? EMAIL_CONFIG.defaultUnsubscribeUrl,
			});

			// Create and send the email message
			const message = new EmailMessage(
				EMAIL_CONFIG.fromAddress,
				recipient.email,
				rawEmail,
			);

			await this.env.SEND_EMAIL.send(message);

			const messageId = crypto.randomUUID();

			// Track email sent analytics event
			await this.trackAnalyticsEvent("com.rawkode.academy.email.sent", {
				email_type: envelopeType,
				recipient_email: recipient.email,
				recipient_user_id: recipient.userId,
				message_id: messageId,
				subject: content.subject,
			});

			return {
				success: true,
				messageId,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			console.error(`Failed to send ${envelopeType} email:`, errorMessage);
			return {
				success: false,
				error: errorMessage,
			};
		}
	}

	/**
	 * Build email content with the appropriate envelope based on type
	 */
	private buildEmailWithEnvelope(
		envelopeType: EmailEnvelopeType,
		content: EmailContent,
		recipient: EmailRecipient,
		unsubscribeUrl: string,
		preferencesUrl: string,
	): { html: string; text: string } {
		const unsubscribeLink = recipient.userId
			? `${unsubscribeUrl}?userId=${encodeURIComponent(recipient.userId)}`
			: unsubscribeUrl;
		const preferencesLink = recipient.userId
			? `${preferencesUrl}?userId=${encodeURIComponent(recipient.userId)}`
			: preferencesUrl;

		let footerHtml = "";
		let footerText = "";

		switch (envelopeType) {
			case "service":
				// Minimal footer for service emails
				footerHtml = `
					<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666;">
						<p>This is an automated message from Rawkode Academy.</p>
						<p>&copy; ${new Date().getFullYear()} Rawkode Academy. All rights reserved.</p>
					</div>
				`;
				footerText = `
---
This is an automated message from Rawkode Academy.
© ${new Date().getFullYear()} Rawkode Academy. All rights reserved.
				`;
				break;

			case "marketing":
				// Full unsubscribe options for marketing emails
				footerHtml = `
					<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666;">
						<p>You received this email because you subscribed to Rawkode Academy updates.</p>
						<p>
							<a href="${unsubscribeLink}" style="color: #666;">Unsubscribe</a> |
							<a href="${preferencesLink}" style="color: #666;">Manage email preferences</a>
						</p>
						<p>&copy; ${new Date().getFullYear()} Rawkode Academy. All rights reserved.</p>
					</div>
				`;
				footerText = `
---
You received this email because you subscribed to Rawkode Academy updates.

Unsubscribe: ${unsubscribeLink}
Manage email preferences: ${preferencesLink}

© ${new Date().getFullYear()} Rawkode Academy. All rights reserved.
				`;
				break;

			case "transactional":
				// Preference management for transactional emails
				footerHtml = `
					<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666;">
						<p>This is a transactional email from Rawkode Academy.</p>
						<p>
							<a href="${preferencesLink}" style="color: #666;">Manage email preferences</a>
						</p>
						<p>&copy; ${new Date().getFullYear()} Rawkode Academy. All rights reserved.</p>
					</div>
				`;
				footerText = `
---
This is a transactional email from Rawkode Academy.

Manage email preferences: ${preferencesLink}

© ${new Date().getFullYear()} Rawkode Academy. All rights reserved.
				`;
				break;
		}

		// Wrap HTML content with envelope
		const wrappedHtml = `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>${this.escapeHtml(content.subject)}</title>
			</head>
			<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
				${content.htmlBody}
				${footerHtml}
			</body>
			</html>
		`;

		// Build text version
		const wrappedText = content.textBody + footerText;

		return {
			html: wrappedHtml.trim(),
			text: wrappedText.trim(),
		};
	}

	/**
	 * Build a raw RFC 5322 compliant email message
	 */
	private buildRawEmail(options: {
		from: string;
		to: string;
		subject: string;
		htmlBody: string;
		textBody: string;
		replyTo?: string;
		envelopeType: EmailEnvelopeType;
		unsubscribeUrl: string;
	}): string {
		const boundary = `----=_Part_${crypto.randomUUID().replace(/-/g, "")}`;
		const messageId = `<${crypto.randomUUID()}@rawkode.email>`;
		const date = new Date().toUTCString();

		const headers = [
			`From: ${options.from}`,
			`To: ${options.to}`,
			`Subject: ${this.encodeHeader(options.subject)}`,
			`Date: ${date}`,
			`Message-ID: ${messageId}`,
			`MIME-Version: 1.0`,
			`Content-Type: multipart/alternative; boundary="${boundary}"`,
		];

		// Add Reply-To if specified
		if (options.replyTo) {
			headers.push(`Reply-To: ${options.replyTo}`);
		}

		// Add List-Unsubscribe header for marketing emails (RFC 8058)
		if (options.envelopeType === "marketing") {
			headers.push(`List-Unsubscribe: <${options.unsubscribeUrl}>`);
			headers.push(`List-Unsubscribe-Post: List-Unsubscribe=One-Click`);
		}

		// Add X-headers for tracking and categorization
		headers.push(`X-Mailer: Rawkode-Academy-Email-Service`);
		headers.push(`X-Email-Type: ${options.envelopeType}`);

		const emailParts = [
			headers.join("\r\n"),
			"",
			`--${boundary}`,
			"Content-Type: text/plain; charset=utf-8",
			"Content-Transfer-Encoding: quoted-printable",
			"",
			this.encodeQuotedPrintable(options.textBody),
			"",
			`--${boundary}`,
			"Content-Type: text/html; charset=utf-8",
			"Content-Transfer-Encoding: quoted-printable",
			"",
			this.encodeQuotedPrintable(options.htmlBody),
			"",
			`--${boundary}--`,
		];

		return emailParts.join("\r\n");
	}

	/**
	 * Encode a header value for email (RFC 2047)
	 */
	private encodeHeader(value: string): string {
		// Check if encoding is needed
		if (/^[\x20-\x7E]*$/.test(value)) {
			return value;
		}
		// Encode as UTF-8 base64
		const encoded = btoa(unescape(encodeURIComponent(value)));
		return `=?UTF-8?B?${encoded}?=`;
	}

	/**
	 * Encode content as quoted-printable (RFC 2045)
	 * Lines are wrapped at 76 characters maximum, accounting for the soft line break
	 */
	private encodeQuotedPrintable(text: string): string {
		const encoded = text
			.split("")
			.map((char) => {
				const code = char.charCodeAt(0);
				if (
					(code >= 33 && code <= 60) ||
					(code >= 62 && code <= 126) ||
					char === " " ||
					char === "\t"
				) {
					return char;
				}
				if (char === "\r" || char === "\n") {
					return char;
				}
				return `=${code.toString(16).toUpperCase().padStart(2, "0")}`;
			})
			.join("");

		// Wrap lines at 76 characters maximum (73 chars + "=\r\n" = 76)
		// Avoid breaking in the middle of encoded sequences (=XX)
		const lines: string[] = [];
		let currentLine = "";

		for (let i = 0; i < encoded.length; i++) {
			const char = encoded[i];

			// Check if this is a newline
			if (char === "\r" && encoded[i + 1] === "\n") {
				lines.push(currentLine);
				currentLine = "";
				i++; // Skip the \n
				continue;
			}
			if (char === "\n") {
				lines.push(currentLine);
				currentLine = "";
				continue;
			}

			// Check if we need to wrap before this character
			const potentialLength = currentLine.length + (char === "=" ? 3 : 1);
			if (potentialLength > 73) {
				lines.push(currentLine + "=");
				currentLine = char;
			} else {
				currentLine += char;
				// If this starts an encoded sequence, include the full sequence
				if (char === "=" && i + 2 < encoded.length) {
					currentLine += encoded[i + 1] + encoded[i + 2];
					i += 2;
				}
			}
		}

		if (currentLine) {
			lines.push(currentLine);
		}

		return lines.join("\r\n");
	}

	/**
	 * Escape HTML special characters
	 */
	private escapeHtml(text: string): string {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;");
	}
}
