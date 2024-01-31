/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
interface ImportMetaEnv {
	readonly CLERK_PUBLIC_KEY: string;
	readonly CLERK_SECRET_KEY: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare namespace App {
	interface Locals {
		user?: {
			name: string;
			email: string;
			avatarUrl: string;
		};
	}
}
