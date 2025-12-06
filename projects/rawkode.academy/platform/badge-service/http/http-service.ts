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
import { getPublicKeyJWK, loadRSAKeys } from "../lib/openbadges/crypto.js";
import type { AchievementCredential } from "../lib/openbadges/types.js";
import type { Env } from "./main.js";
import { IssueBadgeRequestSchema } from "./schemas.js";

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

export class BadgeService extends WorkerEntrypoint<Env> {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const { pathname } = url;
		const method = request.method;

		// CORS preflight
		if (method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: {
					...CORS_HEADERS,
					"Access-Control-Max-Age": "86400",
				},
			});
		}

		// Health check
		if (pathname === "/health") {
			return new Response("ok", { headers: { "Content-Type": "text/plain" } });
		}

		// POST /issue
		if (method === "POST" && pathname === "/issue") {
			return this.handleIssueBadge(request);
		}

		// GET /issuer
		if (method === "GET" && pathname === "/issuer") {
			return this.handleGetIssuer();
		}

		// GET /badge/:id/json
		const jsonMatch = pathname.match(/^\/badge\/([^/]+)\/json$/);
		if (method === "GET" && jsonMatch) {
			return this.handleGetBadgeJson(jsonMatch[1]);
		}

		// GET /badge/:id/image
		const imageMatch = pathname.match(/^\/badge\/([^/]+)\/image$/);
		if (method === "GET" && imageMatch) {
			return this.handleGetBadgeImage(imageMatch[1]);
		}

		return new Response(JSON.stringify({ error: "Not Found" }), {
			status: 404,
			headers: { "Content-Type": "application/json", ...CORS_HEADERS },
		});
	}

	private async validateUser(
		userId: string,
	): Promise<{ valid: boolean; email?: string }> {
		try {
			const response = await this.env.IDENTITY.fetch(
				`https://id.rawkode.academy/api/user/${userId}`,
			);

			if (response.status === 200) {
				const user = (await response.json()) as { email?: string };
				return { valid: true, email: user.email };
			}

			return { valid: false };
		} catch (error) {
			console.error("Failed to validate user:", error);
			return { valid: false };
		}
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

	private async handleIssueBadge(request: Request): Promise<Response> {
		try {
			const body = await request.json();
			const validated = IssueBadgeRequestSchema.parse(body);

			const {
				userId,
				achievementType,
				achievementName,
				achievementDescription,
				validUntil,
			} = validated;

			// Validate user exists
			const userValidation = await this.validateUser(userId);
			if (!userValidation.valid) {
				return new Response(JSON.stringify({ error: "User not found" }), {
					status: 404,
					headers: { "Content-Type": "application/json", ...CORS_HEADERS },
				});
			}

			const userEmail = userValidation.email ?? `${userId}@rawkode.academy`;

			// Load RSA keys
			const keys = await loadRSAKeys(this.env);

			// Generate badge ID
			const badgeId = crypto.randomUUID();

			// Create issuer profile
			const issuerProfile = createIssuerProfile(
				this.env.BADGE_ISSUER_URL,
				"Rawkode Academy",
				"badges@rawkode.academy",
			);

			// Generate badge image URL
			const imageUrl = generateBadgeImageUrl({
				title: achievementName,
				subtitle: achievementType,
			});

			// Build achievement
			const achievement = buildAchievement({
				id: `${this.env.BADGE_ISSUER_URL}/badge/${badgeId}/achievement`,
				name: achievementName,
				description: achievementDescription,
				imageUrl,
				creatorProfile: issuerProfile,
			});

			// Create signed credential
			const validFromDate = new Date();
			const validUntilDate = validUntil ?? undefined;

			const signedJWT = await createSignedCredential(
				{
					id: `${this.env.BADGE_ISSUER_URL}/badge/${badgeId}`,
					name: achievementName,
					issuerProfile,
					recipientEmail: userEmail,
					achievement,
					validFrom: validFromDate,
					validUntil: validUntilDate,
				},
				keys.privateKey,
				this.env.BADGE_ISSUER_URL,
			);

			// Store in database
			const db = drizzle(this.env.DB, { schema: dataSchema });
			await db.insert(badgeCredentialsTable).values({
				id: badgeId,
				userId,
				achievementType,
				credentialJson: signedJWT,
				issuedAt: validFromDate,
				expiresAt: validUntilDate ?? null,
			});

			// Track analytics
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

			const decoded = decodeJwt(badge.credentialJson) as AchievementCredential;

			// Extract credential body and include JWT proof for external verification
			const credential = {
				"@context": decoded["@context"],
				id: decoded.id,
				type: decoded.type,
				name: decoded.name,
				issuer: decoded.issuer,
				credentialSubject: decoded.credentialSubject,
				validFrom: decoded.validFrom,
				...(decoded.validUntil && { validUntil: decoded.validUntil }),
				proof: [
					{
						type: "DataIntegrityProof",
						cryptosuite: "eddsa-rdfc-2022",
						created: decoded.validFrom,
						verificationMethod: `${decoded.issuer.id}#key-1`,
						proofPurpose: "assertionMethod",
						proofValue: badge.credentialJson,
					},
				],
			};

			return new Response(JSON.stringify(credential), {
				status: 200,
				headers: { "Content-Type": "application/ld+json", ...CORS_HEADERS },
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

			const svgContent = await fetchBadgeImage(imageUrl);

			return new Response(svgContent, {
				status: 200,
				headers: {
					"Content-Type": "image/svg+xml",
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
					id: `${this.env.BADGE_ISSUER_URL}/issuer#key-1`,
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

}
