import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { oidcProvider } from "better-auth/plugins";

// Static config for better-auth CLI schema generation
// Runtime auth uses createAuth() in auth.ts
export const auth = betterAuth({
	database: drizzleAdapter(null as any, {
		provider: "sqlite",
	}),
	plugins: [
		oidcProvider({
			loginPage: "/auth/sign-in",
		}),
	],
});
