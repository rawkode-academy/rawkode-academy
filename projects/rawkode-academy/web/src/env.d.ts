/// <reference types="astro/client" />
/// <reference path="../.astro/types.d.ts" />
import type { User } from "@workos-inc/node";

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare global {
	namespace App {
		interface Locals extends Runtime {
			user: User;
		}
	}
}
