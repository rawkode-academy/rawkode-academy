import type { User } from "./lib/auth/server";

/// <reference types="astro/client" />
/// <reference types="../worker-configuration.d.ts" />

declare global {
	namespace App {
		interface Locals {
			user?: User & { sub: string };
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
