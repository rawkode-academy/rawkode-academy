/// <reference types="astro/client" />

import type { SendSubjectInput } from "notifications/src/contracts.js";

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
	// Academy identity issuer and subject; absent on sessions created before they were stored.
	issuer?: string | null;
	subject?: string | null;
}

export interface StudioEnv {
	SESSION?: KVNamespace;
	STUDIO_DB?: D1Database;
	RECORDINGS?: R2Bucket;
	RECORDINGS_BUCKET_NAME?: string;
	CLOUDFLARE_ACCOUNT_ID?: string;
	CLOUDFLARE_STREAM_API_TOKEN?: string | SecretsStoreSecret;
	REALTIMEKIT_API_TOKEN?: string;
	REALTIMEKIT_APP_ID?: string;
	REALTIMEKIT_GUEST_PRESET?: string;
	REALTIMEKIT_HOST_PRESET?: string;
	REALTIMEKIT_PRODUCER_PRESET?: string;
	REALTIMEKIT_PROGRAM_PRESET?: string;
	RAWKODE_GRAPHQL_URL?: string;
	STREAM_NOTIFICATIONS?: Queue<SendSubjectInput>;
	STUDIO_OPERATOR_GITHUB_HANDLES?: string;
	// Service binding to rawkode-academy-payload (default entrypoint) for the review
	// handoff. Absent in local development and Worker previews.
	PAYLOAD?: Fetcher;
	PAYLOAD_HANDOFF_URL?: string;
	STUDIO_MACHINE_SECRET?: string | SecretsStoreSecret;
}

declare module "cloudflare:workers" {
	export const env: StudioEnv;
}
