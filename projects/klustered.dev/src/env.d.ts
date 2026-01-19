/// <reference types="astro/client" />

import type { TypedEnv } from "./types/service-bindings.d.ts";

export interface User {
	id: string;
	email: string;
	name: string;
	image: string | null;
}

declare module "cloudflare:workers" {
	interface Env extends TypedEnv {}
}

type Runtime = import("@astrojs/cloudflare").Runtime<TypedEnv>;

declare global {
	namespace App {
		interface Locals extends Runtime {
			user?: User;
		}
	}
}
