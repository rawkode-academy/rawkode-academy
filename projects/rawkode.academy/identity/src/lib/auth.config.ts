import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt, oidcProvider, organization } from "better-auth/plugins";

// Static config for better-auth CLI schema generation
// Runtime auth uses createAuth() in auth.ts
export const auth = betterAuth({
	database: drizzleAdapter(null as any, {
		provider: "sqlite",
	}),
	plugins: [
		jwt({
			jwks: {
				keyPairConfig: {
					alg: "RS256",
					modulusLength: 2048,
				},
			},
		}),
		oidcProvider({
			loginPage: "/auth/sign-in/social",
			useJWTPlugin: true,
		}),
		organization({
			teams: {
				enabled: true,
			},
		}),
	],
});
