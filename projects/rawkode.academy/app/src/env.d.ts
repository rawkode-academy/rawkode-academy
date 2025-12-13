/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

import type { User } from "@/lib/auth/server";
import type { TypedEnv } from "@/types/service-bindings";

type Runtime = import("@astrojs/cloudflare").Runtime<TypedEnv>;

declare global {
	namespace App {
		interface Locals extends Runtime {
			user?: User & { sub: string };
		}
	}
}
