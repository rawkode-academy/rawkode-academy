import { WorkerEntrypoint } from "cloudflare:workers";
import { CloudEvent } from "cloudevents";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { decodeJwt } from "jose";
import { ZodError } from "zod";
import * as dataSchema from "../data-model/schema.js";
import { badgeCredentialsTable } from "../data-model/schema.js";
import {
	fetchBadgeImage,
	generateBadgeImageUrl,
} from "../lib/image-service.js";
import {
	buildAchievement,
	createIssuerProfile,
	createSignedCredential,
} from "../lib/openbadges/credential.js";
import {
	getPublicKeyJWK,
	issuerKeyId,
	loadRSAKeys,
} from "../lib/openbadges/crypto.js";
import type { AchievementCredential } from "../lib/openbadges/types.js";
import type { Env } from "./main.js";
import { IssueBadgeRequestSchema } from "./schemas.js";

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Authorization, Content-Type",
};

type SecretString = string | { get(): Promise<string> };

async function readSecretString(
	value: SecretString | undefined,
): Promise<string | null> {
	if (typeof value === "string" && value.trim()) return value.trim();
	if (typeof value === "string") return null;
	const secret = await value?.get();
	return typeof secret === "string" && secret.trim() ? secret.trim() : null;
}

function toSecondPrecision(date: Date): Date {
	return new Date(Math.floor(date.getTime() / 1000) * 1000);
}

export class BadgeService extends WorkerEntrypoint<Env> {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const { pathname } = url;
		const method = request.method;

		if (method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: {
					...CORS_HEADERS,
					"Access-Control-Max-Age": "86400",
				},
			});
		}

		if (pathname === "/health") {
			return new Response("ok", { headers: { "Content-Type": "text/plain" } });
		}

		if (method === "POST" && pathname === "/issue") {
			return this.handleIssueBadge(request);
		}

		if (method === "GET" && pathname === "/issuer") {
			return this.handleGetIssuer();
		}

		if (method === "GET" && pathname === "/issuer/key-1") {
			return this.handleGetIssuerKey();
		}

		const jsonMatch = pathname.match(/^\/badge\/([^/]+)\/json$/);
		if (method === "GET" && jsonMatch) {
			return this.handleGetBadgeJson(jsonMatch[1]);
		}

		const imageMatch = pathname.match(/^\/badge\/([^/]+)\/image$/);
		if (method === "GET" && imageMatch) {
			return this.handleGetBadgeImage(imageMatch[1]);
		}

		return new Response(JSON.stringify({ error: "Not Found" }), {
			status: 404,
			headers: { "Content-Type": "application/json", ...CORS_HEADERS },
		});
	}

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
			source: "/badge-service",
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
					attributes: ["user_id", "achievement_type", "badge_id"],
				}),
			});
		} catch (err) {
			console.error("Failed to track analytics event:", err);
		}
	}

	private async requireIssueAuthorization(
		request: Request,
	): Promise<Response | null> {
		const expectedToken = await readSecretString(this.env.BADGE_ISSUER_TOKEN);
		if (!expectedToken) {
			return new Response(
				JSON.stringify({ error: "Badge issuer token is not configured" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json", ...CORS_HEADERS },
				},
			);
		}

		const authHeader = request.headers.get("Authorization") ?? "";
		const providedToken = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

		if (providedToken !== expectedToken) {
			return new Response(JSON.stringify({ error: "Unauthorized" }), {
				status: 401,
				headers: { "Content-Type": "application/json", ...CORS_HEADERS },
			});
		}

		return null;
	}

	private async handleIssueBadge(request: Request): Promise<Response> {
		try {
			const authError = await this.requireIssueAuthorization(request);
			if (authError) return authError;

			const body = await request.json();
			const validated = IssueBadgeRequestSchema.parse(body);

			const {
				userId,
				recipientEmail,
				achievementType,
				achievementName,
				achievementDescription,
				validUntil,
			} = validated;

			const keys = await loadRSAKeys(this.env);

			const badgeId = crypto.randomUUID();

			const issuerProfile = createIssuerProfile(
				this.env.BADGE_ISSUER_URL,
				"Rawkode Academy",
				"badges@rawkode.academy",
			);

			const imageUrl = generateBadgeImageUrl({
				title: achievementName,
				subtitle: achievementType,
			});

			const achievement = buildAchievement({
				id: `${this.env.BADGE_ISSUER_URL}/badge/${badgeId}/achievement`,
				name: achievementName,
				description: achievementDescription,
				imageUrl,
				creatorProfile: issuerProfile,
			});

			const validFromDate = toSecondPrecision(new Date());
			const validUntilDate = validUntil
				? toSecondPrecision(validUntil)
				: undefined;

			if (validUntilDate && validUntilDate <= validFromDate) {
				return new Response(
					JSON.stringify({ error: "validUntil must be after validFrom" }),
					{
						status: 400,
						headers: { "Content-Type": "application/json", ...CORS_HEADERS },
					},
				);
			}

			const signedJWT = await createSignedCredential(
				{
					id: `${this.env.BADGE_ISSUER_URL}/badge/${badgeId}`,
					name: achievementName,
					issuerProfile,
					recipientEmail,
					achievement,
					validFrom: validFromDate,
					validUntil: validUntilDate,
				},
				keys.privateKey,
				this.env.BADGE_ISSUER_URL,
			);

			const db = drizzle(this.env.DB, { schema: dataSchema });
			await db.insert(badgeCredentialsTable).values({
				id: badgeId,
				userId,
				achievementType,
				credentialJson: signedJWT,
				issuedAt: validFromDate,
				expiresAt: validUntilDate ?? null,
			});

			await this.trackAnalyticsEvent("com.rawkode.academy.badge.issued", {
				user_id: userId,
				achievement_type: achievementType,
				badge_id: badgeId,
			});

			return new Response(
				JSON.stringify({
					success: true,
					badgeId,
					credentialUrl: `${this.env.BADGE_ISSUER_URL}/badge/${badgeId}/json`,
					imageUrl: `${this.env.BADGE_ISSUER_URL}/badge/${badgeId}/image`,
				}),
				{
					status: 201,
					headers: { "Content-Type": "application/json", ...CORS_HEADERS },
				},
			);
		} catch (error) {
			if (error instanceof ZodError) {
				return new Response(
					JSON.stringify({
						error: "Validation error",
						details: error.flatten().fieldErrors,
					}),
					{
						status: 400,
						headers: { "Content-Type": "application/json", ...CORS_HEADERS },
					},
				);
			}

			console.error("Failed to issue badge:", error);
			const message = error instanceof Error ? error.message : "Unknown error";
			return new Response(JSON.stringify({ error: message }), {
				status: 500,
				headers: { "Content-Type": "application/json", ...CORS_HEADERS },
			});
		}
	}

	private async handleGetBadgeJson(badgeId: string): Promise<Response> {
		try {
			const db = drizzle(this.env.DB, { schema: dataSchema });
			const badge = await db.query.badgeCredentialsTable.findFirst({
				where: eq(badgeCredentialsTable.id, badgeId),
			});

			if (!badge) {
				return new Response(JSON.stringify({ error: "Badge not found" }), {
					status: 404,
					headers: { "Content-Type": "application/json", ...CORS_HEADERS },
				});
			}

			return new Response(badge.credentialJson, {
				status: 200,
				headers: { "Content-Type": "text/plain", ...CORS_HEADERS },
			});
		} catch (error) {
			console.error("Failed to get badge JSON:", error);
			const message = error instanceof Error ? error.message : "Unknown error";
			return new Response(JSON.stringify({ error: message }), {
				status: 500,
				headers: { "Content-Type": "application/json", ...CORS_HEADERS },
			});
		}
	}

	private async handleGetBadgeImage(badgeId: string): Promise<Response> {
		try {
			const db = drizzle(this.env.DB, { schema: dataSchema });
			const badge = await db.query.badgeCredentialsTable.findFirst({
				where: eq(badgeCredentialsTable.id, badgeId),
			});

			if (!badge) {
				return new Response(JSON.stringify({ error: "Badge not found" }), {
					status: 404,
					headers: { "Content-Type": "application/json", ...CORS_HEADERS },
				});
			}

			const credential = decodeJwt(
				badge.credentialJson,
			) as Partial<AchievementCredential>;

			const achievementName =
				credential.credentialSubject?.achievement?.name ?? "Badge";
			const achievementDescription =
				credential.credentialSubject?.achievement?.description ?? "";

			const imageUrl = generateBadgeImageUrl({
				title: achievementName,
				subtitle: achievementDescription,
			});

			const image = await fetchBadgeImage(imageUrl);

			return new Response(image.body, {
				status: 200,
				headers: {
					"Content-Type": image.contentType,
					"Cache-Control": "public, max-age=3600",
					...CORS_HEADERS,
				},
			});
		} catch (error) {
			console.error("Failed to get badge image:", error);
			const message = error instanceof Error ? error.message : "Unknown error";
			return new Response(JSON.stringify({ error: message }), {
				status: 500,
				headers: { "Content-Type": "application/json", ...CORS_HEADERS },
			});
		}
	}

	private async handleGetIssuer(): Promise<Response> {
		try {
			const keys = await loadRSAKeys(this.env);

			const issuerProfile = createIssuerProfile(
				this.env.BADGE_ISSUER_URL,
				"Rawkode Academy",
				"badges@rawkode.academy",
			);

			const jwk = await getPublicKeyJWK(
				keys.publicKey,
				this.env.BADGE_ISSUER_URL,
			);

			const issuerDocument = {
				...issuerProfile,
				publicKey: {
					id: issuerKeyId(this.env.BADGE_ISSUER_URL),
					type: "JsonWebKey2020",
					controller: issuerProfile.id,
					publicKeyJwk: jwk,
				},
			};

			return new Response(JSON.stringify(issuerDocument), {
				status: 200,
				headers: {
					"Content-Type": "application/ld+json",
					"Cache-Control": "public, max-age=86400",
					...CORS_HEADERS,
				},
			});
		} catch (error) {
			console.error("Failed to get issuer:", error);
			const message = error instanceof Error ? error.message : "Unknown error";
			return new Response(JSON.stringify({ error: message }), {
				status: 500,
				headers: { "Content-Type": "application/json", ...CORS_HEADERS },
			});
		}
	}

	private async handleGetIssuerKey(): Promise<Response> {
		try {
			const keys = await loadRSAKeys(this.env);
			const jwk = await getPublicKeyJWK(
				keys.publicKey,
				this.env.BADGE_ISSUER_URL,
			);

			return new Response(JSON.stringify(jwk), {
				status: 200,
				headers: {
					"Content-Type": "application/jwk+json",
					"Cache-Control": "public, max-age=86400",
					...CORS_HEADERS,
				},
			});
		} catch (error) {
			console.error("Failed to get issuer key:", error);
			const message = error instanceof Error ? error.message : "Unknown error";
			return new Response(JSON.stringify({ error: message }), {
				status: 500,
				headers: { "Content-Type": "application/json", ...CORS_HEADERS },
			});
		}
	}
}
