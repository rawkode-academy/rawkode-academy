import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { oidcProvider, organization } from "better-auth/plugins";
import { eq, and, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import {
	ac,
	owner,
	admin,
	moderator,
	contributor,
	member,
} from "./access-control";
import { captureAuthEvent } from "./analytics";

type SecretsStoreSecret =
	import("@cloudflare/workers-types").SecretsStoreSecret;

export interface AuthEnv {
	DB: D1Database;
	AUTH_SECRET: SecretsStoreSecret;
	GITHUB_OAUTH_CLIENT_ID: SecretsStoreSecret;
	GITHUB_OAUTH_CLIENT_SECRET: SecretsStoreSecret;
	SITE_URL?: string;
	ANALYTICS?: Fetcher;
}

const DEFAULT_SITE_URL = "https://id.rawkode.academy";

const resolveBaseUrl = (siteUrl?: string) => {
	if (!siteUrl) {
		return DEFAULT_SITE_URL;
	}
	try {
		return new URL(siteUrl).toString().replace(/\/$/, "");
	} catch {
		return DEFAULT_SITE_URL;
	}
};

export const createAuth = async (env: AuthEnv) => {
	const db = drizzle(env.DB, { schema });
	const baseURL = resolveBaseUrl(env.SITE_URL);

	const [authSecret, githubClientId, githubClientSecret] = await Promise.all([
		env.AUTH_SECRET.get(),
		env.GITHUB_OAUTH_CLIENT_ID.get(),
		env.GITHUB_OAUTH_CLIENT_SECRET.get(),
	]);

	return betterAuth({
		basePath: "/auth",
		baseURL,
		database: drizzleAdapter(db, {
			provider: "sqlite",
			schema,
		}),
		secret: authSecret,

		socialProviders: {
			github: {
				clientId: githubClientId,
				clientSecret: githubClientSecret,
				mapProfileToUser: (profile) => ({
					username: profile.login,
				}),
			},
		},

		plugins: [
			oidcProvider({
				loginPage: "/auth/sign-in/social",
				trustedClients: [
					{
						clientId: "rawkode-academy-website",
						name: "Rawkode Academy",
						type: "web",
						redirectUrls: [
							"https://rawkode.academy/api/auth/oauth2/callback/id-rawkode-academy",
							"http://localhost:4321/api/auth/oauth2/callback/id-rawkode-academy",
						],
						disabled: false,
						skipConsent: true,
						metadata: null,
					},
					{
						clientId: "klustered-dev",
						name: "Klustered Dev",
						type: "public",
						// Workaround for https://github.com/better-auth/better-auth/issues/6651
						// Better Auth incorrectly requires a secret for ID token signing even for public clients
						clientSecret: "pkce-public-client-placeholder",
						redirectUrls: [
							"https://klustered.dev/api/auth/callback",
							"http://localhost:4322/api/auth/callback",
						],
						disabled: false,
						skipConsent: true,
						metadata: null,
					},
					{
						clientId: "rawkode-news",
						name: "Rawkode News",
						type: "public",
						// Workaround for https://github.com/better-auth/better-auth/issues/6651
						// Better Auth incorrectly requires a secret for ID token signing even for public clients
						clientSecret: "pkce-public-client-placeholder",
						redirectUrls: [
							"https://rawkode.news/api/auth/callback",
							"http://localhost:4321/api/auth/callback",
						],
						disabled: false,
						skipConsent: true,
						metadata: null,
					},					
				],
			}),
			organization({
				ac,
				roles: {
					owner,
					admin,
					moderator,
					contributor,
					member,
				},
				teams: {
					enabled: true,
					maximumTeams: 10,
				},
				allowUserToCreateOrganization: true,
				organizationLimit: 5,
				creatorRole: "owner",
				membershipLimit: 100,
				invitationExpiresIn: 60 * 60 * 48,
			}),
		],

		session: {
			cookieCache: {
				enabled: true,
				maxAge: 5 * 60,
			},
			expiresIn: 60 * 60 * 24 * 7,
			updateAge: 60 * 60 * 24,
		},

		advanced: {
			generateId: () => crypto.randomUUID(),
			crossSubDomainCookies: {
				enabled: true,
				domain: ".rawkode.academy",
			},
		},

		trustedOrigins: [
			"https://rawkode.academy",
			"http://localhost:4321",
			"https://klustered.dev",
			"http://localhost:4322",
		],

		databaseHooks: {
			user: {
				create: {
					after: async (user) => {
						await captureAuthEvent(
							{
								event: "auth.user_registered",
								distinctId: user.id,
								properties: {
									$set: {
										email: user.email,
										name: user.name,
									},
									$set_once: {
										registered_at: new Date().toISOString(),
									},
								},
							},
							env.ANALYTICS,
						);
					},
				},
			},
			session: {
				create: {
					after: async (session) => {
						await captureAuthEvent(
							{
								event: "auth.sign_in_completed",
								distinctId: session.userId,
								properties: {
									auth_method: "github",
									$set: {
										last_sign_in: new Date().toISOString(),
									},
								},
							},
							env.ANALYTICS,
						);

						// Backfill username for existing users who don't have one
						const userRecord = await db.query.user.findFirst({
							where: eq(schema.user.id, session.userId),
						});

						if (!userRecord?.username) {
							const accountRecord = await db.query.account.findFirst({
								where: and(
									eq(schema.account.userId, session.userId),
									eq(schema.account.providerId, "github"),
								),
							});

							if (accountRecord?.accessToken) {
								try {
									const response = await fetch("https://api.github.com/user", {
										headers: {
											Authorization: `Bearer ${accountRecord.accessToken}`,
											Accept: "application/vnd.github+json",
											"User-Agent": "rawkode-academy-identity",
										},
									});

									if (response.ok) {
										const profile = (await response.json()) as { login?: string };
										if (profile.login) {
											await db
												.update(schema.user)
												.set({ username: profile.login })
												.where(eq(schema.user.id, session.userId));
										}
									}
								} catch (error) {
									await captureAuthEvent(
										{
											event: "auth.username_backfill_failed",
											distinctId: session.userId,
											properties: {
												error: error instanceof Error ? error.message : "Unknown error",
											},
										},
										env.ANALYTICS,
									);
								}
							}
						}
					},
				},
			},
		},
	});
};

export type Auth = Awaited<ReturnType<typeof createAuth>>;
