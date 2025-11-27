import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { oidcProvider } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";

type SecretsStoreSecret =
	import("@cloudflare/workers-types").SecretsStoreSecret;

export interface AuthEnv {
	DB: D1Database;
	AUTH_SECRET: SecretsStoreSecret;
	GITHUB_OAUTH_CLIENT_ID: SecretsStoreSecret;
	GITHUB_OAUTH_CLIENT_SECRET: SecretsStoreSecret;
	SITE_URL?: string;
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
			},
		},

		plugins: [
			oidcProvider({
				loginPage: "/auth/sign-in/social?provider=github",
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
				],
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

		trustedOrigins: ["https://rawkode.academy", "http://localhost:4321"],
	});
};

export type Auth = Awaited<ReturnType<typeof createAuth>>;
