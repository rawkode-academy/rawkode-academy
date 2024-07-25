/// <reference path="../.astro/env.d.ts" />
/// <reference types="astro/client" />
/// <reference path="../.astro/types.d.ts" />
import type { User } from "@workos-inc/node";

declare global {
	namespace App {
		interface Locals extends Runtime {
			user: User;
			WORKOS_CLIENT_ID: string;
			WORKOS_API_KEY: string;
			WORKOS_COOKIE_PASSWORD: string;
		}
	}
}
