/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

type D1Database = import("@cloudflare/workers-types").D1Database;
type SecretsStoreSecret = import("@cloudflare/workers-types").SecretsStoreSecret;

interface Env {
	DB: D1Database;
	AUTH_SECRET: SecretsStoreSecret;
	GITHUB_OAUTH_CLIENT_ID: SecretsStoreSecret;
	GITHUB_OAUTH_CLIENT_SECRET: SecretsStoreSecret;
}

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
	interface Locals extends Runtime {}
}
