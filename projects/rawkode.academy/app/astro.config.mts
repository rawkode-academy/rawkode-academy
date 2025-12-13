import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import vue from "@astrojs/vue";
import { defineConfig, envField, fontProviders } from "astro/config";
import { dirname, join, parse } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { vite as vidstackPlugin } from "vidstack/plugins";

// Local implementation of searchForWorkspaceRoot to avoid direct vite import
function searchForWorkspaceRoot(current: string): string {
	const root = parse(current).root;
	const lockFiles = [
		"bun.lock",
		"pnpm-lock.yaml",
		"package-lock.json",
		"yarn.lock",
	];
	let dir = current;
	while (dir !== root) {
		for (const lockFile of lockFiles) {
			if (existsSync(join(dir, lockFile))) {
				return dir;
			}
		}
		const pkgPath = join(dir, "package.json");
		if (existsSync(pkgPath)) {
			try {
				const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
				if (pkg.workspaces) {
					return dir;
				}
			} catch {}
		}
		dir = dirname(dir);
	}
	return current;
}

type AstroUserConfig = Parameters<typeof defineConfig>[0];
type AstroVitePlugins = NonNullable<
	NonNullable<AstroUserConfig["vite"]>["plugins"]
>;

const asAstroVitePlugins = (plugins: unknown[]): AstroVitePlugins =>
	plugins as unknown as AstroVitePlugins;

const disablePlatformProxy =
	process.env.VITEST === "true" ||
	process.env.DISABLE_CLOUDFLARE_PLATFORM_PROXY === "true";

const getSiteUrl = () => {
	if (import.meta.env.DEV === true) {
		return "http://localhost:4322";
	}

	if (import.meta.env.CF_PAGES_URL) {
		return import.meta.env.CF_PAGES_URL;
	}

	return "https://app.rawkode.academy";
};

export default defineConfig({
	output: "server",
	adapter: cloudflare({
		imageService: "cloudflare",
		sessionKVBindingName: "SESSION",
		platformProxy: {
			enabled: !disablePlatformProxy,
		},
		routes: {
			extend: {
				include: [
					{ pattern: "/sign-in" },
					{ pattern: "/auth/callback/*" },
				],
			},
		},
	}),
	trailingSlash: "never",
	integrations: [
		mdx(),
		react({ experimentalReactChildren: true }),
		vue({
			template: {
				compilerOptions: {
					isCustomElement: (tag) => tag.startsWith("media-"),
				},
			},
		}),
	],
	vite: {
		plugins: asAstroVitePlugins([
			vidstackPlugin({ include: /components\/video\// }),
		]),
		server: {
			port: 4322,
			fs: {
				allow: [
					searchForWorkspaceRoot(process.cwd()),
					join(searchForWorkspaceRoot(process.cwd()), "node_modules"),
				],
			},
		},
		build: {
			sourcemap: true,
		},
		resolve: {
			alias: import.meta.env.PROD
				? {
						"react-dom/server": "react-dom/server.edge",
					}
				: {},
		},
		ssr: {
			external: [
				"node:process",
				"node:fs/promises",
				"node:path",
				"node:url",
				"node:crypto",
				"node:worker_threads",
			],
		},
	},
	site: getSiteUrl(),
	env: {
		validateSecrets: true,
		schema: {
			GRAPHQL_ENDPOINT: envField.string({
				context: "server",
				access: "public",
				default: process.env.GRAPHQL_ENDPOINT || "https://api.rawkode.academy/",
			}),
		},
	},
	security: {
		checkOrigin: true,
	},
	experimental: {
		fonts: [
			{
				provider: fontProviders.google(),
				name: "Quicksand",
				cssVariable: "--font-quicksand",
				weights: ["400", "700"],
				styles: ["normal"],
			},
			{
				provider: fontProviders.google(),
				name: "Poppins",
				cssVariable: "--font-poppins",
				weights: ["400", "600"],
				styles: ["normal"],
			},
			{
				provider: fontProviders.fontsource(),
				name: "Monaspace Neon",
				cssVariable: "--font-monaspace-neon",
				weights: ["400"],
				styles: ["normal"],
			},
		],
	},
});
