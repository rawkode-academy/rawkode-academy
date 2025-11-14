import { betterAuth } from "better-auth";
import {
	drizzleAdapter,
	type DB as DrizzleAdapterDatabase,
} from "better-auth/adapters/drizzle";
import { passkey } from "better-auth/plugins/passkey";
import * as dataSchema from "./schema.js";

const DEFAULT_SITE_URL = "https://rawkode.academy";
const DEFAULT_RP_ID = "rawkode.academy";

export interface AuthEnv {
	AUTH_SECRET: string;
	GITHUB_CLIENT_ID: string;
	GITHUB_CLIENT_SECRET: string;
	SITE_URL?: string;
}

export interface CreateAuthContext<Database extends DrizzleAdapterDatabase> {
	env: AuthEnv;
	db: Database;
}

const resolveBaseUrl = (siteUrl?: string) => {
	if (!siteUrl) {
		return DEFAULT_SITE_URL;
	}

	try {
		// Ensure we only accept valid absolute URLs
		return new URL(siteUrl).toString();
	} catch {
		return DEFAULT_SITE_URL;
	}
};

const resolveRpId = (siteUrl?: string) => {
	if (!siteUrl) {
		return DEFAULT_RP_ID;
	}

	try {
		return new URL(siteUrl).hostname || DEFAULT_RP_ID;
	} catch {
		return DEFAULT_RP_ID;
	}
};

export const createAuth = <Database extends DrizzleAdapterDatabase>({
	env,
	db,
}: CreateAuthContext<Database>) => {
	const baseURL = resolveBaseUrl(env.SITE_URL);
	const rpID = resolveRpId(env.SITE_URL);

	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "sqlite",
			schema: dataSchema,
		}),
		secret: env.AUTH_SECRET,
		baseURL,
		socialProviders: {
			github: {
				clientId: env.GITHUB_CLIENT_ID,
				clientSecret: env.GITHUB_CLIENT_SECRET,
			},
		},
		plugins: [
			passkey({
				rpName: "Rawkode Academy",
				rpID,
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
			},
		},
	});
};

export type BetterAuth = ReturnType<typeof createAuth>;
