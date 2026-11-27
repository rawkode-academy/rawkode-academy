/// <reference types="astro/client" />

import type { Session } from "./lib/types.ts";

declare global {
	namespace App {
		interface Locals {
			session?: Session;
			sessionId?: string;
		}
	}
}
