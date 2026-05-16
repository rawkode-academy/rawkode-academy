/// <reference types="astro/client" />

type Runtime = import("@astrojs/cloudflare").Runtime<{
	DB: D1Database;
	ASSETS: Fetcher;
}>;

declare namespace App {
	interface Locals extends Runtime {}
}
