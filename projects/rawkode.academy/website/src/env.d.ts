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
