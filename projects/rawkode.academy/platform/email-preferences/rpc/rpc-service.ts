import { WorkerEntrypoint } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import * as dataSchema from "../data-model/schema.js";
import type { Env } from "./main.js";

interface PreferencePayload {
	audience: string;
	channel?: string;
	status?: "subscribed" | "unsubscribed";
	source?: string;
}

interface EmailPreference {
	userId: string;
	channel: string;
	audience: string;
	status: "subscribed" | "unsubscribed";
}

const CHANNELS = new Set(["marketing", "newsletter", "service"]);

export class EmailPreferencesService extends WorkerEntrypoint<Env> {
	private get db() {
		return drizzle(this.env.DB, { schema: dataSchema });
	}

	/**
	 * Set email preference for a user
	 */
	async setPreference(
		userId: string,
		payload: PreferencePayload,
	): Promise<{
		success: boolean;
		alreadySubscribed: boolean;
		preference: EmailPreference;
	}> {
		const validation = this.validatePayload(payload);
		if (!validation.valid) {
			throw new Error(validation.error ?? "Validation failed");
		}

		const normalized = validation.value;
		
		// Check if preference already exists
		const existing = await this.db.query.emailPreferencesTable.findFirst({
			where: and(
				eq(dataSchema.emailPreferencesTable.userId, userId),
				eq(dataSchema.emailPreferencesTable.channel, normalized.channel),
				eq(dataSchema.emailPreferencesTable.audience, normalized.audience)
			),
		});

		const alreadySubscribed = existing !== undefined;
		const now = new Date();

		if (normalized.status === "subscribed") {
			// Insert or update preference
			if (!existing) {
				await this.db.insert(dataSchema.emailPreferencesTable).values({
					userId,
					channel: normalized.channel,
					audience: normalized.audience,
					createdAt: now,
				});
			}
		} else {
			// Remove preference if unsubscribing
			if (existing) {
				await this.db.delete(dataSchema.emailPreferencesTable)
					.where(and(
						eq(dataSchema.emailPreferencesTable.userId, userId),
						eq(dataSchema.emailPreferencesTable.channel, normalized.channel),
						eq(dataSchema.emailPreferencesTable.audience, normalized.audience)
					));
			}
		}

		// Record the event
		await this.db.insert(dataSchema.emailPreferenceEventsTable).values({
			userId,
			channel: normalized.channel,
			audience: normalized.audience,
			action: normalized.status,
			occurredAt: now,
		});

		const preference: EmailPreference = {
			userId,
			channel: normalized.channel,
			audience: normalized.audience,
			status: normalized.status,
		};

		return {
			success: true,
			alreadySubscribed,
			preference,
		};
	}

	/**
	 * Get email preferences for a user
	 */
	async getPreferences(
		userId: string, 
		channel?: string,
		audience?: string
	): Promise<EmailPreference[]> {
		const preferences = await this.db.query.emailPreferencesTable.findMany({
			where: and(
				eq(dataSchema.emailPreferencesTable.userId, userId),
				channel ? eq(dataSchema.emailPreferencesTable.channel, channel) : undefined,
				audience ? eq(dataSchema.emailPreferencesTable.audience, audience) : undefined,
			),
		});

		return preferences.map(pref => ({
			userId: pref.userId,
			channel: pref.channel,
			audience: pref.audience,
			status: "subscribed" as const,
		}));
	}

	private validatePayload(
		payload: PreferencePayload,
	):
		| { valid: true; value: Required<Omit<PreferencePayload, "source">> & { source?: string } }
		| { valid: false; error?: string } {
		if (!payload || typeof payload !== "object") {
			return { valid: false, error: "Payload must be an object" };
		}

		const audience = (payload.audience ?? "").toString().trim();
		if (!audience) {
			return { valid: false, error: "Audience identifier is required" };
		}

		const rawChannel = (payload.channel ?? "marketing")
			.toString()
			.trim()
			.toLowerCase();
		const channel = CHANNELS.has(rawChannel) ? rawChannel : "marketing";

		const status =
			payload.status === "unsubscribed" ? "unsubscribed" : "subscribed";

		const source = payload.source ? payload.source.toString().trim() : undefined;
		if (source && source.length > 255) {
			return {
				valid: false,
				error: "Source field is too long (max 255 characters)",
			};
		}

		return {
			valid: true,
			value: {
				audience,
				channel,
				status,
				source,
			},
		};
	}
}