import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import vue from "@astrojs/vue";
import astroClerk from "astro-clerk-auth/integration";
import { defineConfig } from "astro/config";

export default defineConfig({
	output: "hybrid",
	integrations: [
		tailwind(),
		vue(),
		react(),
		astroClerk({
			signInUrl: "/login",
			signUpUrl: "/register",
		}),
	],
	adapter: cloudflare({ mode: "advanced" }),
});
