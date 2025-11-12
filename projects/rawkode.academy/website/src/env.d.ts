import type { OidcStandardClaims } from "oidc-client-ts";

/// <reference types="astro/client" />
/// <reference types="../worker-configuration.d.ts" />

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare global {
	namespace App {
		interface Locals extends Runtime {
			user: OidcStandardClaims;
			runtime: {
				env: Env;
			};
		}
	}
}

declare module "virtual:webcontainer-demos" {
	export interface DemoConfig {
		title?: string;
		startCommand?: string;
		description?: string;
	}

	export interface Demo {
		files: Record<string, string>;
		config: DemoConfig;
	}

	export function loadDemoFiles(courseId: string, demoId: string): Demo;

	export function listAvailableDemos(): Array<{
		courseId: string;
		demoId: string;
		title?: string;
		startCommand?: string;
		description?: string;
	}>;
}
