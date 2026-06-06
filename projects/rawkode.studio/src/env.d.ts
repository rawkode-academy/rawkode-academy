/// <reference types="astro/client" />

declare global {
	interface Env extends StudioEnv {}

	namespace App {
		interface Locals {
			user?: StudioUser;
		}
	}
}

export interface StudioUser {
	id: string;
	email: string;
	name: string;
	image: string | null;
	username: string | null;
}

export interface StudioEnv {
	SESSION?: KVNamespace;
	STUDIO_DB?: D1Database;
	RECORDINGS?: R2Bucket;
	RECORDINGS_BUCKET_NAME?: string;
	CLOUDFLARE_ACCOUNT_ID?: string;
	CLOUDFLARE_API_TOKEN?: string;
	REALTIMEKIT_APP_ID?: string;
	REALTIMEKIT_GUEST_PRESET?: string;
	REALTIMEKIT_HOST_PRESET?: string;
	REALTIMEKIT_PRODUCER_PRESET?: string;
	REALTIMEKIT_PROGRAM_PRESET?: string;
	RAWKODE_GRAPHQL_URL?: string;
	STUDIO_OPERATOR_GITHUB_HANDLES?: string;
}

declare module "cloudflare:workers" {
	export const env: StudioEnv;
}
